import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const supabase = await createClient()
  const url = new URL(request.url)
  const period = url.searchParams.get("period") || "week"

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  }

  try {
    // Lấy danh sách người dùng
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, full_name, position, org_unit")
      .order("full_name", { ascending: true })

    if (usersError) {
      throw new Error(usersError.message)
    }

    // Tính toán ngày bắt đầu dựa trên khoảng thời gian
    const today = new Date()
    let startDate = new Date()

    if (period === "week") {
      // Lấy ngày đầu tuần (thứ 2)
      const day = today.getDay()
      const diff = today.getDate() - day + (day === 0 ? -6 : 1)
      startDate = new Date(today.setDate(diff))
    } else if (period === "month") {
      // Lấy ngày đầu tháng
      startDate = new Date(today.getFullYear(), today.getMonth(), 1)
    } else if (period === "quarter") {
      // Lấy ngày đầu quý
      const quarter = Math.floor(today.getMonth() / 3)
      startDate = new Date(today.getFullYear(), quarter * 3, 1)
    }

    const startDateStr = startDate.toISOString().split("T")[0]

    // Lấy danh sách nhiệm vụ đang hoạt động trong khoảng thời gian
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        id, 
        name, 
        status, 
        estimate_low, 
        estimate_high, 
        due_date,
        task_raci!inner (
          user_id,
          role
        )
      `)
      .gte("due_date", startDateStr)
      .in("status", ["todo", "in_progress", "blocked", "review"])
      .eq("task_raci.role", "R") // Chỉ lấy người chịu trách nhiệm chính

    if (tasksError) {
      throw new Error(tasksError.message)
    }

    // Tính toán khối lượng công việc cho mỗi người dùng
    const workloads = users.map((user) => {
      const userTasks = tasks.filter((task) =>
        task.task_raci.some((raci) => raci.user_id === user.id && raci.role === "R"),
      )

      const totalHours = userTasks.reduce((sum, task) => {
        // Lấy trung bình của estimate_low và estimate_high
        const estimatedHours = ((task.estimate_low || 0) + (task.estimate_high || 0)) / 2
        return sum + estimatedHours
      }, 0)

   


      return {
        user,
        activeTasks: userTasks.length,
        totalHours,
        tasks: userTasks,
      }
    })

    return NextResponse.json({ workloads })
  } catch (error) {
    console.error("Error fetching workload data:", error)
    return NextResponse.json({ error: "Lỗi khi tải dữ liệu khối lượng công việc" }, { status: 500 })
  }
}
