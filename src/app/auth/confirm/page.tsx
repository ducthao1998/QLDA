"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function ConfirmPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const token = searchParams.get("token")
    if (!token) {
      setStatus("error")
      setMessage("Token không hợp lệ")
      return
    }

    const confirmEmail = async () => {
      try {
        const response = await fetch(`/api/auth/confirm?token=${token}`)
        const data = await response.json()

        if (response.ok) {
          setStatus("success")
          setMessage(data.message)
        } else {
          setStatus("error")
          setMessage(data.error)
        }
      } catch (error) {
        setStatus("error")
        setMessage("Có lỗi xảy ra khi xác nhận email")
      }
    }

    confirmEmail()
  }, [searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Xác nhận Email</CardTitle>
          <CardDescription>
            {status === "loading" && "Đang xác nhận email..."}
            {status === "success" && "Xác nhận thành công"}
            {status === "error" && "Xác nhận thất bại"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-center">{message}</p>
          <div className="flex justify-center">
            <Button onClick={() => router.push("/")}>
              Quay lại trang chủ
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 