import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const projectId = await params.id

    // Lấy danh sách nhiệm vụ của dự án với thông tin phase
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        id,
        name,
        status,
        project_phases (
          name
        )
      `)
      .eq("project_id", projectId)
      .order("id")

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError)
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
    }

    // Lấy danh sách users có tham gia vào project
    const { data: projectUsers, error: usersError } = await supabase
      .from("task_raci")
      .select(`
        user_id,
        users (
          id,
          full_name,
          position,
          org_unit
        )
      `)
      .in(
        "task_id",
        (tasks || []).map((t) => t.id),
      )
      .not("user_id", "is", null)

    if (usersError) {
      console.error("Error fetching users:", usersError)
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
    }

    // Lấy tất cả RACI assignments
    const { data: raciAssignments, error: raciError } = await supabase
      .from("task_raci")
      .select(`
        task_id,
        user_id,
        role
      `)
      .in(
        "task_id",
        (tasks || []).map((t) => t.id),
      )
      .not("user_id", "is", null)

    if (raciError) {
      console.error("Error fetching RACI assignments:", raciError)
      return NextResponse.json({ error: "Failed to fetch RACI assignments" }, { status: 500 })
    }

    // Process data
    const processedTasks = (tasks || []).map((task: any) => ({
      id: task.id,
      name: task.name,
      status: task.status,
      phase_name: Array.isArray(task.project_phases) ? task.project_phases[0]?.name : task.project_phases?.name,
    }))

    // Get unique users
    const uniqueUsers = Array.from(
      new Map(
        (projectUsers || [])
          .filter((pu: any) => pu.users)
          .map((pu: any) => [
            pu.user_id,
            {
              id: pu.user_id,
              full_name: Array.isArray(pu.users) ? pu.users[0]?.full_name : pu.users?.full_name,
              position: Array.isArray(pu.users) ? pu.users[0]?.position : pu.users?.position,
              org_unit: Array.isArray(pu.users) ? pu.users[0]?.org_unit : pu.users?.org_unit,
            },
          ]),
      ).values(),
    )

    const response = {
      tasks: processedTasks,
      users: uniqueUsers,
      assignments: raciAssignments || [],
    }

    console.log("RACI API Response:", {
      tasksCount: response.tasks.length,
      usersCount: response.users.length,
      assignmentsCount: response.assignments.length,
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error in RACI route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
