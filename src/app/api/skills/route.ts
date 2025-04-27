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

  // Lấy danh sách kỹ năng
  const { data: skills, error } = await supabase.from("skills").select("id, name").order("name", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ skills })
}

export async function POST(request: Request) {
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

    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ error: "Tên kỹ năng không được để trống" }, { status: 400 })
    }

    // Kiểm tra xem kỹ năng đã tồn tại chưa
    const { data: existingSkill } = await supabase.from("skills").select("id").eq("name", body.name).maybeSingle()

    if (existingSkill) {
      return NextResponse.json({ error: "Kỹ năng này đã tồn tại trong hệ thống" }, { status: 400 })
    }

    // Tạo kỹ năng mới
    const { data: skill, error: skillError } = await supabase.from("skills").insert({ name: body.name }).select()

    if (skillError) {
      return NextResponse.json({ error: skillError.message }, { status: 500 })
    }

    return NextResponse.json({ skill: skill[0] })
  } catch (error) {
    console.error("Error creating skill:", error)
    return NextResponse.json({ error: "Lỗi khi tạo kỹ năng" }, { status: 500 })
  }
}
