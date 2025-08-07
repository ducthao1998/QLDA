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

  const { taskId } = await params

  // Lấy thông tin chi tiết nhiệm vụ
  const { data: task, error } = await supabase
    .from("tasks")
    .select(`
      *,
      users!assigned_to: (
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

  const { taskId } = await params

  try {
    const body = await request.json()

    // First get the current task data
    const { data: currentTask, error: fetchError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single()

    if (fetchError) {
      console.error("Error fetching current task:", fetchError)
      return NextResponse.json({ error: "Không tìm thấy nhiệm vụ" }, { status: 404 })
    }

    // Prepare update data, only include fields that are provided and not empty
    const updateData: Record<string, any> = {}
    
    // Only update fields that are provided and not empty
    if (body.name) updateData.name = body.name
    if (body.note !== undefined) updateData.note = body.note
    if (body.status) updateData.status = body.status
    if (body.assigned_to !== undefined) updateData.assigned_to = body.assigned_to
    // Update task with only changed fields
    const { data, error } = await supabase
      .from("tasks")
      .update(updateData)
      .eq("id", taskId)
      .select()

    if (error) {
      console.error("Error updating task:", error)
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

  const { taskId } = await params

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

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; taskId: string } }
) {
  try {
    const supabase = await createClient()
    const { taskId } = await params

    // First, delete related records in task_skills
    const { error: taskSkillsError } = await supabase
      .from("task_skills")
      .delete()
      .eq("task_id", taskId)

    if (taskSkillsError) {
      console.error("Error deleting task_skills:", taskSkillsError)
      return NextResponse.json({ error: taskSkillsError.message }, { status: 500 })
    }

    // Then, delete related records in task_raci
    const { error: taskRaciError } = await supabase
      .from("task_raci")
      .delete()
      .eq("task_id", taskId)

    if (taskRaciError) {
      console.error("Error deleting task_raci:", taskRaciError)
      return NextResponse.json({ error: taskRaciError.message }, { status: 500 })
    }

    // Finally, delete the task itself
    const { error: taskError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)

    if (taskError) {
      console.error("Error deleting task:", taskError)
      return NextResponse.json({ error: taskError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/projects/[id]/tasks/[taskId]:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
