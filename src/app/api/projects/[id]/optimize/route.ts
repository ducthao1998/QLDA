import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { optimizeSchedule } from "@/algorithm/schedule-optimizer"
import { OptimizationConfig } from "@/algorithm/types"
import { computeEarliestSchedule } from "@/lib/scheduling"

/**
 * POST /api/projects/[id]/optimize
 *
 * Runs the scheduling optimization and returns the result. **Does NOT** create a
 * `schedule_runs` row — that only happens when the user explicitly saves a draft
 * via POST /api/projects/[id]/schedule/optimize. This separation means refreshing
 * the Gantt page (or accidentally re-mounting the component) no longer floods
 * the DB with empty schedule_run records.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id: projectId } = await params

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const algorithm = body?.algorithm || "multi_project_cpm"
    const objective = body?.objective || { type: "time" }

    // Load project + tasks + dependencies + supporting data in parallel.
    const [
      { data: project, error: projectError },
      { data: tasks, error: tasksError },
      { data: users },
      { data: taskSkills },
      { data: userSkills },
    ] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).single(),
      supabase.from("tasks").select("*").eq("project_id", projectId),
      supabase.from("users").select("id, full_name, position, org_unit"),
      supabase.from("task_skills").select("*"),
      // user_skill_matrix is a view; tolerate its absence.
      supabase.from("user_skill_matrix").select("*").then((r) => ({ data: r.data ?? [] })),
    ])

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }
    if (tasksError) {
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
    }
    const taskList = tasks || []
    const taskIds = taskList.map((t) => t.id.toString())

    // Dependencies must be scoped to this project's tasks; PostgREST .in() with an
    // empty list returns everything, so guard against that.
    let dependencies: any[] = []
    if (taskIds.length) {
      const { data, error } = await supabase
        .from("task_dependencies")
        .select("*")
        .in("task_id", taskIds)
      if (error) console.warn("Failed to fetch dependencies:", error.message)
      dependencies = data || []
    }

    // Build the *initial* schedule using dependency-aware earliest-start CPM so
    // that "original makespan" reflects reality rather than zero.
    const projectStart = new Date(project.start_date || Date.now())
    const initialSchedule = computeEarliestSchedule(
      taskList.map((t) => ({ id: String(t.id), duration_days: t.duration_days })),
      dependencies,
      projectStart,
    )

    const scheduleDetails = taskList.map((task) => {
      const s = initialSchedule.get(task.id.toString())
      return {
        // Synthetic run id — we are NOT persisting; the optimizer doesn't write it back.
        id: crypto.randomUUID(),
        schedule_run_id: "in-memory",
        task_id: task.id.toString(),
        assigned_user: task.assigned_to || "",
        start_ts: s?.start_date || projectStart.toISOString(),
        finish_ts: s?.end_date || projectStart.toISOString(),
        resource_allocation: 1.0,
      }
    })

    // Per-user CPM preferences (default duration, gap, etc.) saved on the
    // algorithm_settings page.
    let cpmPrefs: any = {}
    try {
      const { data: row } = await supabase
        .from("algorithm_settings")
        .select("cpm_prefs")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .maybeSingle()
      cpmPrefs = (row as any)?.cpm_prefs || {}
    } catch {
      // Settings table is optional; missing == use defaults.
    }

    const config: OptimizationConfig & { cpm_prefs?: any } = {
      algorithm: algorithm as any,
      objective,
      constraints: {
        respect_dependencies: true,
        respect_skills: true,
        respect_availability: true,
      },
      cpm_prefs: cpmPrefs,
    }

    const result = await optimizeSchedule(
      taskList,
      dependencies,
      scheduleDetails,
      config,
      project,
      users || [],
      userSkills || [],
      taskSkills || [],
      // No persisted run; pass a stub so existing optimizer code doesn't crash.
      { id: "in-memory", project_id: projectId, algorithm_used: algorithm, status: "completed", created_by: user.id },
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error in optimization API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
