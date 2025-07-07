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

    // Get projects where user is involved through task_raci
    const { data: userTasks } = await supabase
      .from("task_raci")
      .select(`
        role,
        tasks!inner(
          project_id,
          status
        )
      `)
      .eq("user_id", authUser.id)

    if (!userTasks || userTasks.length === 0) {
      return NextResponse.json({ projects: [] })
    }

    // Group by project and count tasks
    const projectMap = new Map()
    
    userTasks.forEach(item => {
      const projectId = item.tasks.project_id
      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, {
          project_id: projectId,
          roles: new Set(),
          tasks_assigned: 0,
          tasks_completed: 0
        })
      }
      
      const project = projectMap.get(projectId)
      project.roles.add(item.role)
      project.tasks_assigned++
      
      if (item.tasks.status === "done") {
        project.tasks_completed++
      }
    })

    // Get project details
    const projectIds = Array.from(projectMap.keys())
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name, status, classification")
      .in("id", projectIds)

    // Combine project info with task counts
    const projectsWithStats = projects?.map(project => {
      const stats = projectMap.get(project.id)
      const roles = Array.from(stats.roles)
      
      // Determine primary role (R > A > C > I)
      let primaryRole = "I"
      if (roles.includes("R")) primaryRole = "R - Thực hiện"
      else if (roles.includes("A")) primaryRole = "A - Chịu trách nhiệm"
      else if (roles.includes("C")) primaryRole = "C - Tư vấn"
      else primaryRole = "I - Được thông báo"
      
      return {
        id: project.id,
        name: project.name,
        classification: project.classification,
        status: project.status,
        role: primaryRole,
        tasks_assigned: stats.tasks_assigned,
        tasks_completed: stats.tasks_completed
      }
    }) || []

    // Sort by most recent activity (most tasks first)
    projectsWithStats.sort((a, b) => b.tasks_assigned - a.tasks_assigned)

    return NextResponse.json({ projects: projectsWithStats.slice(0, 10) })
  } catch (error) {
    console.error("Error fetching user projects:", error)
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    )
  }
}