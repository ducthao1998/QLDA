import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  try {
    const { id } = params

    const { data, error } = await supabase
      .from("task_raci")
      .select(`
        id,
        role,
        user_id,
        users:user_id (
          id,
          full_name,
          position,
          org_unit
        )
      `)
      .eq("task_id", id)

    if (error) {
      throw error
    }

    return NextResponse.json({ raci: data })
  } catch (error) {
    console.error("Error fetching RACI data:", error)
    return NextResponse.json({ error: "Không thể lấy dữ liệu RACI" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = params
  const body = await request.json()

  try {
    // Validate required fields
    if (!body.user_id || !body.role) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 })
    }

    // Insert RACI record
    const { data, error } = await supabase
      .from("task_raci")
      .insert({
        task_id: id,
        user_id: body.user_id,
        role: body.role,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ raci: data })
  } catch (error) {
    console.error("Error creating RACI:", error)
    return NextResponse.json({ error: "Không thể tạo RACI" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = params
  const url = new URL(request.url)
  const userId = url.searchParams.get("user_id")
  const role = url.searchParams.get("role")

  try {
    let query = supabase.from("task_raci").delete().eq("task_id", id)

    // If user_id and role are provided, delete specific RACI
    if (userId && role) {
      query = query.eq("user_id", userId).eq("role", role)
    }

    const { error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting RACI:", error)
    return NextResponse.json({ error: "Không thể xóa RACI" }, { status: 500 })
  }
}
