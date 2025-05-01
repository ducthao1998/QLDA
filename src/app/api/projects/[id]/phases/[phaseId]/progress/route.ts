import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: { id: string; phaseId: string } }
) {
  try {
    const supabase = await createClient()
    const { id, phaseId } = await params

    if (!id || !phaseId) {
      return NextResponse.json({ error: "Project ID and Phase ID are required" }, { status: 400 })
    }

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
    }

    // Get total tasks count
    const { count: totalTasks, error: countError } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("project_id", id)
      .eq("phase_id", phaseId)

    if (countError) {
      console.error("Error counting tasks:", countError)
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }

    // Get completed tasks count
    const { count: completedTasks, error: completedError } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("project_id", id)
      .eq("phase_id", phaseId)
      .eq("status", "done")

    if (completedError) {
      console.error("Error counting completed tasks:", completedError)
      return NextResponse.json({ error: completedError.message }, { status: 500 })
    }

    const progress = totalTasks ? Math.round(((completedTasks || 0) / totalTasks) * 100) : 0

    return NextResponse.json({
      progress,
      totalTasks,
      completedTasks,
    })
  } catch (error) {
    console.error("Unexpected error in GET phase progress:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 