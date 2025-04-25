// app/api/user/me/route.ts
import { headers, cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { NextResponse } from "next/server"

export async function GET() {
  // ① Create a Supabase client bound to this request’s cookies & headers
  const supabase = createRouteHandlerClient({  cookies })
    console.log("supabase", supabase)
  // ② Get the current session
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()

  if (sessionError || !session) {
    return NextResponse.json(
      { error: "Chưa đăng nhập?" },
      { status: 401 }
    )
  }

  // ③ Fetch the user’s profile from your `users` table
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("full_name, position, org_unit, capacity_hrs")
    .eq("id", session.user.id)
    .single()

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 500 }
    )
  }

  // ④ Return both auth info and profile
  return NextResponse.json({
    user: session.user,
    profile,
  })
}
