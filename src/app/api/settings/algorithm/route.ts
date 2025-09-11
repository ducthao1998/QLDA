import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(request.url)
    const projectId = url.searchParams.get("project_id")

    const query = supabase
      .from("algorithm_settings")
      .select("*")
      .eq("user_id", session.user.id)
      .limit(1)

    if (projectId) {
      query.eq("project_id", projectId)
    }

    const { data: rows, error } = await query

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
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      project_id,
      algorithm = "multi_project_cpm",
      objective = { type: "time", weights: { time_weight: 1, resource_weight: 0, cost_weight: 0 } },
      constraints = { respect_dependencies: true, respect_skills: true, respect_availability: true },
    } = body || {}

    const payload = {
      user_id: session.user.id,
      project_id: project_id || null,
      algorithm,
      objective_type: objective?.type || "time",
      objective_weights: objective?.weights || { time_weight: 1, resource_weight: 0, cost_weight: 0 },
      constraints: constraints || { respect_dependencies: true, respect_skills: true, respect_availability: true },
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("algorithm_settings")
      .upsert(payload, { onConflict: "user_id,project_id" })
      .select()
      .single()

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


