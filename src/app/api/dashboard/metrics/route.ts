import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  try {
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, status")

    if (projectsError) throw projectsError

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, status")

    if (tasksError) throw tasksError

    const metrics = {
      totalProjects: projects.length,
      activeProjects: projects.filter((p) => ["active", "in_progress"].includes(p.status)).length,
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => t.status === "done").length,
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error("Error fetching dashboard metrics:", error)
    return NextResponse.json({ error: "Không thể lấy dữ liệu thống kê" }, { status: 500 })
  }
}
