// app/api/user/me/route.ts
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = createClient()
  const {
    data: { user: authUser },
    error: authError,
  } = await (await supabase).auth.getUser()

  if (authError || !authUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  }
  console.log(authUser)
  const { data: profile, error: profileError } = await (await supabase).from("users")
    .select("*")
    .eq("id", authUser.id)
    .single()

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ user: authUser, profile })
}
