import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { buildExperienceMatrix } from "@/algorithm/experience-matrix"
import { constrainedHungarianAssignment, type AlgoTask, type AlgoUser } from "@/algorithm/hungarian-assignment"
import { calculateCriticalPath } from "@/algorithm/critical-path"

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const projectId = params.id

  // auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // load per-project settings for current user
  const { data: settingsRow } = await supabase
    .from("algorithm_settings")
    .select("assignment_prefs, cpm_prefs")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .maybeSingle()

  const assignPrefs: any = settingsRow?.assignment_prefs ?? {}
  const cpmPrefs: any = settingsRow?.cpm_prefs ?? {}

  // input
  const body = await req.json().catch(() => ({} as any))
  const name: string = body?.name ?? `Lịch tối ưu ${new Date().toLocaleString()}`

  // project start (optional)
  const { data: project } = await supabase
    .from("projects")
    .select("start_date")
    .eq("id", projectId)
    .maybeSingle()

  // project data
  const { data: tasks } = await supabase.from("tasks")
    .select("id, project_id, name, status, duration_days")
    .eq("project_id", projectId)

  const { data: users } = await supabase.from("users")
    .select("id, full_name, max_concurrent_tasks")

  const { data: taskSkills } = await supabase.from("task_skills")
    .select("task_id, skill_id")

  const allSkillsIds = Array.from(new Set((taskSkills ?? []).map((s: any) => s.skill_id)))
  const allUserIds = (users ?? []).map((u: any) => u.id)

  // build experience matrix
  const experienceMatrix = await buildExperienceMatrix(allUserIds, allSkillsIds)

  // map to algorithm shapes
  const algoTasks: AlgoTask[] = (tasks ?? []).map((t: any) => ({
    id: String(t.id),
    name: t.name,
    required_skills: (taskSkills ?? [])
      .filter((s: any) => String(s.task_id) === String(t.id))
      .map((s: any) => s.skill_id),
    priority: 1,
    estimated_hours: Math.max(1, (t.duration_days ?? 1)) * 8,
  }))

  const algoUsers: AlgoUser[] = (users ?? []).map((u: any) => ({
    id: u.id,
    name: u.full_name,
    current_workload: 0,
    max_concurrent_tasks: Math.max(1, u.max_concurrent_tasks ?? assignPrefs?.default_max_concurrent_tasks ?? 2),
  }))

  const assignments = constrainedHungarianAssignment(
    algoTasks,
    algoUsers,
    experienceMatrix,
    assignPrefs?.default_max_concurrent_tasks ?? 2,
    {
      minConfidence: assignPrefs?.min_confidence_R ?? 0.35,
      unassignedCost: assignPrefs?.unassigned_cost ?? 0.5,
      priorityMode: assignPrefs?.priority_mode ?? "weighted",
    }
  )

  // simple sequential schedule demo (can be replaced with CPM-based scheduling)
  const projectStart = project?.start_date ? new Date(project.start_date) : new Date()
  const byId: Record<string, any> = {}
  for (const t of algoTasks) byId[t.id] = t
  let cursor = new Date(projectStart)

  const scheduleRows = algoTasks.map((t) => {
    const assigned = assignments.find((a) => a.task_id === t.id)
    const start = new Date(cursor)
    const end = new Date(start)
    end.setDate(end.getDate() + Math.max(1, Math.ceil((t.estimated_hours || 8) / 8)) - 1)
    cursor = new Date(end)
    cursor.setDate(cursor.getDate() + 1)
    return {
      task_id: String(t.id),
      assigned_user: assigned?.user_id ?? null,
      start_ts: start.toISOString(),
      finish_ts: end.toISOString(),
      confidence: assigned?.confidence_score ?? 0,
      experience_score: assigned?.experience_score ?? 0,
    }
  })

  // CPM & metrics
  const cpmInputTasks = scheduleRows.map((r) => ({
    id: String(r.task_id),
    project_id: projectId,
    name: byId[String(r.task_id)]?.name ?? "",
    status: "todo" as any,
    duration_days: Math.max(1, Math.ceil((byId[String(r.task_id)]?.estimated_hours ?? 8) / 8)),
    start_date: r.start_ts,
    end_date: r.finish_ts,
  }))

  const cpm = calculateCriticalPath(cpmInputTasks as any, [], undefined)

  // insert run + details
  const runId = randomUUID()
  const { data: run, error: runErr } = await supabase
    .from("schedule_runs")
    .insert({
      id: runId,
      project_id: projectId,
      name,
      algorithm_used: (assignPrefs?.priority_mode ?? "weighted") === "lexi" ? "Hungarian+Lexi" : "Hungarian+Weighted",
      status: "draft",
      is_active: false,
      created_by: user.id,
      parameters: { assignPrefs, cpmPrefs },
      metrics: { assignments: assignments.length, total_tasks: algoTasks.length, cpm },
    })
    .select("*")
    .single()

  if (runErr) {
    console.error("schedule_runs insert error:", runErr)
    return NextResponse.json({ error: runErr.message, where: "insert_run" }, { status: 500 })
  }

  const rows = scheduleRows.map((r) => ({ id: randomUUID(), ...r, schedule_run_id: run.id }))
  const { error: detErr } = await supabase.from("schedule_details").insert(rows)
  if (detErr) {
    console.error("schedule_details insert error:", detErr)
    return NextResponse.json({ error: detErr.message, where: "insert_details" }, { status: 500 })
  }

  return NextResponse.json({ schedule_run: run, details_count: rows.length })
}


