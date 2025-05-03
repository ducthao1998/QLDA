import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  try {
    const { data: skills, error } = await supabase
      .from("skills")
      .select("*")
      .order("name")

    if (error) {
      throw error
    }

    return NextResponse.json({ skills })
  } catch (error) {
    console.error("Error fetching skills:", error)
    return NextResponse.json({ error: "Không thể lấy danh sách lĩnh vực" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  const { name } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: "Tên lĩnh vực không được để trống" }, { status: 400 })
  }

  try {
    const { data: skill, error } = await supabase
      .from("skills")
      .insert({ name: name.trim() })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ skill })
  } catch (error) {
    console.error("Error creating skill:", error)
    return NextResponse.json({ error: "Không thể thêm lĩnh vực mới" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const body = await request.json()
  const { skillIds } = body

  if (!Array.isArray(skillIds) || skillIds.length === 0) {
    return NextResponse.json({ error: "Vui lòng chọn ít nhất một lĩnh vực để xóa" }, { status: 400 })
  }

  try {
    // Xóa các task_skills liên quan trước
    const { error: taskSkillsError } = await supabase
      .from("task_skills")
      .delete()
      .in("skill_id", skillIds)

    if (taskSkillsError) {
      throw taskSkillsError
    }

    // Xóa các user_skills liên quan
    const { error: userSkillsError } = await supabase
      .from("user_skills")
      .delete()
      .in("skill_id", skillIds)

    if (userSkillsError) {
      throw userSkillsError
    }

    // Xóa các skills
    const { error: skillsError } = await supabase
      .from("skills")
      .delete()
      .in("id", skillIds)

    if (skillsError) {
      throw skillsError
    }

    return NextResponse.json({ message: "Đã xóa lĩnh vực thành công" })
  } catch (error) {
    console.error("Error deleting skills:", error)
    return NextResponse.json({ error: "Không thể xóa lĩnh vực" }, { status: 500 })
  }
}
