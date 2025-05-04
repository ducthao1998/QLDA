import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface Task {
  id: string
  name: string
  project_id: string
}

interface Activity {
  id: string
  created_at: string
  action: string
  from_val: string
  to_val: string
  tasks: Task[]
  users: {
    id: string
    full_name: string
  }[]
}

export async function GET() {
  const supabase = await createClient()

  try {
    const { data: activities, error } = await supabase
      .from("task_history")
      .select(`
        id,
        created_at,
        action,
        from_val,
        to_val,
        tasks!inner(id, name, project_id),
        users(id, full_name)
      `)
      .order("created_at", { ascending: false })  
      .limit(10)

    if (error) throw error

    // Lấy thông tin project cho mỗi task
    const projectIds = activities.map((activity: Activity) => activity.tasks[0]?.project_id).filter(Boolean)
    
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, name")
      .in("id", projectIds)

    if (projectsError) throw projectsError

    // Map project names to activities
    const activitiesWithProjects = activities.map((activity: Activity) => {
      const project = projects.find((p) => p.id === activity.tasks[0]?.project_id)
      return {
        ...activity,
        project: project || null,
      }
    })

    return NextResponse.json({ activities: activitiesWithProjects })
  } catch (error) {
    console.error("Error fetching recent activities:", error)
    return NextResponse.json({ error: "Không thể lấy dữ liệu hoạt động" }, { status: 500 })
  }
}
