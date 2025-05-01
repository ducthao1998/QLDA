import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Kiểm tra xác thực
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const id = await params.id
    // Lấy danh sách nhiệm vụ của dự án
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id")
      .eq("project_id", id)

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError)
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
    }

    // Lấy danh sách RACI cho các nhiệm vụ
    const { data: raci, error: raciError } = await supabase
      .from("task_raci")
      .select(`
        *,
        users (
          full_name
        ),
        external_orgs (
          name
        )
      `)
      .in("task_id", tasks.map(t => t.id))

    if (raciError) {
      console.error("Error fetching RACI:", raciError)
      return NextResponse.json({ error: "Failed to fetch RACI" }, { status: 500 })
    }

    return NextResponse.json({ raci })
  } catch (error) {
    console.error("Error in RACI route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  }
  const id = await params.id
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.task_id || !body.role || (!body.user_id && !body.external_org_id)) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
    }

    // Kiểm tra xem nhiệm vụ có thuộc dự án không
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", body.task_id)
      .eq("project_id", id)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: "Nhiệm vụ không thuộc dự án này" }, { status: 400 })
    }

    // Kiểm tra xem đã tồn tại bản ghi RACI cho task và user/org này chưa
    const { data: existingRaci, error: existingError } = await supabase
      .from("task_raci")
      .select("id")
      .eq("task_id", body.task_id)
      .eq(body.user_id ? "user_id" : "external_org_id", body.user_id || body.external_org_id)

    if (existingRaci && existingRaci.length > 0) {
      // Cập nhật bản ghi hiện có
      const { data, error } = await supabase
        .from("task_raci")
        .update({
          role: body.role,
        })
        .eq("id", existingRaci[0].id)
        .select()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ raci: data[0] })
    } else {
      // Thêm bản ghi mới
      const { data, error } = await supabase
        .from("task_raci")
        .insert({
          task_id: body.task_id,
          user_id: body.user_id || null,
          external_org_id: body.external_org_id || null,
          role: body.role,
        })
        .select()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ raci: data[0] }, { status: 201 })
    }
  } catch (error) {
    console.error("Error creating RACI:", error)
    return NextResponse.json({ error: "Lỗi khi tạo RACI" }, { status: 500 })
  }
}
