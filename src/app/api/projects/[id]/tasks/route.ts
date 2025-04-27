import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface TaskParams {
  id: string
}

export async function GET(
  request: Request,
  { params }: { params: TaskParams }
) {
  try {
    const supabase = await createClient()
    const projectId = params.id

    // Kiểm tra xác thực
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Lấy danh sách task của dự án
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select(`
        *,
        users!tasks_assigned_to_fkey (
          full_name
        )
      `)
      .eq("project_id", projectId)
      .order("weight", { ascending: false })

    if (error) {
      console.error("Error fetching tasks:", error)
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
    }

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error("Error in tasks route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: TaskParams }
) {
  try {
    const supabase = await createClient()
    const projectId = params.id

    // Kiểm tra xác thực
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, status, estimate_low, estimate_high, due_date, assigned_to } = body

    // Tạo task mới
    const { data: task, error } = await supabase
      .from("tasks")
      .insert([
        {
          project_id: projectId,
          name,
          description,
          status,
          estimate_low,
          estimate_high,
          due_date,
          assigned_to,
          weight: 0.5, // Giá trị mặc định
          risk_level: 1, // Giá trị mặc định
          complexity: 1, // Giá trị mặc định
          max_rejections: 3, // Giá trị mặc định
          current_rej: 0 // Giá trị mặc định
        }
      ])
      .select()
      .single()

    if (error) {
      console.error("Error creating task:", error)
      return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error("Error in tasks route:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
