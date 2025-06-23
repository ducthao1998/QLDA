import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  req: Request,
  { params }: { params: { id: string; taskId: string } },
) {
  const supabase = await createClient()
  const { taskId } = params

  try {
    // === BƯỚC 1: LẤY KỸ NĂNG YÊU CẦU CỦA CÔNG VIỆC ===
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('template_id')
      .eq('id', taskId)
      .single()

    if (taskError || !taskData || !taskData.template_id) {
      return NextResponse.json(
        { error: 'Không tìm thấy công việc hoặc công việc không có mẫu.' },
        { status: 404 },
      )
    }

    const { data: templateData, error: templateError } = await supabase
      .from('task_templates')
      .select('required_skill_id')
      .eq('id', taskData.template_id)
      .single()

    if (templateError || !templateData || !templateData.required_skill_id) {
      return NextResponse.json(
        {
          error:
            'Không tìm thấy kỹ năng yêu cầu cho công việc này trong mẫu.',
        },
        { status: 404 },
      )
    }

    const requiredSkillId = templateData.required_skill_id

    // === BƯỚC 2: LẤY DANH SÁCH USER CÓ KINH NGHIỆM VÀ KHỐI LƯỢNG CÔNG VIỆC HIỆN TẠI ===

    // Lấy danh sách user có kinh nghiệm liên quan từ view user_skill_matrix
    const { data: skilledUsers, error: matrixError } = await supabase
      .from('user_skill_matrix')
      .select('user_id, full_name, completed_tasks_count')
      .eq('skill_id', requiredSkillId)

    if (matrixError) throw matrixError
    if (!skilledUsers || skilledUsers.length === 0) {
      return NextResponse.json([]) // Trả về mảng rỗng nếu không ai có kỹ năng
    }

    // Lấy khối lượng công việc hiện tại (các task chưa xong) của tất cả user
    const { data: workloads, error: workloadError } = await supabase
      .from('tasks')
      .select('assigned_to, status')
      .in('status', ['todo', 'in_progress', 'blocked', 'review'])
      .not('assigned_to', 'is', null)

    if (workloadError) throw workloadError

    // Đếm số công việc hiện tại cho mỗi user
    const userWorkloadMap = new Map<string, number>()
    workloads?.forEach(task => {
      if (task.assigned_to) {
        userWorkloadMap.set(
          task.assigned_to,
          (userWorkloadMap.get(task.assigned_to) || 0) + 1,
        )
      }
    })

    // === BƯỚC 3: KẾT HỢP DỮ LIỆU VÀ SẮP XẾP ===
    const recommendedUsers = skilledUsers
      .map(user => {
        const workload = userWorkloadMap.get(user.user_id) || 0
        return {
          ...user,
          workload,
        }
      })
      // Lọc ra những người đang có dưới 2 việc
      .filter(user => user.workload < 2)
      // Sắp xếp theo tiêu chí: kinh nghiệm cao nhất, sau đó đến khối lượng công việc thấp nhất
      .sort((a, b) => {
        // Ưu tiên người có nhiều kinh nghiệm hơn
        if (a.completed_tasks_count !== b.completed_tasks_count) {
          return b.completed_tasks_count - a.completed_tasks_count
        }
        // Nếu kinh nghiệm bằng nhau, ưu tiên người ít việc hơn
        return a.workload - b.workload
      })

    return NextResponse.json(recommendedUsers)
  } catch (error: any) {
    console.error('Lỗi khi đề xuất người thực hiện:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
