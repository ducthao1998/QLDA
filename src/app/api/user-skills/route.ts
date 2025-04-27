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

  // Lấy danh sách kỹ năng của người dùng
  const { data: userSkills, error } = await supabase.from("user_skills").select("user_id, skill_id, level")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ userSkills })
}

export async function PUT(request: Request) {
  const supabase = await createClient()

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { updates } = body

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "Không có dữ liệu cập nhật" }, { status: 400 })
    }

    // Xử lý từng cập nhật
    for (const update of updates) {
      const { user_id, skill_id, level } = update

      if (!user_id || !skill_id) {
        continue
      }

      // Kiểm tra xem bản ghi đã tồn tại chưa
      const { data: existingSkill } = await supabase
        .from("user_skills")
        .select("user_id, skill_id")
        .eq("user_id", user_id)
        .eq("skill_id", skill_id)
        .maybeSingle()

      if (level === 0) {
        // Nếu level = 0, xóa bản ghi nếu tồn tại
        if (existingSkill) {
          await supabase.from("user_skills").delete().eq("user_id", user_id).eq("skill_id", skill_id)
        }
      } else {
        // Nếu level > 0, cập nhật hoặc thêm mới
        if (existingSkill) {
          await supabase.from("user_skills").update({ level }).eq("user_id", user_id).eq("skill_id", skill_id)
        } else {
          await supabase.from("user_skills").insert({
            user_id,
            skill_id,
            level,
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating user skills:", error)
    return NextResponse.json({ error: "Lỗi khi cập nhật kỹ năng người dùng" }, { status: 500 })
  }
}
