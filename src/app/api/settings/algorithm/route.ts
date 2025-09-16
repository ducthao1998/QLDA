import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const projectId = url.searchParams.get("project_id")

    let rows: any = null
    let error: any = null

    if (projectId) {
      const res = await supabase
        .from("algorithm_settings")
        .select("*")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .limit(1)
      rows = (res as any).data
      error = (res as any).error
    } else {
      const res = await supabase
        .from("algorithm_global_settings")
        .select("*")
        .eq("user_id", user.id)
        .limit(1)
      rows = (res as any).data
      error = (res as any).error
    }

    if (error) {
      console.error("Error fetching algorithm settings:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const settings = rows?.[0] || null
    return NextResponse.json({ settings })
  } catch (error) {
    console.error("Error in GET /api/settings/algorithm:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      project_id,
      algorithm = "multi_project_cpm",
      objective = { type: "time", weights: { time_weight: 1, resource_weight: 0, cost_weight: 0 } },
      constraints = { respect_dependencies: true, respect_skills: true, respect_availability: true },
      assignment_prefs = null,
      cpm_prefs = null,
    } = body || {}

    let data: any = null
    let error: any = null
    if (project_id) {
      const payload = {
        user_id: user.id,
        project_id: project_id,
        algorithm,
        objective_type: objective?.type || "time",
        objective_weights: objective?.weights || { time_weight: 1, resource_weight: 0, cost_weight: 0 },
        constraints: constraints || { respect_dependencies: true, respect_skills: true, respect_availability: true },
        assignment_prefs: assignment_prefs ?? null,
        cpm_prefs: cpm_prefs ?? null,
        updated_at: new Date().toISOString(),
      }

      const res = await supabase
        .from("algorithm_settings")
        .upsert(payload, { onConflict: "user_id,project_id" })
        .select()
        .single()
      data = (res as any).data
      error = (res as any).error
    } else {
      const payload = {
        user_id: user.id,
        algorithm,
        objective_type: objective?.type || "time",
        objective_weights: objective?.weights || { time_weight: 1, resource_weight: 0, cost_weight: 0 },
        constraints: constraints || { respect_dependencies: true, respect_skills: true, respect_availability: true },
        assignment_prefs: assignment_prefs ?? null,
        cpm_prefs: cpm_prefs ?? null,
        updated_at: new Date().toISOString(),
      }

      const res = await supabase
        .from("algorithm_global_settings")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .single()
      data = (res as any).data
      error = (res as any).error
    }

    if (error) {
      console.error("Error upserting algorithm settings:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ settings: data })
  } catch (error) {
    console.error("Error in PUT /api/settings/algorithm:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}


