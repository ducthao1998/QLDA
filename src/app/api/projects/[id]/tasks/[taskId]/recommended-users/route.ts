import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { buildExperienceMatrix } from '@/algorithm/experience-matrix'
import { assignSingleTask, type User } from '@/algorithm/hungarian-assignment'

export async function GET(
  req: Request,
  { params }: { params: { projectId: string; taskId: string } },
) {
  const supabase = await createClient()
  const { projectId, taskId } = params

  try {
    // === BƯỚC 1: LẤY THÔNG TIN TASK VÀ KỸ NĂNG YÊU CẦU ===
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('id, name, template_id, project_id')
      .eq('id', taskId)
      .single()

    if (taskError || !taskData) {
      return NextResponse.json(
        { error: 'Không tìm thấy công việc.' },
        { status: 404 },
      )
    }

    // Lấy danh sách skills yêu cầu
    let requiredSkills: number[] = []

    // Từ template nếu có
    if (taskData.template_id) {
      const { data: templateData } = await supabase
        .from('task_templates')
        .select('required_skill_id')
        .eq('id', taskData.template_id)
        .single()

      if (templateData?.required_skill_id) {
        requiredSkills.push(templateData.required_skill_id)
      }
    }

    // Từ task_skills
    const { data: taskSkills } = await supabase
      .from('task_skills')
      .select('skill_id')
      .eq('task_id', taskId)

    if (taskSkills && taskSkills.length > 0) {
      const skillIds = taskSkills.map(ts => ts.skill_id).filter(id => id !== null)
      requiredSkills = [...new Set([...requiredSkills, ...skillIds])]
    }

    // === BƯỚC 2: LẤY DANH SÁCH USERS TRONG DỰ ÁN ===
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
        data: [],
        debug: { message: 'Không có thành viên nào trong dự án' }
      })
    }

    const userIds = projectMembers.map(pm => pm.user_id).filter(Boolean)

    // === BƯỚC 3: TÍNH WORKLOAD HIỆN TẠI CỦA TỪNG USER ===
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

    // === BƯỚC 4: TẠO DANH SÁCH USERS CHO THUẬT TOÁN ===
    const availableUsers: User[] = projectMembers
      .map(pm => {
        const user = pm.users as any
        return {
          id: pm.user_id,
          name: user.full_name,
          current_workload: userWorkloadMap.get(pm.user_id) || 0,
          max_concurrent_tasks: 2 // Có thể lấy từ user settings
        }
      })
      .filter(user => user.current_workload < 2) // Chỉ lấy người có thể nhận thêm việc

    if (availableUsers.length === 0) {
      return NextResponse.json({
        data: [],
        debug: { message: 'Tất cả thành viên đều đã bận (>= 2 công việc)' }
      })
    }

    // === BƯỚC 5: XÂY DỰNG EXPERIENCE MATRIX ===
    let experienceMatrix: any = {}
    
    if (requiredSkills.length > 0) {
      experienceMatrix = await buildExperienceMatrix(
        userIds,
        requiredSkills,
        taskId
      )
    }

    // === BƯỚC 6: SỬ DỤNG HUNGARIAN ASSIGNMENT ===
    const assignment = await assignSingleTask(
      taskId,
      requiredSkills,
      availableUsers,
      experienceMatrix,
      2 // maxConcurrentTasks
    )

    // === BƯỚC 7: TẠO DANH SÁCH ĐỀ XUẤT ===
    let recommendedUsers = []

    if (assignment) {
      // Sắp xếp users theo điểm số
      const scoredUsers = availableUsers.map(user => {
        const isAssigned = user.id === assignment.user_id
        
        // Tính experience score trung bình
        let avgExperience = 0
        if (requiredSkills.length > 0) {
          const experienceScores = requiredSkills.map(skillId => 
            experienceMatrix[user.id]?.[skillId] || 0
          )
          avgExperience = experienceScores.reduce((sum, score) => sum + score, 0) / experienceScores.length
        }

        return {
          user_id: user.id,
          full_name: user.name,
          completed_tasks_count: Math.round(avgExperience * 10), // Chuyển về số nguyên để hiển thị
          workload: user.current_workload,
          confidence_score: isAssigned ? assignment.confidence_score : 0,
          experience_score: avgExperience
        }
      })

      // Sắp xếp theo confidence score và experience
      recommendedUsers = scoredUsers
        .sort((a, b) => {
          if (Math.abs(a.confidence_score - b.confidence_score) > 0.01) {
            return b.confidence_score - a.confidence_score
          }
          if (Math.abs(a.experience_score - b.experience_score) > 0.01) {
            return b.experience_score - a.experience_score
          }
          return a.workload - b.workload
        })
        .slice(0, 5)

    } else {
      // Fallback: sắp xếp theo workload thấp nhất
      recommendedUsers = availableUsers
        .map(user => ({
          user_id: user.id,
          full_name: user.name,
          completed_tasks_count: 0,
          workload: user.current_workload,
          confidence_score: 0,
          experience_score: 0
        }))
        .sort((a, b) => a.workload - b.workload)
        .slice(0, 5)
    }

    return NextResponse.json({
      data: recommendedUsers,
      debug: {
        task_name: taskData.name,
        required_skills: requiredSkills,
        total_available_users: availableUsers.length,
        assignment_found: !!assignment,
        algorithm_used: requiredSkills.length > 0 ? 'experience_matrix + hungarian' : 'workload_based'
      }
    })

  } catch (error: any) {
    console.error('Lỗi khi đề xuất người thực hiện:', error)
    return NextResponse.json({
      error: error.message,
      data: []
    }, { status: 500 })
  }
}
