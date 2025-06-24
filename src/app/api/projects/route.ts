import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '10', 10)
  const offset = (page - 1) * limit

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  // Lấy thông tin đơn vị và chức vụ của người dùng hiện tại
  const { data: currentUser, error: userError } = await supabase
    .from('users')
    .select('org_unit, position')
    .eq('id', authUser.id)
    .single()

  if (userError || !currentUser) {
    return NextResponse.json(
      { error: 'Không thể lấy thông tin người dùng' },
      { status: 500 },
    )
  }

  // Lấy danh sách dự án thuộc đơn vị của người dùng (có phân trang)
  const {
    data: projects,
    error,
    count,
  } = await supabase
    .from('projects')
    .select(
      `
      id, name, description, start_date, end_date, status, classification, project_field, created_by,
      users!created_by (full_name, org_unit, position)
    `,
      { count: 'exact' },
    )
    .eq('users.org_unit', currentUser.org_unit)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Xác định quyền hạn dựa trên chức vụ
  const userPosition = currentUser.position?.toLowerCase() || ''
  const canManage = [
    'quản lý',
    'trưởng phòng',
    'chỉ huy',
    'team lead',
    'project manager',
  ].some(pos => userPosition.includes(pos))

  // SỬA LỖI: Trả về đối tượng với key là "projects" để khớp với component `ProjectsList`
  return NextResponse.json({
    projects: projects, // Thay vì "data", dùng "projects"
    count,
    userPermissions: {
      canCreate: canManage,
      canEdit: canManage,
      canDelete: userPosition.includes('quản lý'),
    },
  })
}

// Hàm POST đã được sửa lỗi và hoàn thiện
export async function POST(req: Request) {
  const supabase = await createClient()

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
    console.log(currentUser)
    console.log("alo")
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
        { error: 'Bạn không có quyền tạo dự án' },
        { status: 403 },
      )
    }

    const body = await req.json()
    const {
      name,
      description,
      start_date,
      end_date,
      status,
      classification,
      project_field,
    } = body

    if (!name || !project_field || !classification) {
      return NextResponse.json(
        { error: 'Tên dự án, lĩnh vực và phân loại là bắt buộc' },
        { status: 400 },
      )
    }

    // SỬA LỖI: Đảm bảo 'created_by' được gán bằng ID của người dùng đã xác thực.
    // Đây là bước quan trọng nhất để sửa lỗi và liên kết dự án với người tạo.
    const { data: newProject, error: insertError } = await supabase
      .from('projects')
      .insert({
        name,
        description,
        start_date,
        end_date,
        status,
        classification,
        project_field,
        created_by: authUser.id, // Gán ID của người dùng đã xác thực
      })
      .select()
      .single()

    if (insertError) {
        console.error("Lỗi khi chèn dự án mới:", insertError);
        throw insertError;
    }

    if (newProject) {
      const { error: templateError } = await supabase.rpc(
        'create_tasks_from_templates',
        {
          p_project_id: newProject.id,
          p_project_field: project_field,
          p_project_classification: classification,
        },
      )
      if (templateError) {
        console.error('Lỗi khi tạo task từ template:', templateError)
      }
    }

    return NextResponse.json({ project: newProject }, { status: 201 })
  } catch (error: any) {
    console.error("Lỗi trong hàm POST:", error);
    return NextResponse.json({ error: 'Lỗi khi tạo dự án' }, { status: 500 })
  }
}
