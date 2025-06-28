import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  req: Request,
  { params }: { params: { projectId: string; taskId: string } },
) {
  const supabase = await createClient()
  const { taskId } = params

  try {
    // === BƯỚC 1: LẤY KỸ NĂNG YÊU CẦU CỦA CÔNG VIỆC ===
    
    // Lấy template_id từ task
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('template_id, name')
      .eq('id', taskId)
      .single()

    if (taskError || !taskData) {
      return NextResponse.json(
        { error: 'Không tìm thấy công việc.' },
        { status: 404 },
      )
    }

    let requiredSkillId = null

    // Nếu có template_id, lấy required_skill_id từ template
    if (taskData.template_id) {
      const { data: templateData, error: templateError } = await supabase
        .from('task_templates')
        .select('required_skill_id')
        .eq('id', taskData.template_id)
        .single()

      if (!templateError && templateData?.required_skill_id) {
        requiredSkillId = templateData.required_skill_id
      }
    }

    // Nếu không có required_skill_id từ template, 
    // thử lấy skill_id từ task_skills của chính task này
    if (!requiredSkillId) {
      const { data: taskSkills } = await supabase
        .from('task_skills')
        .select('skill_id')
        .eq('task_id', taskId)
        .limit(1)
        .single()

      if (taskSkills?.skill_id) {
        requiredSkillId = taskSkills.skill_id
      }
    }

    // === BƯỚC 2: LẤY DANH SÁCH USER VÀ TÍNH WORKLOAD ===

    if (requiredSkillId) {
      // Có skill requirement - lấy từ user_skill_matrix
      const { data: skilledUsers, error: matrixError } = await supabase
        .from('user_skill_matrix')
        .select('user_id, full_name, completed_tasks_count')
        .eq('skill_id', requiredSkillId)
        .gt('completed_tasks_count', 0) // Chỉ lấy người đã có kinh nghiệm

      if (matrixError) throw matrixError

      // Lấy khối lượng công việc hiện tại từ task_raci
      // Đếm số task mà mỗi user đang làm (role = 'R' và task chưa hoàn thành)
      const { data: currentWorkloads, error: workloadError } = await supabase
        .from('task_raci')
        .select(`
          user_id,
          tasks!inner(
            id,
            status
          )
        `)
        .eq('role', 'R')
        .in('tasks.status', ['todo', 'in_progress', 'review', 'blocked'])

      if (workloadError) throw workloadError

      // Đếm workload cho mỗi user
      const userWorkloadMap = new Map<string, number>()
      currentWorkloads?.forEach(item => {
        if (item.user_id) {
          userWorkloadMap.set(
            item.user_id,
            (userWorkloadMap.get(item.user_id) || 0) + 1,
          )
        }
      })

      // Kết hợp dữ liệu và sắp xếp
      const recommendedUsers = (skilledUsers || [])
        .map(user => ({
          user_id: user.user_id,
          full_name: user.full_name,
          completed_tasks_count: user.completed_tasks_count,
          workload: userWorkloadMap.get(user.user_id) || 0,
        }))
        .filter(user => user.workload < 2) // Chỉ người có < 2 việc
        .sort((a, b) => {
          // Ưu tiên kinh nghiệm
          if (a.completed_tasks_count !== b.completed_tasks_count) {
            return b.completed_tasks_count - a.completed_tasks_count
          }
          // Sau đó ưu tiên ít việc
          return a.workload - b.workload
        })
        .slice(0, 5) // Top 5

      return NextResponse.json({ 
        data: recommendedUsers,
        debug: {
          task_name: taskData.name,
          required_skill_id: requiredSkillId,
          total_skilled_users: skilledUsers?.length || 0,
          filtered_users: recommendedUsers.length
        }
      })

    } else {
      // Không có skill requirement - tìm dựa trên lịch sử làm task tương tự
      
      // Tìm users đã hoàn thành tasks có tên tương tự
      const searchTerm = taskData.name.split(' ')[0] // Lấy từ đầu tiên
      
      // Lấy lịch sử từ task_raci của các task đã done có tên tương tự
      const { data: historicalData, error: historyError } = await supabase
        .from('task_raci')
        .select(`
          user_id,
          users!inner(
            id,
            full_name
          ),
          tasks!inner(
            id,
            name,
            status
          )
        `)
        .eq('role', 'R')
        .eq('tasks.status', 'done')
        .ilike('tasks.name', `%${searchTerm}%`)

      if (historyError) throw historyError

      // Đếm số lần mỗi user hoàn thành task tương tự
      const userCompletionMap = new Map<string, { full_name: string, count: number }>()
      historicalData?.forEach(item => {
        if (item.user_id && item.users) {
          const existing = userCompletionMap.get(item.user_id)
          if (existing) {
            existing.count++
          } else {
            userCompletionMap.set(item.user_id, {
              full_name: (item.users as any).full_name,
              count: 1
            })
          }
        }
      })

      // Lấy workload hiện tại
      const { data: currentWorkloads } = await supabase
        .from('task_raci')
        .select(`
          user_id,
          tasks!inner(status)
        `)
        .eq('role', 'R')
        .in('tasks.status', ['todo', 'in_progress', 'review', 'blocked'])

      const workloadMap = new Map<string, number>()
      currentWorkloads?.forEach(item => {
        if (item.user_id) {
          workloadMap.set(
            item.user_id,
            (workloadMap.get(item.user_id) || 0) + 1
          )
        }
      })

      // Chuyển thành array và filter
      const recommendedUsers = Array.from(userCompletionMap.entries())
        .map(([user_id, data]) => ({
          user_id,
          full_name: data.full_name,
          completed_tasks_count: data.count,
          workload: workloadMap.get(user_id) || 0,
        }))
        .filter(user => user.workload < 2)
        .sort((a, b) => {
          if (a.completed_tasks_count !== b.completed_tasks_count) {
            return b.completed_tasks_count - a.completed_tasks_count
          }
          return a.workload - b.workload
        })
        .slice(0, 5)

      return NextResponse.json({ 
        data: recommendedUsers,
        debug: {
          task_name: taskData.name,
          search_term: searchTerm,
          based_on: 'historical_similar_tasks'
        }
      })
    }

  } catch (error: any) {
    console.error('Lỗi khi đề xuất người thực hiện:', error)
    return NextResponse.json({ 
      error: error.message,
      data: [] // Always return data array
    }, { status: 500 })
  }
}