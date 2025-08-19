import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Lịch dự án",
  description: "Xem lịch và tiến độ các công việc trong dự án",
}

export default function ScheduleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="container py-6">{children}</div>
}


