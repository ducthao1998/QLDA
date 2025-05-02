import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  try {
    const { id } = params

    const { data, error } = await supabase
      .from("worklogs")
      .select(`
        id,
        task_id,
        user_id,
        spent_hours,
        log_date,
        note,
        users (
          full_name,
          position
        )
      `)
      .eq("task_id", id)
      .order("log_date", { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ worklogs: data })
  } catch (error) {
    console.error("Error fetching worklogs:", error)
    return NextResponse.json({ error: "Không thể lấy nhật ký công việc" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = params
  const body = await request.json()

  try {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 })
    }

    // Thêm kiểm tra "is_system" flag để chỉ cho phép hệ thống thêm worklog
    // Nếu không có flag này và không phải là admin, từ chối yêu cầu
    if (!body.is_system) {
      // Kiểm tra xem người dùng có phải là admin không
      const { data: userData } = await supabase.from("users").select("position").eq("id", user.id).single()

      const isAdmin = userData?.position?.toLowerCase().includes("quản lý")

      if (!isAdmin) {
        return NextResponse.json({ error: "Chỉ hệ thống hoặc quản lý mới có quyền thêm worklog" }, { status: 403 })
      }
    }

    // Validate required fields
    if (!body.spent_hours || !body.log_date) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
    }

    // Insert worklog record
    const { data, error } = await supabase
      .from("worklogs")
      .insert({
        task_id: id,
        user_id: body.user_id || user.id,
        spent_hours: body.spent_hours,
        log_date: body.log_date,
        note: body.note || null,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Record in task history
    await supabase.from("task_history").insert({
      task_id: id,
      user_id: user.id,
      action: "worklog_added",
      from_val: null,
      to_val: `${body.spent_hours} giờ`,
      at: new Date().toISOString(),
    })

    return NextResponse.json({ worklog: data })
  } catch (error) {
    console.error("Error recording worklog:", error)
    return NextResponse.json({ error: "Không thể ghi nhận nhật ký công việc" }, { status: 500 })
  }
}
