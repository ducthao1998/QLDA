import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const projectId = params.id

  try {
    // Bước 1: Lấy thông tin phân loại của dự án.
    const { data: project, error: projectError } = await supabase
      .from('projects')
      // SỬA LỖI: Chỉ cần lấy cột 'classification'.
      .select('classification')
      .eq('id', projectId)
      .single()

    if (projectError || !project || !project.classification) {
      return NextResponse.json({ error: 'Không tìm thấy dự án hoặc dự án thiếu thông tin phân loại.' }, { status: 404 })
    }

    // Bước 2: Lấy danh sách template_id của các công việc đã tồn tại trong dự án để loại trừ.
    const { data: existingTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('template_id')
      .eq('project_id', projectId)
      .not('template_id', 'is', null)

    if (tasksError) throw tasksError

    const existingTemplateIds = existingTasks.map(t => t.template_id)

    // Bước 3: Lấy tất cả các công việc mẫu phù hợp.
    const query = supabase
      .from('task_templates')
      .select('id, name, description')
      // SỬA LỖI: Bỏ điều kiện lọc theo 'project_field' không tồn tại.
      // Câu truy vấn giờ chỉ lọc theo 'applicable_classification'.
      .or(
        `applicable_classification.cs.{"ALL"},applicable_classification.cs.{${project.classification}}`,
      )
      
    // Loại trừ những template đã được thêm vào dự án.
    if (existingTemplateIds.length > 0) {
      query.not('id', 'in', `(${existingTemplateIds.join(',')})`)
    }

    const { data: availableTemplates, error: templatesError } = await query

    if (templatesError) throw templatesError

    return NextResponse.json(availableTemplates)
  } catch (error: any) {
    console.error('Lỗi khi lấy danh sách mẫu có sẵn:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
