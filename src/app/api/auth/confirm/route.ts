import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")

  if (!token) {
    return NextResponse.json(
      { error: "Token không hợp lệ" },
      { status: 400 }
    )
  }

  const supabase = createClient()

  try {
    const { data, error } = await (await supabase).auth.verifyOtp({
      token_hash: token,
      type: "email",
    })

    if (error) {
      return NextResponse.json(
        { error: "Xác nhận email thất bại" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { message: "Email đã được xác nhận thành công" },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: "Có lỗi xảy ra khi xác nhận email" },
      { status: 500 }
    )
  }
} 