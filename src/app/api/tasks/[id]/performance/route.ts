import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  try {
    const { id } = await params

    const { data, error } = await supabase.from("user_task_perf").select("*").eq("task_id", id).single()

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows returned"
      throw error
    }

    return NextResponse.json({ performance: data || null })
  } catch (error) {
    console.error("Error fetching task performance:", error)
    return NextResponse.json({ error: "Không thể lấy hiệu suất công việc" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  try {
    // Get task details
    const { data: task } = await supabase
      .from("tasks")
      .select("assigned_to, min_duration_hours, max_duration_hours")
      .eq("id", id)
      .single()

    if (!task || !task.assigned_to) {
      return NextResponse.json({ error: "Công việc không tồn tại hoặc chưa được phân công" }, { status: 400 })
    }

    // Calculate planned hours from min and max duration
    const plannedHours =
      task.min_duration_hours && task.max_duration_hours
        ? (task.min_duration_hours + task.max_duration_hours) / 2
        : body.planned_hours || 0

    // Insert or update performance record
    const { data, error } = await supabase
      .from("user_task_perf")
      .upsert({
        task_id: id,
        user_id: task.assigned_to,
        planned_hours: plannedHours,
        actual_hours: body.actual_hours || 0,
        on_time: body.on_time !== undefined ? body.on_time : true,
        qual_score: body.qual_score || 3, // Default to middle score
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ performance: data })
  } catch (error) {
    console.error("Error updating task performance:", error)
    return NextResponse.json({ error: "Không thể cập nhật hiệu suất công việc" }, { status: 500 })
  }
}
