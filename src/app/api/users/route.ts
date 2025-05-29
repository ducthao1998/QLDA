import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("id, full_name, position, org_unit, email")

    if (error) {
      throw error
    }

    return NextResponse.json({ users })
  } catch (error) {
    return NextResponse.json({ error: "Không thể lấy danh sách người dùng" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient() // Client thông thường cho các thao tác không cần quyền admin
  const supabaseAdmin = createAdminClient() // Client admin cho các thao tác cần quyền admin

  // Kiểm tra quyền của người dùng hiện tại
  const {
    data: { user: currentUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !currentUser) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 401 })
  }

  // Lấy thông tin chi tiết của người dùng hiện tại từ bảng users
  const { data: currentUserData, error: userError } = await supabase
    .from("users")
    .select("position")
    .eq("id", currentUser.id)
    .single()

  if (userError || !currentUserData) {
    return NextResponse.json({ error: "Không thể xác minh quyền hạn" }, { status: 403 })
  }

  // Kiểm tra xem người dùng có phải là quản lý không
  if (currentUserData.position?.toLowerCase() !== "quản lý") {
    return NextResponse.json({ error: "Chỉ quản lý mới có quyền thêm người dùng mới" }, { status: 403 })
  }

  const body = await request.json()

  const { full_name, email, phone_number, position, org_unit} = body

  if (!full_name || !email || !phone_number || !position || !org_unit) {
    return NextResponse.json({ error: "Vui lòng điền đầy đủ thông tin bắt buộc" }, { status: 400 })
  }

  try {
    // Tạo user trong Supabase Auth sử dụng admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: "password123",
      email_confirm: false,
      user_metadata: {
        full_name,
        position,
        phone_number,
        org_unit,
      },
    })

    if (authError) {
      throw authError
    }

    if (!authData.user) {
      throw new Error("Không thể tạo người dùng")
    }

    // Tạo profile trong bảng users
    const { error: profileError } = await supabase.from("users").insert({
      id: authData.user.id,
      full_name,
      email,
      position,
      phone_number,
      org_unit,
    })

    if (profileError) {
      // Nếu tạo profile thất bại, xóa user trong auth
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw profileError
    }

    // Gửi email xác nhận
    try {
      const { error: emailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?token=650264713f74be04b81dc47bf3be902d0c73af2fb7bf716b07149fa9`,
      })

      if (emailError) {
        console.error("Lỗi gửi email xác nhận:", emailError)
        // Vẫn trả về thành công vì user đã được tạo
        return NextResponse.json(
          {
            message: "Đã tạo người dùng thành công",
            warning: "Không thể gửi email xác nhận",
          },
          { status: 201 },
        )
      }

      return NextResponse.json({ message: "Đã tạo người dùng và gửi email xác nhận thành công" }, { status: 201 })
    } catch (emailError) {
      console.error("Lỗi gửi email xác nhận:", emailError)
      // Vẫn trả về thành công vì user đã được tạo
      return NextResponse.json(
        {
          message: "Đã tạo người dùng thành công",
          warning: "Không thể gửi email xác nhận",
        },
        { status: 201 },
      )
    }
  } catch (error) {
    console.error("Lỗi tạo người dùng:", error)
    return NextResponse.json({ error: "Không thể tạo người dùng" }, { status: 500 })
  }
}
