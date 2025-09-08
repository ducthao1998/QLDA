import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { buildExperienceMatrix } from '@/algorithm/experience-matrix'
import { constrainedHungarianAssignment, type Task, type User } from '@/algorithm/hungarian-assignment'

async function getUnavailableUsersInfo(
  supabase: any,
  availableUsers: any[],
  maxConcurrentTasks: number,
  requiredSkills: number[]
) {
  const unavailableUsers = []

  for (const user of availableUsers) {
    // Get user's current tasks with project info
    const { data: currentTasks } = await supabase
      .from('task_raci')
      .select(`
        tasks!inner(
          id,
          name,
          status,
          duration_days,
          projects!inner(name)
        )
      `)
      .eq('user_id', user.id)
      .eq('role', 'R')
      .in('tasks.status', ['todo', 'in_progress', 'review', 'blocked'])

    // Get user's skills
    const { data: userSkills } = await supabase
      .from('user_skill_matrix')
      .select('skill_id')
      .eq('user_id', user.id)
      .in('skill_id', requiredSkills)

    const hasRequiredSkills = userSkills && userSkills.length > 0
    const isOverloaded = user.current_workload >= maxConcurrentTasks

    let reason: 'overloaded' | 'no_skills' | 'unavailable' = 'unavailable'
    if (isOverloaded) {
      reason = 'overloaded'
    } else if (!hasRequiredSkills) {
      reason = 'no_skills'
    }

    const workloadPercentage = Math.round((user.current_workload / maxConcurrentTasks) * 100)

    unavailableUsers.push({
      user_id: user.id,
      full_name: user.name,
      position: user.position,
      org_unit: user.org_unit,
      current_workload: user.current_workload,
      max_concurrent_tasks: maxConcurrentTasks,
      current_tasks: (currentTasks || []).map((ct: any) => ({
        task_id: ct.tasks.id,
        task_name: ct.tasks.name,
        project_name: ct.tasks.projects.name,
        status: ct.tasks.status,
        duration_days: ct.tasks.duration_days
      })),
      workload_percentage: workloadPercentage,
      reason
    })
  }

  return unavailableUsers
}

async function assignOtherRaciRoles(
  supabase: any,
  taskId: string,
  responsibleUserId: string,
  availableUsers: any[],
  experienceMatrix: any,
  requiredSkills: number[]
) {
  const otherAssignments = []
  
  // Lấy danh sách users khác (không phải người đã được gán R)
  const otherUsers = availableUsers.filter(u => u.id !== responsibleUserId)
  
  // Tìm người phù hợp cho role A (Accountable) - thường là manager hoặc senior
  const accountableUser = findBestUserForRole(otherUsers, experienceMatrix, requiredSkills, 'A')
  if (accountableUser) {
    try {
      await supabase
        .from('task_raci')
        .insert({
          task_id: taskId,
          user_id: accountableUser.id,
          role: 'A'
        })
      otherAssignments.push({
        role: 'A',
        user_id: accountableUser.id,
        user_name: accountableUser.name,
        reason: 'Có kinh nghiệm và uy tín để chịu trách nhiệm'
      })
    } catch (error) {
      console.error('Error assigning Accountable:', error)
    }
  }

  // Tìm người phù hợp cho role C (Consulted) - chuyên gia trong lĩnh vực
  const consultedUser = findBestUserForRole(otherUsers, experienceMatrix, requiredSkills, 'C')
  if (consultedUser && consultedUser.id !== accountableUser?.id) {
    try {
      await supabase
        .from('task_raci')
        .insert({
          task_id: taskId,
          user_id: consultedUser.id,
          role: 'C'
        })
      otherAssignments.push({
        role: 'C',
        user_id: consultedUser.id,
        user_name: consultedUser.name,
        reason: 'Có chuyên môn sâu để đưa ra lời khuyên'
      })
    } catch (error) {
      console.error('Error assigning Consulted:', error)
    }
  }

  // Tìm người phù hợp cho role I (Informed) - có thể là stakeholder hoặc team lead
  const informedUser = findBestUserForRole(otherUsers, experienceMatrix, requiredSkills, 'I')
  if (informedUser && 
      informedUser.id !== accountableUser?.id && 
      informedUser.id !== consultedUser?.id) {
    try {
      await supabase
        .from('task_raci')
        .insert({
          task_id: taskId,
          user_id: informedUser.id,
          role: 'I'
        })
      otherAssignments.push({
        role: 'I',
        user_id: informedUser.id,
        user_name: informedUser.name,
        reason: 'Cần được thông báo về tiến độ'
      })
    } catch (error) {
      console.error('Error assigning Informed:', error)
    }
  }

  return otherAssignments
}

function findBestUserForRole(
  users: any[],
  experienceMatrix: any,
  requiredSkills: number[],
  role: 'A' | 'C' | 'I'
) {
  if (users.length === 0) return null

  // Tính điểm cho từng user dựa trên role
  const userScores = users.map(user => {
    let score = 0
    
    if (role === 'A') {
      // Accountable cần kinh nghiệm cao và ít workload
      const experienceScore = requiredSkills.length > 0 
        ? requiredSkills.reduce((sum, skillId) => sum + (experienceMatrix[user.id]?.[skillId] || 0), 0) / requiredSkills.length
        : 0
      const workloadScore = user.current_workload < 2 ? 1 : 0.5
      score = experienceScore * 0.7 + workloadScore * 0.3
    } else if (role === 'C') {
      // Consulted cần chuyên môn cao nhất
      const experienceScore = requiredSkills.length > 0 
        ? requiredSkills.reduce((sum, skillId) => sum + (experienceMatrix[user.id]?.[skillId] || 0), 0) / requiredSkills.length
        : 0
      score = experienceScore
    } else if (role === 'I') {
      // Informed chỉ cần có thời gian
      const workloadScore = user.current_workload < 3 ? 1 : 0.5
      score = workloadScore
    }
    
    return { user, score }
  })

  // Sắp xếp theo điểm và trả về user tốt nhất
  userScores.sort((a, b) => b.score - a.score)
  const bestUser = userScores[0]
  
  // Chỉ trả về nếu điểm > 0.3 (có thể chấp nhận được)
  return bestUser.score > 0.3 ? bestUser.user : null
}

export async function POST(req: Request) {
  const supabase = await createClient()

  try {
    const body = await req.json()
    const { task_ids, project_id, max_concurrent_tasks = 2 } = body

    if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
      return NextResponse.json(
        { error: 'Cần cung cấp danh sách task_ids' },
        { status: 400 }
      )
    }

    if (!project_id) {
      return NextResponse.json(
        { error: 'Cần cung cấp project_id' },
        { status: 400 }
      )
    }

    console.log('=== AUTO ASSIGN RACI DEBUG ===')
    console.log('Task IDs:', task_ids)
    console.log('Project ID:', project_id)
    console.log('Max concurrent tasks:', max_concurrent_tasks)

    // === BƯỚC 1: LẤY THÔNG TIN CÁC TASKS CẦN PHÂN CÔNG ===
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        id,
        name,
        template_id,
        project_id,
        task_skills(skill_id)
      `)
      .in('id', task_ids)
      .eq('project_id', project_id)

    console.log('Tasks data:', tasksData)
    console.log('Tasks error:', tasksError)

    if (tasksError || !tasksData || tasksData.length === 0) {
      return NextResponse.json(
        { error: 'Không tìm thấy tasks trong dự án' },
        { status: 404 }
      )
    }

    // === BƯỚC 2: LẤY THÔNG TIN SKILLS YÊU CẦU CHO TỪNG TASK ===
    const allSkills = new Set<number>()
    const taskSkillsMap = new Map<string, number[]>()

    for (const task of tasksData) {
      let requiredSkills: number[] = []

      // Từ template nếu có
      if (task.template_id) {
        const { data: templateData } = await supabase
          .from('task_templates')
          .select('required_skill_id')
          .eq('id', task.template_id)
          .single()

        if (templateData?.required_skill_id) {
          requiredSkills.push(templateData.required_skill_id)
          allSkills.add(templateData.required_skill_id)
        }
      }

      // Từ task_skills
      if (task.task_skills && task.task_skills.length > 0) {
        const skillIds = task.task_skills
          .map((ts: any) => ts.skill_id)
          .filter((id: number) => id !== null)
        
        requiredSkills = [...new Set([...requiredSkills, ...skillIds])]
        skillIds.forEach(id => allSkills.add(id))
      }

      taskSkillsMap.set(task.id, requiredSkills)
    }

    console.log('Task skills map:', Object.fromEntries(taskSkillsMap))
    console.log('All skills:', Array.from(allSkills))

    // === BƯỚC 3: LẤY DANH SÁCH TẤT CẢ USERS TRONG HỆ THỐNG ===
    // Lấy tất cả users trong hệ thống (không giới hạn org_unit)
    const { data: allUsers } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        position,
        org_unit
      `)
      .not('id', 'is', null)

    console.log('All users:', allUsers)

    if (!allUsers || allUsers.length === 0) {
      return NextResponse.json({
        error: 'Không có người dùng nào trong hệ thống',
        assignments: []
      })
    }

    const userIds = allUsers.map((user: any) => user.id).filter(Boolean)

    // === BƯỚC 4: TÍNH WORKLOAD HIỆN TẠI CỦA TỪNG USER (TẤT CẢ DỰ ÁN) ===
    const { data: currentWorkloads } = await supabase
      .from('task_raci')
      .select(`
        user_id,
        tasks!inner(
          id,
          status,
          project_id,
          projects!inner(
            id,
            name,
            status
          )
        )
      `)
      .eq('role', 'R')
      .in('tasks.status', ['todo', 'in_progress', 'review', 'blocked'])
      .in('user_id', userIds)
      .in('tasks.projects.status', ['active', 'planning']) // Chỉ tính dự án đang hoạt động

    console.log('Current workloads (all projects):', currentWorkloads)

    // Đếm workload cho mỗi user từ tất cả dự án
    const userWorkloadMap = new Map<string, number>()
    const userProjectsMap = new Map<string, Set<string>>() // Track projects per user
    
    currentWorkloads?.forEach(item => {
      if (item.user_id) {
        const currentCount = userWorkloadMap.get(item.user_id) || 0
        userWorkloadMap.set(item.user_id, currentCount + 1)
        
        // Track projects
        if (!userProjectsMap.has(item.user_id)) {
          userProjectsMap.set(item.user_id, new Set())
        }
        userProjectsMap.get(item.user_id)?.add((item.tasks as any).project_id)
      }
    })

    console.log('User workload map (all projects):', Object.fromEntries(userWorkloadMap))
    console.log('User projects count:', Object.fromEntries(
      Array.from(userProjectsMap.entries()).map(([userId, projects]) => [userId, projects.size])
    ))

    // === BƯỚC 5: TẠO DANH SÁCH USERS CHO THUẬT TOÁN ===
    const availableUsers: User[] = allUsers.map((user: any) => {
      return {
        id: user.id,
        name: user.full_name,
        current_workload: userWorkloadMap.get(user.id) || 0,
        max_concurrent_tasks: max_concurrent_tasks
      }
    })

    console.log('Available users:', availableUsers)

    // === BƯỚC 6: XÂY DỰNG EXPERIENCE MATRIX ===
    const experienceMatrix = await buildExperienceMatrix(
      userIds,
      Array.from(allSkills),
    )

    console.log('Experience Matrix:', experienceMatrix)

    // === BƯỚC 7: TẠO DANH SÁCH TASKS CHO THUẬT TOÁN ===
    const algorithmTasks: Task[] = tasksData.map(task => ({
      id: task.id,
      name: task.name,
      required_skills: taskSkillsMap.get(task.id) || [],
      priority: 1,
      estimated_hours: 8
    }))

    console.log('Algorithm Tasks:', algorithmTasks)

    // === BƯỚC 8: SỬ DỤNG HUNGARIAN ASSIGNMENT ===
    const filteredUsers = availableUsers.filter(u => u.current_workload < max_concurrent_tasks)
    console.log('Filtered users (by workload):', filteredUsers)
    
    const assignments = constrainedHungarianAssignment(
      algorithmTasks,
      availableUsers,
      experienceMatrix,
      max_concurrent_tasks
    )
    
    console.log('Assignments result:', assignments)

    // === BƯỚC 9: LƯU KẾT QUẢ PHÂN CÔNG VÀO DATABASE ===
    const results = []
    const errors = []

    for (const assignment of assignments) {
      try {
        console.log(`Assigning task ${assignment.task_id} to user ${assignment.user_id}`)
        
        // Xóa RACI cũ của task (nếu có)
        await supabase
          .from('task_raci')
          .delete()
          .eq('task_id', assignment.task_id)

        // Gán role R (Responsible) - người thực hiện chính
        const { error: insertError } = await supabase
          .from('task_raci')
          .insert({
            task_id: assignment.task_id,
            user_id: assignment.user_id,
            role: 'R'
          })

        if (insertError) {
          console.error('Insert error:', insertError)
          errors.push({
            task_id: assignment.task_id,
            error: insertError.message
          })
        } else {
          const task = tasksData.find(t => t.id === assignment.task_id)
          const user = availableUsers.find(u => u.id === assignment.user_id)
          
          // Tìm thêm người cho các role khác nếu có thể
          const otherRoleAssignments = await assignOtherRaciRoles(
            supabase,
            assignment.task_id,
            assignment.user_id,
            availableUsers,
            experienceMatrix,
            taskSkillsMap.get(assignment.task_id) || []
          )

          results.push({
            task_id: assignment.task_id,
            task_name: task?.name,
            user_id: assignment.user_id,
            user_name: user?.name,
            confidence_score: assignment.confidence_score,
            experience_score: assignment.experience_score,
            other_assignments: otherRoleAssignments
          })
        }
      } catch (error: any) {
        console.error('Assignment error:', error)
        errors.push({
          task_id: assignment.task_id,
          error: error.message
        })
      }
    }

    // === BƯỚC 10: TRẢ VỀ KẾT QUẢ ===
    const unassignedTasks = tasksData
      .filter(task => !assignments.some(a => a.task_id === task.id))
      .map(task => ({
        task_id: task.id,
        task_name: task.name,
        reason: 'Không tìm thấy người phù hợp hoặc tất cả đều đã bận'
      }))

    console.log('Final results:', results)
    console.log('Unassigned tasks:', unassignedTasks)
    console.log('Errors:', errors)

    // Get detailed info about unavailable users for explanation dialog
    const unavailableUsers = await getUnavailableUsersInfo(
      supabase, 
      allUsers, 
      max_concurrent_tasks, 
      Array.from(allSkills)
    )

    // Get skill names for display
    const { data: skillsData } = await supabase
      .from('skills')
      .select('id, name')
      .in('id', Array.from(allSkills))

    const skillNames = skillsData?.map(s => s.name) || []

    return NextResponse.json({
      success: true,
      message: `Đã phân công ${results.length}/${tasksData.length} công việc`,
      assignments: results,
      unassigned: unassignedTasks,
      errors: errors,
      unavailable_users: unavailableUsers,
      required_skills: skillNames,
      debug: {
        total_tasks: tasksData.length,
        total_users: availableUsers.length,
        available_users: filteredUsers.length,
        algorithm_used: 'experience_matrix + constrained_hungarian',
        experience_matrix_size: Object.keys(experienceMatrix).length,
        skills_count: allSkills.size
      }
    })

  } catch (error: any) {
    console.error('Lỗi khi tự động phân công RACI:', error)
    return NextResponse.json({
      error: error.message,
      assignments: []
    }, { status: 500 })
  }
}
