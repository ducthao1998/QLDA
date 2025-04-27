import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string; taskId: string } }) {
  const supabase = await createClient()

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  }

  const { taskId } = params

  // Lấy thông tin chi tiết nhiệm vụ
  const { data: task, error } = await supabase
    .from("tasks")
    .select(`
      *,
      users!assigned_to:user_id (
        full_name,
        position,
        org_unit
      ),
      projects (
        name
      )
    `)
    .eq("id", taskId)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!task) {
    return NextResponse.json({ error: "Không tìm thấy nhiệm vụ" }, { status: 404 })
  }

  return NextResponse.json({ task })
}

export async function PUT(request: Request, { params }: { params: { id: string; taskId: string } }) {
  const supabase = await createClient()

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  }

  const { taskId } = params

  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.description || !body.status || !body.due_date) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
    }

    // Update task
    const { data, error } = await supabase
      .from("tasks")
      .update({
        name: body.name,
        description: body.description,
        status: body.status,
        estimate_low: body.estimate_low,
        estimate_high: body.estimate_high,
        weight: body.weight,
        due_date: body.due_date,
        risk_level: body.risk_level,
        complexity: body.complexity,
        max_rejections: body.max_rejections,
        user_id: body.user_id,
      })
      .eq("id", taskId)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task: data[0] })
  } catch (error) {
    console.error("Error updating task:", error)
    return NextResponse.json({ error: "Lỗi khi cập nhật nhiệm vụ" }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string; taskId: string } }) {
  const supabase = await createClient()

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  }

  const { taskId } = params

  try {
    const body = await request.json()

    // Cập nhật một phần thông tin nhiệm vụ (ví dụ: chỉ cập nhật trạng thái)
    const { data, error } = await supabase.from("tasks").update(body).eq("id", taskId).select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Ghi lại lịch sử thay đổi
    if (body.status) {
      await supabase.from("task_history").insert({
        task_id: taskId,
        user_id: authUser.id,
        action: "status_change",
        from_val: "previous_status", // Trong thực tế, bạn cần lưu trạng thái trước đó
        to_val: body.status,
        at: new Date().toISOString(),
      })
    }

    return NextResponse.json({ task: data[0] })
  } catch (error) {
    console.error("Error updating task:", error)
    return NextResponse.json({ error: "Lỗi khi cập nhật nhiệm vụ" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string; taskId: string } }) {
  const supabase = await createClient()

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  }

  const { taskId } = params

  // Xóa nhiệm vụ
  const { error: deleteError } = await supabase.from("tasks").delete().eq("id", taskId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
