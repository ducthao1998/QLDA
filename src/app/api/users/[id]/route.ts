import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  if (!currentUser) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 })
  }

  // Optional: check role/position if needed
  const { data: currentUserData } = await supabase
    .from("users")
    .select("position")
    .eq("id", currentUser.id)
    .single()

  // Only managers can edit others (relax rule if needed)
  if (currentUserData?.position?.toLowerCase() !== "quản lý" && currentUser.id !== params.id) {
    return NextResponse.json({ error: "Không có quyền chỉnh sửa" }, { status: 403 })
  }

  const body = await request.json()
  const { full_name, email, phone_number, position, org_unit } = body || {}

  try {
    const { error } = await supabase
      .from("users")
      .update({ full_name, email, phone_number, position, org_unit })
      .eq("id", params.id)

    if (error) throw error

    return NextResponse.json({ message: "Cập nhật thành công" }, { status: 200 })
  } catch (e) {
    return NextResponse.json({ error: "Không thể cập nhật người dùng" }, { status: 500 })
  }
}


