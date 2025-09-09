import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { buildExperienceMatrix } from '@/algorithm/experience-matrix'
import { constrainedHungarianAssignment, calculateUserTaskScore, type Task, type User } from '@/algorithm/hungarian-assignment'

// Helper function to check if user can take more tasks
const canTakeMore = (u: any, capParam: number) => {
  const cap = Math.min(capParam, Number.isFinite(u.max_concurrent_tasks) ? u.max_concurrent_tasks : capParam)
  const cur = u.current_workload ?? 0
  return cur < cap
}

async function getUnavailableUsersInfo(
  supabase: any,
  unavailableUsersList: any[],
  maxConcurrentTasks: number,
  requiredSkills: number[],
  experienceMatrix: any,
  optimalAssignments: any[] = []
) {
  const unavailableUsers = []

  console.log('Processing unavailable users:', unavailableUsersList.length)
  console.log('Required skills for unavailable users:', requiredSkills)
  
  // Optimize: Batch queries instead of N+1
  const userIds = unavailableUsersList.map(u => u.id)
  
  // 1) Current tasks for all users
  const { data: currentTasksAll } = await supabase
    .from('task_raci')
    .select(`
      user_id,
      tasks!inner(
        id,
        name,
        status,
        duration_days,
        projects!inner(name)
      )
    `)
    .eq('role', 'R')
    .in('user_id', userIds)
    .in('tasks.status', ['todo', 'in_progress', 'review', 'blocked'])

  // Group current tasks by user
  const curTasksByUser = new Map<string, any[]>()
  currentTasksAll?.forEach((r: any) => {
    const arr = curTasksByUser.get(r.user_id) ?? []
    arr.push(r)
    curTasksByUser.set(r.user_id, arr)
  })

  // 2) Skill matrix for all users
  const { data: matrixAll } = await supabase
    .from('user_skill_matrix')
    .select(`
      user_id,
      skill_id,
      skill_name,
      completed_tasks_count,
      last_activity_date
    `)
    .in('user_id', userIds)
    .in('skill_id', requiredSkills)

  const skillsByUser = new Map<string, any[]>()
  matrixAll?.forEach((r: any) => {
    const arr = skillsByUser.get(r.user_id) ?? []
    arr.push(r)
    skillsByUser.set(r.user_id, arr)
  })

  // 3) User skills for all users
  const { data: userSkillsAll } = await supabase
    .from('user_skill_matrix')
    .select('user_id, skill_id')
    .in('user_id', userIds)
    .in('skill_id', requiredSkills)

  const userSkillsByUser = new Map<string, any[]>()
  userSkillsAll?.forEach((r: any) => {
    const arr = userSkillsByUser.get(r.user_id) ?? []
    arr.push(r)
    userSkillsByUser.set(r.user_id, arr)
  })
  
  for (const user of unavailableUsersList) {
    console.log('Processing user:', user.id, user.name || user.full_name)
    
    // Get user's current tasks from batch result
    const currentTasks = curTasksByUser.get(user.id) || []
    const userSkills = userSkillsByUser.get(user.id) || []
    const matrixData = skillsByUser.get(user.id) || []

    // Calculate actual current workload from tasks
    const actualWorkload = currentTasks.length

    console.log(`User ${user.id} matrix data:`, matrixData)

    // If no data from view, fallback to task_raci aggregation
    let userSkillData = { skills: matrixData || [] }
    
    if (!matrixData || matrixData.length === 0) {
      // Use batch fallback query for all users at once
      const { data: raciAggAll } = await supabase
        .from('task_raci')
        .select(`
          user_id,
          tasks!inner(
            id,
            status,
            task_skills!inner(
              skill_id,
              skills!inner(name)
            )
          )
        `)
        .in('user_id', userIds)
        .eq('role', 'R')

      if (raciAggAll) {
        const fallbackCountsByUser = new Map<string, Record<number, { name: string; count: number }>>()
        
        raciAggAll.forEach((row: any) => {
          const task = row.tasks
          if (!task) return
          const status = String(task.status || '').toLowerCase()
          const isCompleted = status === 'done' || status === 'completed' || status === 'hoan_thanh'
          if (!isCompleted) return
          
          const tskills = task.task_skills || []
          tskills.forEach((ts: any) => {
            const skillId = ts.skill_id
            const skillName = ts.skills?.name
            if (requiredSkills.includes(skillId)) {
              if (!fallbackCountsByUser.has(row.user_id)) {
                fallbackCountsByUser.set(row.user_id, {})
              }
              const userCounts = fallbackCountsByUser.get(row.user_id)!
              if (!userCounts[skillId]) {
                userCounts[skillId] = { name: skillName, count: 0 }
              }
              userCounts[skillId].count += 1
            }
          })
        })

        const userFallbackCounts = fallbackCountsByUser.get(user.id) || {}
        userSkillData.skills = Object.entries(userFallbackCounts).map(([skillId, info]) => ({
          skill_id: Number(skillId),
          skill_name: info.name,
          completed_tasks_count: info.count,
          last_activity_date: null
        }))
      }
    }

    console.log(`User ${user.id} final skill data:`, userSkillData)

    const userExperience = requiredSkills.map(skillId => {
      const skillData = userSkillData?.skills?.find((s: any) => s.skill_id === skillId)
      console.log(`Skill ${skillId} for user ${user.id}:`, skillData)
      
      const completedTasks = skillData?.completed_tasks_count || 0
      
      return { 
        skill_id: skillId, 
        skill_name: skillData?.skill_name || `Kỹ năng ${skillId}`,
        completed_tasks: completedTasks
      }
    })

    const hasRequiredSkills = userSkills && userSkills.length > 0
    const userMaxConcurrent = Number.isFinite(user.max_concurrent_tasks) 
      ? user.max_concurrent_tasks 
      : maxConcurrentTasks
    const isOverloaded = actualWorkload >= userMaxConcurrent

    // Calculate total completed tasks with required skills
    const totalCompletedTasks = userExperience.reduce((sum, exp) => sum + exp.completed_tasks, 0)

    // Determine reason based on algorithm analysis
    let reason: 'overloaded' | 'no_skills' | 'unavailable' = 'unavailable'
    let reasonText = 'Không khả dụng'
    
    // Check if user was considered but not chosen due to workload
    if (isOverloaded) {
      reason = 'overloaded'
      if (totalCompletedTasks >= 5) {
        reasonText = `Đáng ra được chọn (đã hoàn thành ${totalCompletedTasks} công việc liên quan) nhưng đang bận ${actualWorkload}/${userMaxConcurrent} công việc`
      } else if (totalCompletedTasks >= 1) {
        reasonText = `Có thể phù hợp (đã hoàn thành ${totalCompletedTasks} công việc liên quan) nhưng đang bận ${actualWorkload}/${userMaxConcurrent} công việc`
      } else {
        reasonText = `Đang bận ${actualWorkload}/${userMaxConcurrent} công việc`
      }
    } else if (!hasRequiredSkills) {
      reason = 'no_skills'
      reasonText = 'Không có kỹ năng phù hợp với yêu cầu công việc'
    } else {
      // User has skills and is not overloaded, but algorithm chose someone else
      // This means there are better candidates
      if (totalCompletedTasks >= 5) {
        reasonText = `Có kinh nghiệm (đã hoàn thành ${totalCompletedTasks} công việc liên quan) nhưng có người phù hợp hơn được chọn`
      } else if (totalCompletedTasks >= 1) {
        reasonText = `Có ít kinh nghiệm (đã hoàn thành ${totalCompletedTasks} công việc liên quan) nhưng có người phù hợp hơn được chọn`
      } else {
        reasonText = `Chưa có kinh nghiệm với kỹ năng này - có người phù hợp hơn được chọn`
      }
    }

    // Debug current tasks data
    console.log(`User ${user.id} current tasks:`, currentTasks?.length || 0, 'tasks')
    console.log('Current tasks data:', currentTasks)
    
    // Find best role recommendations based on completed tasks
    const roleRecommendations = {
      R: { completed_tasks: 0, reason: 'Chưa có kinh nghiệm với kỹ năng này' },
      A: { completed_tasks: 0, reason: 'Cần kinh nghiệm nhiều hơn để đảm nhận vai trò chịu trách nhiệm' },
      C: { completed_tasks: 0, reason: 'Cần nhiều kinh nghiệm hơn để đưa ra lời khuyên đáng tin cậy' },
      I: { completed_tasks: 0, reason: 'Có đủ thời gian và khả năng để theo dõi và cập nhật tiến độ công việc' }
    }
    
    if (totalCompletedTasks >= 7) {
      roleRecommendations.R = { completed_tasks: totalCompletedTasks, reason: `Có kinh nghiệm cao (đã hoàn thành ${totalCompletedTasks} công việc liên quan)` }
      roleRecommendations.A = { completed_tasks: totalCompletedTasks, reason: `Có thể đảm nhận vai trò chịu trách nhiệm (đã hoàn thành ${totalCompletedTasks} công việc liên quan)` }
    } else if (totalCompletedTasks >= 3) {
      roleRecommendations.R = { completed_tasks: totalCompletedTasks, reason: `Có kinh nghiệm vừa phải (đã hoàn thành ${totalCompletedTasks} công việc liên quan)` }
      roleRecommendations.A = { completed_tasks: totalCompletedTasks, reason: `Cần hỗ trợ thêm để chịu trách nhiệm (đã hoàn thành ${totalCompletedTasks} công việc liên quan)` }
    } else if (totalCompletedTasks >= 1) {
      roleRecommendations.R = { completed_tasks: totalCompletedTasks, reason: `Có ít kinh nghiệm (đã hoàn thành ${totalCompletedTasks} công việc liên quan)` }
    }
    
    if (totalCompletedTasks >= 5) {
      roleRecommendations.C = { completed_tasks: totalCompletedTasks, reason: `Có chuyên môn để đưa ra lời khuyên (đã hoàn thành ${totalCompletedTasks} công việc liên quan)` }
    }
    
    if (actualWorkload < 2) {
      roleRecommendations.I = { completed_tasks: 0, reason: 'Có đủ thời gian để theo dõi tiến độ' }
    }

    unavailableUsers.push({
      user_id: user.id,
      full_name: user.name || user.full_name, // Support both field names
      position: user.position,
      org_unit: user.org_unit,
      current_workload: actualWorkload, // Use actual count from tasks
      max_concurrent_tasks: user.max_concurrent_tasks || maxConcurrentTasks, // Use user's actual max
      current_tasks: currentTasks.map((ct: any) => ({
        task_id: ct.tasks.id,
        task_name: ct.tasks.name,
        project_name: ct.tasks.projects.name,
        status: ct.tasks.status,
        duration_days: ct.tasks.duration_days
      })),
      workload_percentage: 0, // Remove percentage calculation
      reason,
      reason_text: reasonText,
      skill_experience: userExperience,
      role_recommendations: roleRecommendations
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
  requiredSkills: number[],
  maxConcurrentTasks: number
) {
  const otherAssignments = []
  
  // Lấy danh sách users khác (không phải người đã được gán R)
  const otherUsers = availableUsers.filter(u => u.id !== responsibleUserId)
  
  // Tìm người phù hợp cho role A (Accountable) - thường là manager hoặc senior
  const accountableUser = findBestUserForRole(otherUsers, experienceMatrix, requiredSkills, 'A')
  if (accountableUser && canTakeMore(accountableUser, maxConcurrentTasks)) {
    try {
      // Xóa role A cũ (nếu có)
      await supabase
        .from('task_raci')
        .delete()
        .eq('task_id', taskId)
        .eq('role', 'A')
        
      // Gán role A mới
      await supabase
        .from('task_raci')
        .insert({
          task_id: taskId,
          user_id: accountableUser.id,
          role: 'A'
        })
      // Tăng tạm workload trong bộ nhớ để tránh vượt trần khi gán tiếp
      accountableUser.current_workload = (accountableUser.current_workload ?? 0) + 1
      otherAssignments.push({
        role: 'A',
        user_id: accountableUser.id,
        user_name: accountableUser.name,
        suitability: accountableUser.role_suitability,
        score: accountableUser.role_score,
        reason: 'Có kinh nghiệm và uy tín để chịu trách nhiệm'
      })
    } catch (error) {
      console.error('Error assigning Accountable:', error)
    }
  }

  // Tìm người phù hợp cho role C (Consulted) - chuyên gia trong lĩnh vực
  const consultedUser = findBestUserForRole(otherUsers, experienceMatrix, requiredSkills, 'C')
  if (consultedUser && consultedUser.id !== accountableUser?.id && canTakeMore(consultedUser, maxConcurrentTasks)) {
    try {
      // Xóa role C cũ (nếu có)
      await supabase
        .from('task_raci')
        .delete()
        .eq('task_id', taskId)
        .eq('role', 'C')
        
      // Gán role C mới
      await supabase
        .from('task_raci')
        .insert({
          task_id: taskId,
          user_id: consultedUser.id,
          role: 'C'
        })
      // Tăng tạm workload trong bộ nhớ để tránh vượt trần khi gán tiếp
      consultedUser.current_workload = (consultedUser.current_workload ?? 0) + 1
      otherAssignments.push({
        role: 'C',
        user_id: consultedUser.id,
        user_name: consultedUser.name,
        suitability: consultedUser.role_suitability,
        score: consultedUser.role_score,
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
      informedUser.id !== consultedUser?.id &&
      canTakeMore(informedUser, maxConcurrentTasks)) {
    try {
      // Xóa role I cũ (nếu có)
      await supabase
        .from('task_raci')
        .delete()
        .eq('task_id', taskId)
        .eq('role', 'I')
        
      // Gán role I mới
      await supabase
        .from('task_raci')
        .insert({
          task_id: taskId,
          user_id: informedUser.id,
          role: 'I'
        })
      // Tăng tạm workload trong bộ nhớ để tránh vượt trần khi gán tiếp
      informedUser.current_workload = (informedUser.current_workload ?? 0) + 1
      otherAssignments.push({
        role: 'I',
        user_id: informedUser.id,
        user_name: informedUser.name,
        suitability: informedUser.role_suitability,
        score: informedUser.role_score,
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
    let suitability = 'Không phù hợp'
    
    if (role === 'A') {
      // Accountable cần kinh nghiệm cao và ít workload
      const experienceScore = requiredSkills.length > 0 
        ? requiredSkills.reduce((sum, skillId) => sum + (experienceMatrix[user.id]?.[skillId] || 0), 0) / requiredSkills.length
        : 0
      const workloadScore = user.current_workload < 2 ? 1 : 0.5
      score = experienceScore * 0.7 + workloadScore * 0.3
      
      if (score >= 0.7) suitability = 'Rất phù hợp'
      else if (score >= 0.5) suitability = 'Phù hợp'
      else if (score >= 0.3) suitability = 'Ít phù hợp'
    } else if (role === 'C') {
      // Consulted cần chuyên môn cao nhất
      const experienceScore = requiredSkills.length > 0 
        ? requiredSkills.reduce((sum, skillId) => sum + (experienceMatrix[user.id]?.[skillId] || 0), 0) / requiredSkills.length
        : 0
      score = experienceScore
      
      if (score >= 0.8) suitability = 'Rất phù hợp'
      else if (score >= 0.6) suitability = 'Phù hợp'
      else if (score >= 0.3) suitability = 'Ít phù hợp'
    } else if (role === 'I') {
      // Informed chỉ cần có thời gian
      const workloadScore = user.current_workload < 3 ? 1 : 0.5
      score = workloadScore
      
      if (score >= 0.8) suitability = 'Rất phù hợp'
      else if (score >= 0.5) suitability = 'Phù hợp'
      else suitability = 'Ít phù hợp'
    }
    
    return { user, score, suitability }
  })

  // Sắp xếp theo điểm và trả về user tốt nhất
  userScores.sort((a, b) => b.score - a.score)
  const bestUser = userScores[0]
  
  // Chỉ trả về nếu điểm > 0.3 (có thể chấp nhận được)
  if (bestUser.score > 0.3) {
    return {
      ...bestUser.user,
      role_suitability: bestUser.suitability,
      role_score: bestUser.score
    }
  }
  
  return null
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
        org_unit,
        max_concurrent_tasks
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
        // Ưu tiên trần của từng user; fallback tham số route
        max_concurrent_tasks: Number.isFinite(user.max_concurrent_tasks)
          ? user.max_concurrent_tasks
          : max_concurrent_tasks
      }
    })

    console.log('Available users:', availableUsers)

    // === BƯỚC 6: XÂY DỰNG EXPERIENCE MATRIX ===
    const experienceMatrix = await buildExperienceMatrix(
      userIds,
      Array.from(allSkills),
    )

    const isProd = process.env.NODE_ENV === 'production'
    if (!isProd) console.log('Experience Matrix size:', Object.keys(experienceMatrix).length)

    // === BƯỚC 7: TẠO DANH SÁCH TASKS CHO THUẬT TOÁN ===
    const algorithmTasks: Task[] = tasksData.map(task => ({
      id: task.id,
      name: task.name,
      required_skills: taskSkillsMap.get(task.id) || [],
      priority: 1,
      estimated_hours: 8
    }))

    console.log('Algorithm Tasks:', algorithmTasks)

    // Debug: Log top candidates for each task
    if (!isProd) {
      algorithmTasks.forEach(task => {
        const candidates = availableUsers
          .map(user => {
            const skillExperience = task.required_skills.map(skillId => {
              // Lấy thông tin từ user_skill_matrix để hiển thị completed_tasks_count thực tế
              return {
                skill_id: skillId,
                completed_tasks: 'N/A' // Sẽ được cập nhật từ database
              }
            })
            
            return { 
              user_id: user.id, 
              name: user.name, 
              current_workload: user.current_workload,
              max_capacity: user.max_concurrent_tasks,
              skill_experience: skillExperience
            }
          })
          .slice(0, 3)
        
        console.log(`Task ${task.name} - Required skills: ${task.required_skills.join(', ')}`)
        console.log(`Top 3 candidates:`, candidates)
      })
    }

    // === BƯỚC 8: SỬ DỤNG HUNGARIAN ASSIGNMENT ===
    const filteredUsers = availableUsers.filter(u => u.current_workload < max_concurrent_tasks)
    if (!isProd) console.log('Filtered users (by workload):', filteredUsers.length)
    
    const assignments = constrainedHungarianAssignment(
      algorithmTasks,
      availableUsers,
      experienceMatrix,
      max_concurrent_tasks,
      {
        minConfidence: 0.35,    // từ 0.4 xuống 0.35 để mềm dẻo hơn
        unassignedCost: 0.5,    // cho phép "không gán" khi điểm < 0.5
        bigPenalty: 1e6
      }
    )
    
    console.log('Assignments result:', assignments)

    // === BƯỚC 9: LƯU KẾT QUẢ PHÂN CÔNG VÀO DATABASE ===
    const results = []
    const errors = []

    for (const assignment of assignments) {
      try {
        console.log(`Assigning task ${assignment.task_id} to user ${assignment.user_id}`)
        
        // Xóa RACI cũ của task trước (nếu có)
        await supabase
          .from('task_raci')
          .delete()
          .eq('task_id', assignment.task_id)
          .eq('role', 'R')

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
            taskSkillsMap.get(assignment.task_id) || [],
            max_concurrent_tasks
          )
          
          // Add role recommendations for the responsible user
          const responsibleUser = availableUsers.find(u => u.id === assignment.user_id)
          let roleRecommendations = null
          
          if (responsibleUser) {
            // Get actual completed tasks count for this user's skills from user_skill_matrix
            const { data: userSkillData } = await supabase
              .from('user_skill_matrix')
              .select('skill_id, completed_tasks_count')
              .eq('user_id', responsibleUser.id)
              .in('skill_id', taskSkillsMap.get(assignment.task_id) || [])
            
            const requiredSkills = taskSkillsMap.get(assignment.task_id) || []
            
            const totalCompletedTasks = requiredSkills.reduce((sum, skillId) => {
              const skillData = userSkillData?.find((s: any) => s.skill_id === skillId)
              return sum + (skillData?.completed_tasks_count || 0)
            }, 0)
            
            // Add role recommendations based on completed tasks
            roleRecommendations = {
              R: { 
                completed_tasks: totalCompletedTasks, 
                reason: totalCompletedTasks >= 3 ? `Có kinh nghiệm (đã hoàn thành ${totalCompletedTasks} công việc liên quan)` : 'Có thể thực hiện' 
              },
              A: { 
                completed_tasks: totalCompletedTasks, 
                reason: totalCompletedTasks >= 5 ? `Có thể đảm nhận trách nhiệm (đã hoàn thành ${totalCompletedTasks} công việc liên quan)` : 'Cần hỗ trợ thêm' 
              },
              C: { 
                completed_tasks: totalCompletedTasks, 
                reason: totalCompletedTasks >= 5 ? `Có chuyên môn để tư vấn (đã hoàn thành ${totalCompletedTasks} công việc liên quan)` : 'Cần kinh nghiệm thêm' 
              },
              I: { 
                completed_tasks: 0, 
                reason: 'Có thể theo dõi tiến độ' 
              }
            }
          }

          results.push({
            task_id: assignment.task_id,
            task_name: task?.name,
            user_id: assignment.user_id,
            user_name: user?.name,
            confidence_score: assignment.confidence_score,
            experience_score: assignment.experience_score,
            other_assignments: otherRoleAssignments,
            role_recommendations: roleRecommendations
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
        reason: 'Không đạt ngưỡng tin cậy hoặc không đủ năng lực/capacity'
      }))

    console.log('Final results:', results)
    console.log('Unassigned tasks:', unassignedTasks)
    console.log('Errors:', errors)

    // Get detailed info about unavailable users for explanation dialog
    // Run algorithm to find optimal assignments and compare with actual results
    const optimalAlgorithmTasks = tasksData.map(task => ({
      id: task.id,
      name: task.name,
      required_skills: taskSkillsMap.get(task.id) || [],
      priority: 1,
      estimated_hours: 8
    }))

    // Convert allUsers to User format for algorithm
    const algorithmUsers = allUsers.map((user: any) => ({
      id: user.id,
      name: user.full_name || user.name,
      current_workload: userWorkloadMap.get(user.id) ?? 0, // <-- dùng map đã tính
      max_concurrent_tasks: Number.isFinite(user.max_concurrent_tasks)
        ? user.max_concurrent_tasks
        : max_concurrent_tasks
    }))

    // Run Hungarian algorithm to find optimal assignments
    const optimalAssignments = constrainedHungarianAssignment(
      optimalAlgorithmTasks,
      algorithmUsers,
      experienceMatrix,
      max_concurrent_tasks,
      {
        minConfidence: 0.35,    // từ 0.4 xuống 0.35 để mềm dẻo hơn
        unassignedCost: 0.5,    // cho phép "không gán" khi điểm < 0.5
        bigPenalty: 1e6
      }
    )

    // Find users who were NOT assigned in optimal solution
    const assignedUserIds = new Set(optimalAssignments.map(a => a.user_id))
    const unavailableUsersList = allUsers.filter(user => 
      !assignedUserIds.has(user.id)
    )
    
    console.log('Optimal assignments:', optimalAssignments.length)
    console.log('Unavailable users list:', unavailableUsersList.length, 'users')
    console.log('Sample unavailable user:', unavailableUsersList[0])
    
    const unavailableUsers = await getUnavailableUsersInfo(
      supabase, 
      unavailableUsersList, 
      max_concurrent_tasks, 
      Array.from(allSkills),
      experienceMatrix,
      optimalAssignments
    )
    
    console.log('Processed unavailable users:', unavailableUsers.length, 'users')
    console.log('Sample processed user:', unavailableUsers[0])

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
