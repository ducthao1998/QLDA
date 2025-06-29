import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id: projectId } = await params

  try {
    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("Authentication error:", authError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get project details
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single()

    if (projectError || !project) {
      console.error("Project error:", projectError)
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Get project phases
    const { data: phases, error: phasesError } = await supabase
      .from("project_phases")
      .select("*")
      .eq("project_id", projectId)
      .order("order_no", { ascending: true })

    if (phasesError) {
      console.error("Error fetching phases:", phasesError)
    }

    // Get tasks with all related data
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        *,
        task_raci (
          user_id,
          role,
          users (
            id,
            full_name
          )
        ),
        task_dependencies!task_dependencies_task_id_fkey (
          depends_on_id
        ),
        task_progress (
          actual_start,
          actual_finish,
          status_snapshot
        )
      `)
      .eq("project_id", projectId)
      .order("start_date", { ascending: true })

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError)
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
    }

    // Process tasks to include progress and assigned user
    const processedTasks =
      tasks?.map((task) => {
        // Find responsible user (role = 'R')
        const responsibleRaci = task.task_raci?.find((r: any) => r.role === "R")
        const assignedUser = responsibleRaci?.users

        // Calculate progress percentage
        let progress = 0
        if (task.status === "done") {
          progress = 100
        } else if (task.status === "in_progress") {
          // Calculate based on elapsed time
          const start = new Date(task.start_date)
          const end = new Date(task.end_date)
          const now = new Date()

          if (now >= end) {
            progress = 90 // Should be done but isn't
          } else if (now >= start) {
            const totalDuration = end.getTime() - start.getTime()
            const elapsed = now.getTime() - start.getTime()
            progress = Math.min(90, Math.floor((elapsed / totalDuration) * 100))
          }
        }

        // Get dependencies
        const dependencies = task.task_dependencies?.map((d: any) => d.depends_on_id) || []

        return {
          id: task.id.toString(),
          name: task.name,
          start_date: task.start_date,
          end_date: task.end_date,
          phase_id: task.phase_id,
          status: task.status,
          progress,
          assigned_to: responsibleRaci?.user_id,
          assigned_user_name: assignedUser?.full_name,
          dependencies,
          is_overdue: task.task_progress?.[0]?.status_snapshot === "late",
          actual_start: task.task_progress?.[0]?.actual_start,
          actual_finish: task.task_progress?.[0]?.actual_finish,
        }
      }) || []

    // Calculate project statistics
    const stats = {
      total_tasks: processedTasks.length,
      completed_tasks: processedTasks.filter((t) => t.status === "done").length,
      in_progress_tasks: processedTasks.filter((t) => t.status === "in_progress").length,
      overdue_tasks: processedTasks.filter((t) => t.is_overdue).length,
      overall_progress:
        processedTasks.length > 0
          ? Math.floor(processedTasks.reduce((sum, t) => sum + t.progress, 0) / processedTasks.length)
          : 0,
    }

    return NextResponse.json({
      project: {
        ...project,
        stats,
      },
      phases: phases || [],
      tasks: processedTasks,
    })
  } catch (error) {
    console.error("Error in gantt API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
