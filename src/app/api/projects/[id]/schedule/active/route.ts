import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const projectId = params.id

  const { data: run } = await supabase
    .from("schedule_runs")
    .select("id, name, created_at")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .maybeSingle()

  if (!run) return NextResponse.json({ run: null, details: [] })

  const { data: details } = await supabase
    .from("schedule_details")
    .select("task_id, assigned_user, start_ts, finish_ts, confidence, experience_score")
    .eq("schedule_run_id", run.id)

  return NextResponse.json({ run, details: details ?? [] })
}


