import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { Task } from "@/app/types/table-types"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const taskId = params.id

    // Kiểm tra xác thực
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Lấy thông tin chi tiết task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select(`
        *,
        users:assigned_to (
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

    if (taskError) {
      console.error("Error fetching task:", taskError)
      return NextResponse.json({ error: taskError.message }, { status: 500 })
    }

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error("Error in GET /api/tasks/[id]:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const taskId = params.id

    // Kiểm tra xác thực
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const taskData: Partial<Task> = {
      ...body,
      updated_at: new Date().toISOString()
    }

    // Cập nhật task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .update(taskData)
      .eq("id", taskId)
      .select()
      .single()

    if (taskError) {
      console.error("Error updating task:", taskError)
      return NextResponse.json({ error: taskError.message }, { status: 500 })
    }

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error("Error in PATCH /api/tasks/[id]:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const taskId = params.id

    // Kiểm tra xác thực
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Xóa task
    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)

    if (deleteError) {
      console.error("Error deleting task:", deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/tasks/[id]:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
} 