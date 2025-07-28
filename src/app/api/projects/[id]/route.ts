import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET handler để lấy thông tin chi tiết của một dự án
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const param = await params
  try {
    const { data: project, error } = await supabase
      .from('projects')
      .select(
        `
        *,
        users!created_by (full_name, position, org_unit)
      `,
      )
      .eq('id', param.id)
      .single()

    if (error) {
      console.error(`Lỗi khi tải dự án ID ${params.id}:`, error)
      throw error
    }

    if (!project) {
      return NextResponse.json({ error: 'Không tìm thấy dự án' }, { status: 404 })
    }
 
    // Trả về dữ liệu được gói trong key 'project' để khớp với component frontend
    return NextResponse.json({ project })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT handler để cập nhật thông tin dự án
export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const param = await params
  try {
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('position')
      .eq('id', authUser.id)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json(
        { error: 'Không thể lấy thông tin người dùng' },
        { status: 500 },
      )
    }

    const allowedPositions = [
      'quản lý',
      'trưởng phòng',
      'chỉ huy',
      'team lead',
      'project manager',
    ]
    const userPosition = currentUser.position?.toLowerCase() || ''

    if (!allowedPositions.some(pos => userPosition.includes(pos))) {
      return NextResponse.json(
        { error: 'Bạn không có quyền cập nhật dự án' },
        { status: 403 },
      )
    }

    const body = await req.json()
    const {
      name,
      description,
      start_date,
      status,
      classification,
      project_field,
      total_investment,
    } = body

    if (!name || !project_field || !classification) {
      return NextResponse.json(
        { error: 'Tên dự án, lĩnh vực và phân loại là bắt buộc' },
        { status: 400 },
      )
    }

    const { data: updatedProject, error } = await supabase
      .from('projects')
      .update({
        name,
        description,
        start_date,
        status,
        classification,
        project_field,
        total_investment,
        updated_at: new Date().toISOString(),
      })
      .eq('id', param.id)
      .select()
      .single()

    if (error) {
      console.error('Lỗi khi cập nhật dự án:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!updatedProject) {
      return NextResponse.json({ error: 'Không tìm thấy dự án' }, { status: 404 })
    }

    return NextResponse.json({ project: updatedProject })
  } catch (error: any) {
    console.error('Lỗi trong PUT /api/projects/[id]:', error)
    return NextResponse.json({ error: 'Lỗi khi cập nhật dự án' }, { status: 500 })
  }
}

// DELETE handler để xóa một dự án
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } },
) {
    const supabase = await createClient();
    const projectId = await params;
    try {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId.id);
        if (error) throw error;
        return NextResponse.json({ message: 'Xóa dự án thành công' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
