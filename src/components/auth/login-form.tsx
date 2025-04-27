"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/password-input"
import { createBrowserClient } from "@supabase/ssr"
import { createClient } from "@/lib/supabase/server"
import { login } from "@/app/login/action"

const formSchema = z.object({
  email: z.string().email({ message: "Vui lòng nhập địa chỉ email hợp lệ." }),
  password: z.string().min(8, { message: "Mật khẩu phải có ít nhất 8 ký tự." }),
})
type FormData = z.infer<typeof formSchema>

export function LoginForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState<boolean>(false)

  // Khởi tạo form và lấy setError để bắn lỗi lên field
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  })
  const { setError } = form

  async function onSubmit(data: { email: string; password: string }) {
    setIsLoading(true)
    try {
      const formData = new FormData();
      formData.append('email', data.email);
      formData.append('password', data.password);
      const {error}  = await login(formData);
  
      if (error) {
        // Bắn lỗi lên trường email chung
            setError("email", { type: "manual", message: "Email hoặc mật khẩu không đúng." })
        return
      }
  
      router.refresh()
      router.push("/dashboard")
      toast.success("Đăng nhập thành công!")
    } catch (err) {
      // Trường hợp bất ngờ
      setError("email", { type: "manual", message: "Có lỗi xảy ra, vui lòng thử lại." })
    } finally {
      setIsLoading(false)
    }
  }
  return (
    <div className="grid gap-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="name@domain.com" {...field} />
                </FormControl>
                {/* FormMessage sẽ hiển thị cả lỗi validation lẫn lỗi manual */}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Password */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Mật khẩu</FormLabel>
                  <Button variant="link" className="px-0 font-normal" size="sm" asChild>
                    <a href="/reset-password">Quên mật khẩu?</a>
                  </Button>
                </div>
                <FormControl>
                  <PasswordInput placeholder="Nhập mật khẩu" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Button Đăng nhập */}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && (
              <svg
                className="animate-spin mr-2 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            )}
            Đăng nhập
          </Button>
        </form>
      </Form>
    </div>
  )
}
