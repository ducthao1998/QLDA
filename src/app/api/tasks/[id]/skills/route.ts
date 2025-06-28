import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  try {
    const { id } = await params

    const { data, error } = await supabase.from("task_skills").select("skill_id, skills(id, name)").eq("task_id", id)

    if (error) {
      throw error
    }

    return NextResponse.json({ skills: data })
  } catch (error) {
    console.error("Error fetching task skills:", error)
    return NextResponse.json({ error: "Không thể lấy danh sách kỹ năng" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await params
  const { skill_ids } = await request.json()

  try {
    // Validate input
    if (!Array.isArray(skill_ids) || skill_ids.length === 0) {
      return NextResponse.json({ error: "Danh sách skill_ids không hợp lệ" }, { status: 400 })
    }

    // Insert task skills
    const taskSkills = skill_ids.map((skill_id) => ({
      task_id: id,
      skill_id,
    }))

    const { error } = await supabase.from("task_skills").insert(taskSkills)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error adding task skills:", error)
    return NextResponse.json({ error: "Không thể thêm kỹ năng cho công việc" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await params
  const { skills } = await request.json()

  try {
    // Validate input
    if (!Array.isArray(skills)) {
      return NextResponse.json({ error: "Danh sách skills không hợp lệ" }, { status: 400 })
    }

    // Delete all existing task skills
    const { error: deleteError } = await supabase
      .from("task_skills")
      .delete()
      .eq("task_id", id)

    if (deleteError) {
      throw deleteError
    }

    // Add new task skills if any
    if (skills.length > 0) {
      const taskSkills = skills.map((skill_id) => ({
        task_id: id,
        skill_id,
      }))

      const { error: insertError } = await supabase
        .from("task_skills")
        .insert(taskSkills)

      if (insertError) {
        throw insertError
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating task skills:", error)
    return NextResponse.json({ error: "Không thể cập nhật kỹ năng cho công việc" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await params

  try {
    const { error } = await supabase.from("task_skills").delete().eq("task_id", id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting task skills:", error)
    return NextResponse.json({ error: "Không thể xóa kỹ năng của công việc" }, { status: 500 })
  }
}
