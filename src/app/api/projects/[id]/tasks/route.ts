import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Lấy danh sách công việc cho một dự án
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()
    const projectId = (await params).id;

    // Lấy thông tin xác thực
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SỬA LỖI: Thay thế join "task_skills" bằng "task_templates"
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select(
        `
        *,
        users:assigned_to (
          full_name,
          position,
          org_unit
        ),
        task_templates (
          required_skill_id,
          skills (
            id,
            name,
            field
          )
        )
      `,
      )
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError)
      return NextResponse.json({ error: tasksError.message }, { status: 500 })
    }

    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Error in GET /api/projects/[id]/tasks:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}

// Tạo công việc mới từ danh sách template IDs
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()
    const projectId = (await params).id
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

    const phaseNames = templates.map(t => t.phase)
    const { data: phases, error: phasesError } = await supabase
      .from('project_phases')
      .select('id, name')
      .eq('project_id', projectId)
      .in('name', phaseNames)

    if (phasesError) throw phasesError;

    const phaseMap = new Map(phases.map(p => [p.name, p.id]));

    const newTasks = templates.map(template => ({
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
