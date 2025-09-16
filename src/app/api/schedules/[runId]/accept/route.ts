import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(_req: Request, { params }: { params: { runId: string } }) {
  const supabase = await createClient()
  const runId = params.runId

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: run, error: rerr } = await supabase
    .from("schedule_runs").select("*").eq("id", runId).single()
  if (rerr || !run) return NextResponse.json({ error: "Run not found" }, { status: 404 })
  if (run.created_by !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // 1) turn off existing active runs for this project
  const { error: offErr } = await supabase
    .from("schedule_runs")
    .update({ is_active: false, status: 'archived' })
    .eq("project_id", run.project_id)
    .eq("is_active", true)
  if (offErr) return NextResponse.json({ error: offErr.message }, { status: 500 })

  // 2) activate current run
  const { data: updated, error: onErr } = await supabase
    .from("schedule_runs")
    .update({ is_active: true, status: 'approved' })
    .eq("id", runId)
    .select("*")
    .single()
  if (onErr) return NextResponse.json({ error: onErr.message }, { status: 500 })

  // 3) optional: update projects.active_schedule_run_id
  await supabase.from("projects")
    .update({ active_schedule_run_id: runId })
    .eq("id", run.project_id)

  // 4) (optional) push R-role into task_raci if needed
  // See user instructions to enable this block if desired

  return NextResponse.json({ ok: true, run: updated })
}


