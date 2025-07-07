import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  try {
    // Get authenticated user
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user skills from user_skill_matrix view
    const { data: skills, error } = await supabase
      .from("user_skill_matrix")
      .select("*")
      .eq("user_id", authUser.id)
      .order("completed_tasks_count", { ascending: false })

    if (error) {
      console.error("Error fetching skills:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ skills: skills || [] })
  } catch (error) {
    console.error("Error in GET /api/profile/skills:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}