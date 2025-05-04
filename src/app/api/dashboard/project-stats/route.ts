import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface TaskStat {
  status: string
  count: number
}

export async function GET() {
  const supabase = await createClient()

  try {
    // Lấy các dự án có task đang thực hiện
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, name, status")
      .in("status", ["active", "in_progress"])
      .order("created_at", { ascending: false })

    if (projectsError) throw projectsError

    if (!projects || projects.length === 0) {
      return NextResponse.json({ projects: [] })
    }

    // Lấy số lượng nhiệm vụ theo trạng thái cho mỗi dự án
    const projectStats = await Promise.all(
      projects.map(async (project) => {
        // Lấy số lượng task theo từng trạng thái
        const { data: todoTasks, error: todoError } = await supabase
          .from("tasks")
          .select("id")
          .eq("project_id", project.id)
          .eq("status", "todo")

        const { data: inProgressTasks, error: inProgressError } = await supabase
          .from("tasks")
          .select("id")
          .eq("project_id", project.id)
          .eq("status", "in_progress")

        const { data: doneTasks, error: doneError } = await supabase
          .from("tasks")
          .select("id")
          .eq("project_id", project.id)
          .eq("status", "done")

        if (todoError || inProgressError || doneError) throw todoError || inProgressError || doneError

        const totalTasks = (todoTasks?.length || 0) + (inProgressTasks?.length || 0) + (doneTasks?.length || 0)
        const progress = totalTasks > 0 ? Math.round(((doneTasks?.length || 0) / totalTasks) * 100) : 0

        // Xác định trạng thái dự án dựa trên tiến độ và deadline
        const { data: lateTasks, error: lateTasksError } = await supabase
          .from("tasks")
          .select("id")
          .eq("project_id", project.id)
          .lt("end_date", new Date().toISOString())
          .not("status", "eq", "done")

        if (lateTasksError) throw lateTasksError

        const status = lateTasks.length > 0 ? "late" : "on_time"

        return {
          id: project.id,
          name: project.name,
          progress,
          status,
          tasks: {
            todo: todoTasks?.length || 0,
            in_progress: inProgressTasks?.length || 0,
            done: doneTasks?.length || 0,
          },
        }
      }),
    )

    return NextResponse.json({ projects: projectStats })
  } catch (error) {
    console.error("Error fetching project statistics:", error)
    return NextResponse.json({ error: "Không thể lấy dữ liệu thống kê dự án" }, { status: 500 })
  }
}
