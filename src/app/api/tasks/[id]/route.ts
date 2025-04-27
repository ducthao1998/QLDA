import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { status } = body

    // Update task status
    const { error: taskError } = await supabase
      .from("tasks")
      .update({ status })
      .eq("id", params.id)

    if (taskError) {
      console.error("Error updating task:", taskError)
      return NextResponse.json({ error: taskError.message }, { status: 500 })
    }

    // If task is completed, update task progress
    if (status === "completed") {
      const { error: progressError } = await supabase
        .from("task_progress")
        .update({
          actual_finish: new Date().toISOString(),
          status_snapshot: "on_time",
        })
        .eq("task_id", params.id)

      if (progressError) {
        console.error("Error updating task progress:", progressError)
        return NextResponse.json({ error: progressError.message }, { status: 500 })
      }
    }

    // If task is in progress, update task progress
    if (status === "in_progress") {
      const { error: progressError } = await supabase
        .from("task_progress")
        .update({
          actual_start: new Date().toISOString(),
        })
        .eq("task_id", params.id)

      if (progressError) {
        console.error("Error updating task progress:", progressError)
        return NextResponse.json({ error: progressError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in PATCH /api/tasks/[id]:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
} 