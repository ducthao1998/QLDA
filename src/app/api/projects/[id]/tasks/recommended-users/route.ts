import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  // Authenticate user
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  }

  try {
    // Get the project ID from params
    const { id: projectId } = await params

    // Get the skill_id from the URL query parameters
    const url = new URL(request.url)
    const skillId = url.searchParams.get("skill_id")

    if (!skillId) {
      return NextResponse.json({ error: "Thiếu skill_id" }, { status: 400 })
    }

    // Query users with the specified skill
    const { data: users, error } = await supabase
      .from("user_skills")
      .select(`
        level,
        users (
          id,
          full_name,
          position,
          org_unit,
          email
        )
      `)
      .eq("skill_id", skillId)
      .order("level", { ascending: false })

    if (error) {
      console.error("Error fetching recommended users:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Format the response
    const recommendedUsers = users.map((item) => ({
      ...item.users,
      skill_level: item.level,
    }))

    return NextResponse.json({ users: recommendedUsers })
  } catch (error) {
    console.error("Error in GET /api/projects/[id]/tasks/recommended-users:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
