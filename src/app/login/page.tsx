import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { LoginForm } from "@/components/auth/login-form"
import { ShadLogo } from "@/utils/logo"

export const metadata: Metadata = {
  title: "Đăng nhập | Hệ Thống Quản Lý Dự Án",
  description: "Đăng nhập để truy cập bảng điều khiển quản lý dự án",
}

export default function LoginPage() {
  return (
    <div className="container relative flex h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      {/* Bên trái */}
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
        <div className="absolute inset-0 bg-zinc-900">
          <Image
            src="/login.jpg"
            width={1920}
            height={1080}
            alt="Hình nền đăng nhập"
            className="h-full w-full object-cover opacity-20"
          />
        </div>
        <div className="relative z-20 flex items-center text-lg font-medium">
         <ShadLogo width={32} height={32}></ShadLogo>
          Hệ Thống Quản Lý Dự Án
        </div>
       
      </div>

      {/* Bên phải: Form */}
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Chào mừng trở lại</h1>
            <p className="text-sm text-muted-foreground">
              Nhập thông tin tài khoản để truy cập
            </p>
          </div>

          {/* Form đăng nhập */}
          <LoginForm />

          {/* Link đăng ký */}
          <p className="px-8 text-center text-sm text-muted-foreground">
            <Link href="/register" className="hover:text-brand underline underline-offset-4">
              Chưa có tài khoản? Đăng ký
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
