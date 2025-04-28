"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function ConfirmEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        const token = searchParams.get("token")
        const type = searchParams.get("type")

        if (!token || type !== "invite") {
          setStatus("error")
          setError("Invalid confirmation link")
          return
        }

        const supabase = createClient()
        const { error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: "invite"
        })

        if (error) {
          setStatus("error")
          setError(error.message)
          return
        }

        setStatus("success")
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push("/login")
        }, 3000)
      } catch (err) {
        setStatus("error")
        setError("An unexpected error occurred")
      }
    }

    confirmEmail()
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Xác nhận email</CardTitle>
          <CardDescription>
            {status === "loading" && "Đang xác nhận email của bạn..."}
            {status === "success" && "Email của bạn đã được xác nhận thành công!"}
            {status === "error" && "Có lỗi xảy ra khi xác nhận email"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "loading" && (
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {status === "error" && (
            <div className="space-y-4">
              <p className="text-sm text-red-500">{error}</p>
              <Button
                onClick={() => router.push("/login")}
                className="w-full"
              >
                Quay lại trang đăng nhập
              </Button>
            </div>
          )}
          {status === "success" && (
            <div className="space-y-4">
              <p className="text-sm text-green-500">
                Bạn sẽ được chuyển hướng về trang đăng nhập trong giây lát...
              </p>
              <Button
                onClick={() => router.push("/login")}
                className="w-full"
              >
                Đi đến trang đăng nhập
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 