import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  }

  try {
    // Lấy dữ liệu hiệu suất người dùng từ view
    const { data: performance, error } = await supabase
      .from("user_performance")
      .select("id, full_name, pct_on_time, avg_quality, perf_score")
      .order("perf_score", { ascending: false })

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ performance })
  } catch (error) {
    console.error("Error fetching user performance data:", error)
    return NextResponse.json({ error: "Lỗi khi tải dữ liệu hiệu suất người dùng" }, { status: 500 })
  }
}
