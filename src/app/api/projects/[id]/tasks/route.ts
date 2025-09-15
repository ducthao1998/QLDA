import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Lấy danh sách công việc cho một dự án
export async function GET(
  req: Request,
  ctx: { params: { id: string } },
) {
  try {
    const supabase = await createClient()
    const { id: projectId } = await ctx.params

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

// Tạo tasks từ templates với hỗ trợ dependencies
export async function POST(
  req: Request,
  ctx: { params: { id: string } },
) {
  try {
    const supabase = await createClient()
    const { id: projectId } = await ctx.params
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

    // Lấy templates với dependencies
    const { data: templates, error: templateError } = await supabase
      .from('task_templates')
      .select(`
        *,
        task_template_dependencies!task_template_dependencies_template_id_fkey (
          depends_on_template_id
        )
      `)
      .in('id', template_ids)

    if (templateError) throw templateError;
    if (!templates || templates.length === 0) {
      return NextResponse.json(
        { error: 'Không tìm thấy các mẫu được chọn.' },
        { status: 404 },
      )
    }

    // Lấy phases cho project
    // const { data: phases, error: phasesError } = await supabase
    //   .from('project_phases')
    //   .select('id, name')
    //   .eq('project_id', projectId)

    // if (phasesError) throw phasesError;

    // Tạo tasks theo thứ tự sequence_order để đảm bảo dependencies được tạo đúng
    const sortedTemplates = templates.sort((a, b) => a.sequence_order - b.sequence_order)
    const createdTasks: any[] = []
    const templateToTaskMap = new Map<number, string>() // template_id -> task_id

    for (const template of sortedTemplates) {
      // Tạo task từ template
      const newTask = {
        project_id: projectId,
        name: template.name,
        note: template.description,
        status: 'todo' as const,
        template_id: template.id,
        duration_days: template.default_duration_days,
        // Tạm thời không set phase_id, có thể cập nhật sau
        // phase_id: phases?.[0]?.id || null,
      }

      const { data: insertedTask, error: insertError } = await supabase
        .from('tasks')
        .insert(newTask)
        .select()
        .single()

      if (insertError) throw insertError

      createdTasks.push(insertedTask)
      templateToTaskMap.set(template.id, insertedTask.id)

      // Tạo dependencies cho task này
      if (template.task_template_dependencies && template.task_template_dependencies.length > 0) {
        const taskDependencies = template.task_template_dependencies
          .map((dep: any) => {
            const dependsOnTaskId = templateToTaskMap.get(dep.depends_on_template_id)
            if (dependsOnTaskId) {
              return {
                task_id: insertedTask.id,
                depends_on_id: dependsOnTaskId,
              }
            }
            return null
          })
          .filter(Boolean)

        if (taskDependencies.length > 0) {
          const { error: depError } = await supabase
            .from('task_dependencies')
            .insert(taskDependencies)

          if (depError) {
            console.error('Error creating task dependencies:', depError)
            // Không throw error để không làm gián đoạn việc tạo tasks
          }
        }
      }

      // Tạo task skills nếu template có skills
      const { data: templateSkills, error: skillsError } = await supabase
        .from('task_template_skills')
        .select('skill_id')
        .eq('template_id', template.id)

      if (!skillsError && templateSkills && templateSkills.length > 0) {
        const taskSkills = templateSkills.map((ts: any) => ({
          task_id: insertedTask.id,
          skill_id: ts.skill_id,
        }))

        const { error: taskSkillError } = await supabase
          .from('task_skills')
          .insert(taskSkills)

        if (taskSkillError) {
          console.error('Error creating task skills:', taskSkillError)
          // Không throw error để không làm gián đoạn việc tạo tasks
        }
      }
    }

    return NextResponse.json(createdTasks, { status: 201 })
  } catch (error: any) {
    console.error('Error creating tasks from template:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
