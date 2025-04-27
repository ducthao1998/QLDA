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

  // Lấy danh sách tổ chức ngoài
  const { data: organizations, error } = await supabase.from("external_orgs").select("id, name, contact_info")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ organizations })
}
