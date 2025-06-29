import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Lấy danh sách công việc cho một dự án
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()
    const projectId = params.id;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SỬA LỖI: Đơn giản hóa câu truy vấn để chỉ lấy các trường cần thiết cho trang lịch.
    // Điều này giúp tránh các lỗi join phức tạp và tăng hiệu suất.
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select(
        `
        id,
        name,
        status,
        start_date,
        end_date,
        phase_id,
        project_id,
        task_raci (
          role,
          users (
            id,
            full_name,
            position
          )
        )
      `,
      )
      .eq('project_id', projectId)
      .order('start_date', { ascending: true, nullsFirst: false }); // Sắp xếp theo ngày bắt đầu

    if (tasksError) {
      console.error('Lỗi khi lấy danh sách công việc:', tasksError)
      return NextResponse.json({ error: tasksError.message }, { status: 500 })
    }

    // Trả về dữ liệu đã được đơn giản hóa
    return NextResponse.json({ data: tasks })
    
  } catch (error: any) {
    console.error('Lỗi trong GET /api/projects/[id]/tasks:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}

// Hàm POST giữ nguyên để không ảnh hưởng đến các chức năng khác
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()
    const projectId = params.id
    const { template_ids } = (await req.json()) as { template_ids?: number[] }

    if (
      !template_ids ||
      !Array.isArray(template_ids) ||
      template_ids.length === 0
    ) {
      return NextResponse.json(
        { error: 'Cần cung cấp một mảng template_ids.' },
        { status: 400 },
      )
    }

    const { data: templates, error: templateError } = await supabase
      .from('task_templates')
      .select('*')
      .in('id', template_ids)

    if (templateError) throw templateError;
    if (!templates || templates.length === 0) {
      return NextResponse.json(
        { error: 'Không tìm thấy các mẫu được chọn.' },
        { status: 404 },
      )
    }

    // Giả sử template có thuộc tính `phase` để map với `project_phases`
    const phaseNames = templates.map((t: any) => t.phase).filter(Boolean);
    const { data: phases, error: phasesError } = await supabase
      .from('project_phases')
      .select('id, name')
      .eq('project_id', projectId)
      .in('name', phaseNames)

    if (phasesError) throw phasesError;

    const phaseMap = new Map(phases?.map(p => [p.name, p.id]));

    const newTasks = templates.map((template: any) => ({
      project_id: projectId,
      name: template.name,
      note: template.description,
      status: 'todo' as const,
      template_id: template.id,
      phase_id: phaseMap.get(template.phase),
    }))

    const { data, error: insertError } = await supabase
      .from('tasks')
      .insert(newTasks)
      .select()

    if (insertError) throw insertError

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    console.error('Error creating tasks from template:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
