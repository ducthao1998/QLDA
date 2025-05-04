import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !authUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  }

  const { id } = params

  // Get current user's org_unit and position
  const { data: currentUser, error: userError } = await supabase
    .from("users")
    .select("org_unit, position")
    .eq("id", authUser.id)
    .single()

  if (userError || !currentUser) {
    return NextResponse.json({ error: "Không thể lấy thông tin người dùng" }, { status: 500 })
  }

  // Lấy thông tin chi tiết dự án
  const { data: project, error } = await supabase
    .from("projects")
    .select(`
      *,
      users!created_by (
        full_name,
        position,
        org_unit
      )
    `)
    .eq("id", id)
    .eq("users.org_unit", currentUser.org_unit)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!project) {
    return NextResponse.json({ error: "Không tìm thấy dự án hoặc bạn không có quyền truy cập" }, { status: 404 })
  }

  return NextResponse.json({ 
    project,
    userPermissions: {
      canEdit: currentUser.position === "quản lý",
      canDelete: currentUser.position === "quản lý"
    }
  })
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  }

  // Check if user has permission to edit projects
  const { data: currentUser, error: userError } = await supabase
    .from("users")
    .select("position, org_unit")
    .eq("id", authUser.id)
    .single()

  if (userError || !currentUser) {
    return NextResponse.json({ error: "Không thể lấy thông tin người dùng" }, { status: 500 })
  }

  if (currentUser.position !== "quản lý") {
    return NextResponse.json({ error: "Bạn không có quyền chỉnh sửa dự án" }, { status: 403 })
  }

  const { id } = await params

  try {
    const body = await request.json()

    // Get current project data
    const { data: currentProject, error: fetchError } = await supabase
      .from("projects")
      .select(`
        *,
        users!created_by (
          org_unit
        )
      `)
      .eq("id", id)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Check if project belongs to user's org_unit
    if (currentProject.users.org_unit !== currentUser.org_unit) {
      return NextResponse.json({ error: "Bạn không có quyền chỉnh sửa dự án của đơn vị khác" }, { status: 403 })
    }

    // Merge current data with new data, only update fields that are provided
    const updateData = {
      name: body.name ?? currentProject.name,
      description: body.description ?? currentProject.description,
      start_date: body.start_date ?? currentProject.start_date,
      end_date: body.end_date ?? currentProject.end_date,
      status: body.status ?? currentProject.status,
    }

    // Update project
    const { data, error } = await supabase
      .from("projects")
      .update(updateData)
      .eq("id", id)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ project: data[0] })
  } catch (error) {
    console.error("Error updating project:", error)
    return NextResponse.json({ error: "Lỗi khi cập nhật dự án" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  }

  // Check if user has permission to delete projects
  const { data: currentUser, error: userError } = await supabase
    .from("users")
    .select("position, org_unit")
    .eq("id", authUser.id)
    .single()

  if (userError || !currentUser) {
    return NextResponse.json({ error: "Không thể lấy thông tin người dùng" }, { status: 500 })
  }

  if (currentUser.position !== "quản lý") {
    return NextResponse.json({ error: "Bạn không có quyền xóa dự án" }, { status: 403 })
  }

  const { id } = params

  // Get project to check org_unit
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

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 })
  }

  if (!project) {
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 })
  }

  // Check if project belongs to user's org_unit
  if (project.users.org_unit !== currentUser.org_unit) {
    return NextResponse.json({ error: "Bạn không có quyền xóa dự án của đơn vị khác" }, { status: 403 })
  }

  // Delete project
  const { error: deleteError } = await supabase.from("projects").delete().eq("id", id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
