import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("id, full_name, position, org_unit, email, capacity_hrs")

    if (error) {
      throw error
    }

    return NextResponse.json({ users })
  } catch (error) {
    return NextResponse.json(
      { error: "Không thể lấy danh sách người dùng" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { full_name, email, phone_number, position, org_unit, capacity_hrs = 8 } = body

  if (!full_name || !email || !phone_number || !position || !org_unit) {
    return NextResponse.json(
      { error: "Vui lòng điền đầy đủ thông tin bắt buộc" },
      { status: 400 }
    )
  }

  try {
    // Tạo user trong Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: "password123",
      email_confirm: true,
      user_metadata: {
        full_name,
        position,
        phone_number,
        org_unit
      }
    })

    if (authError) {
      throw authError
    }

    if (!authData.user) {
      throw new Error("Không thể tạo người dùng")
    }

    // Tạo profile trong bảng users
    const { error: profileError } = await supabase
      .from("users")
      .insert({
        id: authData.user.id,
        full_name,
        email,
        position,
        phone_number,
        org_unit,
        capacity_hrs
      })

    if (profileError) {
      // Nếu tạo profile thất bại, xóa user trong auth
      await supabase.auth.admin.deleteUser(authData.user.id)
      throw profileError
    }

    // Gửi email xác nhận
    const { error: emailError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`
    })

    if (emailError) {
      console.error("Lỗi gửi email xác nhận:", emailError)
      // Không throw error ở đây vì user đã được tạo thành công
    }

    return NextResponse.json(
      { message: "Đã tạo người dùng thành công" },
      { status: 201 }
    )
  } catch (error) {
    console.error("Lỗi tạo người dùng:", error)
    return NextResponse.json(
      { error: "Không thể tạo người dùng" },
      { status: 500 }
    )
  }
}
