"use client"
import { ReactNode, useEffect } from "react"
import { useSession } from "@supabase/auth-helpers-react"
import { useRouter } from "next/navigation"

export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session === null) router.push("/login")
  }, [session, router])

  if (!session) return null
  return <>{children}</>
}
