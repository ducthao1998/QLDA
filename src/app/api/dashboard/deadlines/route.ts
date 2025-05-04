import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  try {
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select(`
        id,
        name,
        end_date,
        project:projects(id, name)
      `)
      .not("status", "eq", "done")
      .order("end_date", { ascending: true })
      .limit(5)

    if (error) throw error

    return NextResponse.json({ deadlines: tasks })
  } catch (error) {
    console.error("Error fetching upcoming deadlines:", error)
    return NextResponse.json({ error: "Không thể lấy dữ liệu hạn chót" }, { status: 500 })
  }
}
