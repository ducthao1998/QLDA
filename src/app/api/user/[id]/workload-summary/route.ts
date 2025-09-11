import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const url = new URL(request.url)
    const taskId = url.searchParams.get("task_id")
    const userId = (await params).id

    if (!userId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 })
    }

    // 1) Count tasks in progress for this user (role R)
    const { data: inProgressRows, error: inProgressError } = await supabase
      .from("task_raci")
      .select(
        `
        tasks!inner (
          id,
          status
        )
      `
      )
      .eq("user_id", userId)
      .eq("role", "R")
      .eq("tasks.status", "in_progress")

    if (inProgressError) {
      console.error("workload-summary inProgressError", inProgressError)
    }

    const activeInProgress = inProgressRows?.length || 0

    // 2) If taskId provided, collect required skills for that task
    let requiredSkillIds: number[] = []
    if (taskId) {
      // From task_skills
      const { data: taskSkills } = await supabase
        .from("task_skills")
        .select("skill_id")
        .eq("task_id", taskId)

      requiredSkillIds = (taskSkills || [])
        .map((r: any) => r.skill_id)
        .filter((v: any) => v != null)

      // From template if present
      const { data: taskRow } = await supabase
        .from("tasks")
        .select("template_id")
        .eq("id", taskId)
        .single()

      if (taskRow?.template_id) {
        const { data: ttsRows } = await supabase
          .from("task_template_skills")
          .select("skill_id")
          .eq("template_id", taskRow.template_id)
        const templateSkills = (ttsRows || [])
          .map((r: any) => r.skill_id)
          .filter((v: any) => v != null)
        requiredSkillIds = Array.from(new Set([...requiredSkillIds, ...templateSkills]))
      }
    }

    // 3) Completed count via RPC (server-side SQL function for correctness & speed)
    let completedWithRequiredSkills = 0
    if (taskId) {
      const { data: rpcCount, error: rpcErr } = await supabase.rpc(
        "count_completed_tasks_with_required_skills",
        { p_user_id: userId, p_task_id: taskId as string }
      )
      if (rpcErr) {
        console.error("workload-summary rpc error", rpcErr)
      }
      completedWithRequiredSkills = (rpcCount as number) ?? 0
    }

    return NextResponse.json({
      active_in_progress: activeInProgress,
      completed_with_required_skills: completedWithRequiredSkills,
    })
  } catch (e: any) {
    console.error("workload-summary error", e)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}


