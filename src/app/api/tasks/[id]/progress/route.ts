import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  try {
    const { id } = await params

    // Get the latest task progress
    const { data, error } = await supabase
      .from("task_progress")
      .select("*")
      .eq("task_id", id)
      .order("snapshot_at", { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows returned"
      throw error
    }

    return NextResponse.json({ progress: data || null })
  } catch (error) {
    console.error("Error fetching task progress:", error)
    return NextResponse.json({ error: "Không thể lấy tiến độ công việc" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  try {
    // Get task details for planned dates if not provided
    if (!body.planned_start || !body.planned_finish) {
      const { data: task } = await supabase.from("tasks").select("start_date, end_date").eq("id", id).single()

      if (task) {
        body.planned_start = body.planned_start || task.start_date
        body.planned_finish = body.planned_finish || task.end_date
      }
    }

    // Add snapshot timestamp
    body.snapshot_at = new Date().toISOString()

    // Insert task progress
    const { data, error } = await supabase
      .from("task_progress")
      .insert({
        task_id: id,
        planned_start: body.planned_start,
        planned_finish: body.planned_finish,
        actual_start: body.actual_start,
        actual_finish: body.actual_finish,
        status_snapshot: body.status_snapshot,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ progress: data })
  } catch (error) {
    console.error("Error updating task progress:", error)
    return NextResponse.json({ error: "Không thể cập nhật tiến độ công việc" }, { status: 500 })
  }
}
