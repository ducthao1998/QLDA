import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface Task {
  id: string
  name: string
  project_id: string
}

interface Project {
  id: string
  name: string
}

interface Activity {
  id: string
  created_at: string
  action: string
  from_val: string
  to_val: string
  tasks: Task[] | null
  users: {
    id: string
    full_name: string
  }[] | null
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
        tasks(id, name, project_id),
        users(id, full_name)
      `)
      .order("created_at", { ascending: false })  
      .limit(10)

    if (error) {
      console.error("Supabase error:", error)
      throw error
    }

    if (!activities || activities.length === 0) {
      return NextResponse.json({ activities: [] })
    }

    // Safely extract project IDs, filtering out null/undefined values
    const projectIds = activities
      .map((activity: Activity) => {
        if (activity.tasks && activity.tasks.length > 0) {
          return activity.tasks[0]?.project_id
        }
        return null
      })
      .filter(Boolean)
    
    let projects: Project[] = []
    if (projectIds.length > 0) {
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("id, name")
        .in("id", projectIds)

      if (projectsError) {
        console.error("Projects error:", projectsError)
        // Don't throw here, just continue without project names
      } else {
        projects = projectsData || []
      }
    }

    // Map project names to activities with safe access
    const activitiesWithProjects = activities.map((activity: Activity) => {
      let project: Project | null = null
      if (activity.tasks && activity.tasks.length > 0 && activity.tasks[0]?.project_id) {
        project = projects.find((p) => p.id === activity.tasks![0].project_id) || null
      }
      
      return {
        ...activity,
        project,
      }
    })

    return NextResponse.json({ activities: activitiesWithProjects })
  } catch (error) {
    console.error("Error fetching recent activities:", error)
    return NextResponse.json({ 
      error: "Không thể lấy dữ liệu hoạt động",
      activities: [] 
    }, { status: 500 })
  }
}
