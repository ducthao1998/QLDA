import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()
  console.log ("AAA");
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

  const { id } = params

  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.description || !body.start_date || !body.deadline || !body.priority || !body.status) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
    }

    // Update project
    const { data, error } = await supabase
      .from("projects")
      .update({
        name: body.name,
        description: body.description,
        start_date: body.start_date,
        deadline: body.deadline,
        priority: body.priority,
        status: body.status,
      })
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
