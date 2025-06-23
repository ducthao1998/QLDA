import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const projectId = params.id

    // 1. Lấy thông tin lĩnh vực và phân loại của dự án
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('project_field, classification')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Không tìm thấy dự án.' },
        { status: 404 },
      )
    }

    if (!project.project_field || !project.classification) {
        return NextResponse.json(
            { error: 'Dự án thiếu thông tin Lĩnh vực hoặc Phân loại.' },
            { status: 400 },
          )
    }

    // 2. Gọi RPC function để tạo tasks từ templates
    const { error: rpcError } = await supabase.rpc(
      'create_tasks_from_templates',
      {
        p_project_id: projectId,
        p_project_field: project.project_field,
        p_project_classification: project.classification,
      },
    )

    if (rpcError) {
      console.error('Lỗi khi gọi RPC create_tasks_from_templates:', rpcError)
      throw rpcError
    }

    return NextResponse.json(
      { message: 'Công việc đã được tạo thành công từ mẫu.' },
      { status: 200 },
    )
  } catch (error: any) {
    console.error('Lỗi server:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
