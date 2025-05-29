import { ProjectPhase } from '@/app/types/table-types'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    // Get current user's org_unit and position
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("org_unit, position")
      .eq("id", authUser.id)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json({ error: "Không thể lấy thông tin người dùng" }, { status: 500 })
    }

    // Check if project belongs to user's org_unit
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(`
        *,
        users!created_by (
          org_unit
        )
      `)
      .eq("id", id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 })
    }

    if (project.users.org_unit !== currentUser.org_unit) {
      return NextResponse.json({ error: "Bạn không có quyền truy cập dự án này" }, { status: 403 })
    }

    const { data: phases, error } = await supabase
      .from('project_phases')
      .select('*')
      .eq('project_id', id)
      .order('order_no', { ascending: true })

    if (error) {
      console.error('Error fetching phases:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      phases: phases as ProjectPhase[],
      userPermissions: {
        canEdit: currentUser.position?.toLowerCase() === "quản lý",
        canDelete: currentUser.position?.toLowerCase() === "quản lý"
      }
    })
  } catch (error) {
    console.error('Unexpected error in GET phases:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    // Check if user has permission to create phases
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("position, org_unit")
      .eq("id", authUser.id)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json({ error: "Không thể lấy thông tin người dùng" }, { status: 500 })
    }

    if (currentUser.position?.toLowerCase() !== "quản lý") {
      return NextResponse.json({ error: "Bạn không có quyền tạo giai đoạn" }, { status: 403 })
    }

    // Check if project belongs to user's org_unit
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(`
        *,
        users!created_by (
          org_unit
        )
      `)
      .eq("id", id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 })
    }

    if (project.users.org_unit !== currentUser.org_unit) {
      return NextResponse.json({ error: "Bạn không có quyền tạo giai đoạn cho dự án này" }, { status: 403 })
    }

    const body = await request.json()
    const { data: phase, error } = await supabase
      .from('project_phases')
      .insert({
        ...body,
        project_id: id
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating phase:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ phase })
  } catch (error) {
    console.error('Unexpected error in POST phase:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    // Check if user has permission to edit phases
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("position, org_unit")
      .eq("id", authUser.id)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json({ error: "Không thể lấy thông tin người dùng" }, { status: 500 })
    }

    if (currentUser.position?.toLowerCase() !== "quản lý") {
      return NextResponse.json({ error: "Bạn không có quyền chỉnh sửa giai đoạn" }, { status: 403 })
    }

    // Check if project belongs to user's org_unit
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(`
        *,
        users!created_by (
          org_unit
        )
      `)
      .eq("id", id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 })
    }

    if (project.users.org_unit !== currentUser.org_unit) {
      return NextResponse.json({ error: "Bạn không có quyền chỉnh sửa giai đoạn của dự án này" }, { status: 403 })
    }

    const body = await request.json()
    const { data: phase, error } = await supabase
      .from('project_phases')
      .update(body)
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating phase:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ phase })
  } catch (error) {
    console.error('Unexpected error in PUT phase:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    // Check if user has permission to delete phases
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("position, org_unit")
      .eq("id", authUser.id)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json({ error: "Không thể lấy thông tin người dùng" }, { status: 500 })
    }

    if (currentUser.position?.toLowerCase() !== "quản lý") {
      return NextResponse.json({ error: "Bạn không có quyền xóa giai đoạn" }, { status: 403 })
    }

    // Check if project belongs to user's org_unit
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(`
        *,
        users!created_by (
          org_unit
        )
      `)
      .eq("id", id)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 })
    }

    if (project.users.org_unit !== currentUser.org_unit) {
      return NextResponse.json({ error: "Bạn không có quyền xóa giai đoạn của dự án này" }, { status: 403 })
    }

    const url = new URL(request.url)
    const phaseId = url.searchParams.get('phaseId')

    if (!phaseId) {
      return NextResponse.json({ error: 'Phase ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('project_phases')
      .delete()
      .eq('id', phaseId)

    if (error) {
      console.error('Error deleting phase:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error in DELETE phase:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}