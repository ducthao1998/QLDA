import { createClient } from "@/lib/supabase/server"
import { NextResponse, NextRequest } from "next/server"

export async function GET() {
  const supabase = await createClient()

  try {
    // Get authenticated user
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get total projects where user is involved
    const { data: projectsData } = await supabase
      .from("task_raci")
      .select(`
        tasks!inner(
          project_id,
          status
        )
      `)
      .eq("user_id", authUser.id)

    // Get unique project IDs
    const uniqueProjectIds = new Set(projectsData?.map(item => item.tasks?.project_id) || [])
    const totalProjects = uniqueProjectIds.size

    // Get task statistics
    const { data: tasksData } = await supabase
      .from("task_raci")
      .select(`
        tasks!inner(
          id,
          status,
          end_date
        )
      `)
      .eq("user_id", authUser.id)
      .in("role", ["R", "A"])

    const totalTasks = tasksData?.length || 0
    const completedTasks = tasksData?.filter(item => item.tasks?.status === "done").length || 0
    const inProgressTasks = tasksData?.filter(item => item.tasks?.status === "in_progress").length || 0
    
    // Calculate on-time rate for completed tasks
    const now = new Date()
    const completedOnTime = tasksData?.filter(item => 
      item.tasks?.status === "done" && new Date(item.tasks?.end_date) >= now
    ).length || 0

    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
    const onTimeRate = completedTasks > 0 ? (completedOnTime / completedTasks) * 100 : 0

    const stats = {
      total_projects: totalProjects,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      in_progress_tasks: inProgressTasks,
      completion_rate: completionRate,
      on_time_rate: onTimeRate
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error("Error fetching profile stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();

  // Authenticate user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Parse request body
  const { phone_number } = await request.json();
  console.log(phone_number)
  if (!phone_number) {
    return NextResponse.json({ error: "Missing phonenumber" }, { status: 400 });
  }

  // Update phone number in users table
  const { error } = await supabase
    .from("users")
    .update({ phone_number: phone_number })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to update phone number" }, { status: 500 });
  }

  return NextResponse.json({ message: "Phone number updated successfully" });
}