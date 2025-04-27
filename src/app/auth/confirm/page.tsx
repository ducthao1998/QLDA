"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

function ConfirmContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  if (!token) {
    return <div>Invalid token</div>
  }

  const confirmEmail = async () => {
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: "email"
      })

      if (error) {
        toast.error("Xác thực thất bại", { description: error.message })
        return
      }

      toast.success("Xác thực thành công")
      window.location.href = "/dashboard"
    } catch (error) {
      toast.error("Có lỗi xảy ra", { description: "Vui lòng thử lại sau" })
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold text-center">Xác thực email</h1>
        <p className="text-center text-gray-600">
          Nhấn nút bên dưới để xác thực email của bạn
        </p>
        <button
          onClick={confirmEmail}
          className="w-full px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Xác thực
        </button>
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConfirmContent />
    </Suspense>
  )
} 