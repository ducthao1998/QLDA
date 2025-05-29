import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  try {
    const { id } = await params

    // Simple endpoint for task edit form - just return basic dependency data
    const { data, error } = await supabase
      .from("task_dependencies")
      .select("id, task_id, depends_on_id")
      .eq("task_id", id)

    if (error) {
      throw error
    }

    return NextResponse.json({ dependencies: data || [] })
  } catch (error) {
    console.error("Error fetching task dependencies:", error)
    return NextResponse.json({ error: "Không thể lấy danh sách phụ thuộc" }, { status: 500 })
  }
} 