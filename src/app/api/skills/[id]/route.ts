import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const body = await request.json()
  const { name } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: "Tên lĩnh vực không được để trống" }, { status: 400 })
  }

  try {
    const { data: skill, error } = await supabase
      .from("skills")
      .update({ name: name.trim() })
      .eq("id", params.id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ skill })
  } catch (error) {
    console.error("Error updating skill:", error)
    return NextResponse.json({ error: "Không thể cập nhật lĩnh vực" }, { status: 500 })
  }
} 