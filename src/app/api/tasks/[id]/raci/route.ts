import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { TaskRaci } from "@/app/types/table-types"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const taskId = await params.id
    const body = await request.json()

    // Validate required fields
    if (!body.user_id || !body.role) {
      return NextResponse.json(
        { error: "user_id and role are required" },
        { status: 400 }
      )
    }

    // Create task_raci record
    const { data: raci, error } = await supabase
      .from("task_raci")
      .insert({
        task_id: taskId,
        user_id: body.user_id,
        role: body.role
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating task_raci:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ raci })
  } catch (error) {
    console.error("Error in POST /api/tasks/[id]/raci:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
} 