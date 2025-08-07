import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { buildExperienceMatrix } from '@/algorithm/experience-matrix'
import { constrainedHungarianAssignment, type Task, type User } from '@/algorithm/hungarian-assignment'

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

    // === BƯỚC 3: LẤY DANH SÁCH USERS TRONG DỰ ÁN ===
    // Lấy tất cả users trong cùng org_unit với project creator
    const { data: project } = await supabase
      .from('projects')
      .select('created_by, users!created_by(org_unit)')
      .eq('id', project_id)
      .single()

    if (!project) {
      return NextResponse.json({
        error: 'Không tìm thấy dự án',
        assignments: []
      })
    }

    const orgUnit = (project as any).users?.org_unit
    if (!orgUnit) {
      return NextResponse.json({
        error: 'Không thể xác định đơn vị của dự án',
        assignments: []
      })
    }

    // Lấy tất cả users trong cùng org_unit
    const { data: projectMembers } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        position,
        org_unit
      `)
      .eq('org_unit', orgUnit)

    console.log('Project members:', projectMembers)

    if (!projectMembers || projectMembers.length === 0) {
      return NextResponse.json({
        error: 'Không có thành viên nào trong đơn vị của dự án',
        assignments: []
      })
    }

    const userIds = projectMembers.map((pm: any) => pm.id).filter(Boolean)

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
    const availableUsers: User[] = projectMembers.map((pm: any) => {
      return {
        id: pm.id,
        name: pm.full_name,
        current_workload: userWorkloadMap.get(pm.id) || 0,
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

        // Thêm RACI mới
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
          
          results.push({
            task_id: assignment.task_id,
            task_name: task?.name,
            user_id: assignment.user_id,
            user_name: user?.name,
            confidence_score: assignment.confidence_score,
            experience_score: assignment.experience_score
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

    return NextResponse.json({
      success: true,
      message: `Đã phân công ${results.length}/${tasksData.length} công việc`,
      assignments: results,
      unassigned: unassignedTasks,
      errors: errors,
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
