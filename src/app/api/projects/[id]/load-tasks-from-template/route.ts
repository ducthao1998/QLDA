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
    
    // SỬA LỖI: Lấy projectId trực tiếp từ params
    const projectId = params.id

    // 1. Lấy thông tin phân loại của dự án
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('classification') // Chỉ cần lấy 'classification'
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Không tìm thấy dự án.' },
        { status: 404 },
      )
    }

    if (!project.classification) {
      return NextResponse.json(
        { error: 'Dự án thiếu thông tin Phân loại.' },
        { status: 400 },
      )
    }

    // 2. Gọi RPC function đã được cập nhật với đúng số lượng tham số
    const { error: rpcError } = await supabase.rpc(
      'create_tasks_from_templates',
      {
        // SỬA LỖI: Đã loại bỏ p_project_field
        p_project_id: projectId,
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
