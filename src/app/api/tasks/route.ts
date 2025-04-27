import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get tasks with related data for optimization
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select(`
        *,
        project:project_id (
          name
        ),
        users:assigned_to (
          full_name,
          avatar_url
        ),
        task_progress (
          planned_start,
          planned_finish,
          actual_start,
          actual_finish,
          status_snapshot
        ),
        user_task_perf (
          planned_hours,
          actual_hours,
          on_time,
          qual_score
        )
      `)
      .order("weight", { ascending: false })

    if (error) {
      console.error("Error fetching tasks:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(tasks)
  } catch (error) {
    console.error("Error in GET /api/tasks:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
} 