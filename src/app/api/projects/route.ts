import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  }

  // Lấy danh sách dự án
  const { data: projects, error } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      description,
      start_date,
      deadline,
      priority,
      status,
      created_by,
      users!created_by (
        full_name
      )
    `)
    .order("priority", { ascending: true })
    .order("deadline", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ projects })
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  }

  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.description || !body.start_date || !body.deadline || !body.priority || !body.status) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
    }

    // Insert new project
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: body.name,
        description: body.description,
        start_date: body.start_date,
        deadline: body.deadline,
        priority: body.priority,
        status: body.status,
        created_by: authUser.id,
      })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ project: data[0] }, { status: 201 })
  } catch (error) {
    console.error("Error creating project:", error)
    return NextResponse.json({ error: "Lỗi khi tạo dự án" }, { status: 500 })
  }
}
