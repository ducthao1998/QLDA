import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  try {
    const { id } = await params

    const { data, error } = await supabase
      .from("task_history")
      .select("*")
      .eq("task_id", id)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ history: data })
  } catch (error) {
    console.error("Error fetching task history:", error)
    return NextResponse.json({ error: "Failed to fetch task history" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  try {
    const { id } = await params
    const body = await request.json()

    const { data, error } = await supabase
      .from("task_history")
      .insert([
        {
          task_id: id,
          action: body.action,
          from_val: body.from_val,
          to_val: body.to_val,
        },
      ])
      .select()

    if (error) throw error

    return NextResponse.json({ history: data[0] })
  } catch (error) {
    console.error("Error creating task history:", error)
    return NextResponse.json({ error: "Failed to create task history" }, { status: 500 })
  }
}
