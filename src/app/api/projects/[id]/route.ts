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
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!project) {
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 })
  }

  return NextResponse.json({ project })
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

  const { id } = await params

  try {
    const body = await request.json()

    // Get current project data
    const { data: currentProject, error: fetchError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
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

  const { id } = params

  // Kiểm tra quyền xóa dự án (ví dụ: chỉ người tạo hoặc admin mới được xóa)
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("created_by")
    .eq("id", id)
    .single()

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 })
  }

  if (!project) {
    return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 })
  }

  // Kiểm tra quyền (ví dụ: chỉ người tạo mới được xóa)
  // Trong thực tế, bạn có thể cần kiểm tra vai trò người dùng
  if (project.created_by !== authUser.id) {
    return NextResponse.json({ error: "Không có quyền xóa dự án này" }, { status: 403 })
  }

  // Xóa dự án
  const { error: deleteError } = await supabase.from("projects").delete().eq("id", id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
