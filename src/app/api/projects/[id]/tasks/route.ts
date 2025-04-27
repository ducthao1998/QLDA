import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { Task } from "@/app/types/table-types"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const projectId = params.id

    // Kiểm tra xác thực
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Lấy danh sách tasks của project
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        *,
        users:assigned_to (
          full_name,
          position,
          org_unit
        ),
        projects (
          name
        )
      `)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError)
      return NextResponse.json({ error: tasksError.message }, { status: 500 })
    }

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error("Error in GET /api/projects/[id]/tasks:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
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
    const taskData: Partial<Task> = {
      ...body,
      project_id: projectId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Tạo task mới
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert(taskData)
      .select()
      .single()

    if (taskError) {
      console.error("Error creating task:", taskError)
      return NextResponse.json({ error: taskError.message }, { status: 500 })
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error("Error in POST /api/projects/[id]/tasks:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
