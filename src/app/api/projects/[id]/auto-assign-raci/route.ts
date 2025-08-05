import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { buildExperienceMatrix } from '@/algorithm/experience-matrix'
import { constrainedHungarianAssignment, type Task, type User } from '@/algorithm/hungarian-assignment'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { id: projectId } = await params

  try {
    const body = await req.json()
    const { task_ids, max_concurrent_tasks = 2 } = body

    if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
      return NextResponse.json(
        { error: 'Cần cung cấp danh sách task_ids' },
        { status: 400 }
      )
    }

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
      .eq('project_id', projectId)

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

    // === BƯỚC 3: LẤY DANH SÁCH USERS TRONG DỰ ÁN ===
    const { data: projectMembers } = await supabase
      .from('project_members')
      .select(`
        user_id,
        users!inner(
          id,
          full_name
        )
      `)
      .eq('project_id', projectId)

    if (!projectMembers || projectMembers.length === 0) {
      return NextResponse.json({
        error: 'Không có thành viên nào trong dự án',
        assignments: []
      })
    }

    const userIds = projectMembers.map(pm => pm.user_id).filter(Boolean)

    // === BƯỚC 4: TÍNH WORKLOAD HIỆN TẠI CỦA TỪNG USER ===
    const { data: currentWorkloads } = await supabase
      .from('task_raci')
      .select(`
        user_id,
        tasks!inner(
          id,
          status,
          project_id
        )
      `)
      .eq('role', 'R')
      .in('tasks.status', ['todo', 'in_progress', 'review', 'blocked'])
      .in('user_id', userIds)

    // Đếm workload cho mỗi user
    const userWorkloadMap = new Map<string, number>()
    currentWorkloads?.forEach(item => {
      if (item.user_id) {
        userWorkloadMap.set(
          item.user_id,
          (userWorkloadMap.get(item.user_id) || 0) + 1
        )
      }
    })

    // === BƯỚC 5: TẠO DANH SÁCH USERS CHO THUẬT TOÁN ===
    const availableUsers: User[] = projectMembers.map(pm => {
      const user = pm.users as any
      return {
        id: pm.user_id,
        name: user.full_name,
        current_workload: userWorkloadMap.get(pm.user_id) || 0,
        max_concurrent_tasks: max_concurrent_tasks
      }
    })

    // === BƯỚC 6: XÂY DỰNG EXPERIENCE MATRIX ===
    const experienceMatrix = await buildExperienceMatrix(
      userIds,
      Array.from(allSkills),
    )

    // === BƯỚC 7: TẠO DANH SÁCH TASKS CHO THUẬT TOÁN ===
    const algorithmTasks: Task[] = tasksData.map(task => ({
      id: task.id,
      name: task.name,
      required_skills: taskSkillsMap.get(task.id) || [],
      priority: 1, // Có thể tính từ task properties
      estimated_hours: 8 // Có thể lấy từ task duration
    }))

    // === BƯỚC 8: SỬ DỤNG HUNGARIAN ASSIGNMENT ===
    const assignments = constrainedHungarianAssignment(
      algorithmTasks,
      availableUsers,
      experienceMatrix,
      max_concurrent_tasks
    )

    // === BƯỚC 9: LƯU KẾT QUẢ PHÂN CÔNG VÀO DATABASE ===
    const results = []
    const errors = []

    for (const assignment of assignments) {
      try {
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

    return NextResponse.json({
      success: true,
      message: `Đã phân công ${results.length}/${tasksData.length} công việc`,
      assignments: results,
      unassigned: unassignedTasks,
      errors: errors,
      debug: {
        total_tasks: tasksData.length,
        total_users: availableUsers.length,
        available_users: availableUsers.filter(u => u.current_workload < max_concurrent_tasks).length,
        algorithm_used: 'experience_matrix + constrained_hungarian'
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

// GET endpoint để xem preview phân công mà không lưu vào DB
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { id: projectId } = params
  const { searchParams } = new URL(req.url)
  const taskIds = searchParams.get('task_ids')?.split(',') || []

  if (taskIds.length === 0) {
    return NextResponse.json(
      { error: 'Cần cung cấp task_ids trong query params' },
      { status: 400 }
    )
  }

  try {
    // Sử dụng logic tương tự như POST nhưng không lưu vào DB
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('id, name, template_id, task_skills(skill_id)')
      .in('id', taskIds)
      .eq('project_id', projectId)

    if (!tasksData || tasksData.length === 0) {
      return NextResponse.json({
        preview: [],
        message: 'Không tìm thấy tasks'
      })
    }

    // Logic tương tự như POST...
    // (Có thể extract thành helper function để tái sử dụng)

    return NextResponse.json({
      preview: [], // Kết quả preview
      message: 'Đây là preview, chưa lưu vào database'
    })

  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
}
