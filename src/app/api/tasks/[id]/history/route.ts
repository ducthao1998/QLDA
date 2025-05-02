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
      .order("at", { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ history: data })
  } catch (error) {
    console.error("Error fetching task history:", error)
    return NextResponse.json({ error: "Không thể lấy lịch sử công việc" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  try {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 })
    }

    // Insert history record
    const { data, error } = await supabase
      .from("task_history")
      .insert({
        task_id: id,
        user_id: user.id,
        action: body.action,
        from_val: body.from_val,
        to_val: body.to_val,
        at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ history: data })
  } catch (error) {
    console.error("Error recording task history:", error)
    return NextResponse.json({ error: "Không thể ghi lịch sử công việc" }, { status: 500 })
  }
}
