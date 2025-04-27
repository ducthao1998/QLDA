// app/layout.tsx
import type { Metadata } from "next"
import { Providers } from "../components/Provider"
import "./globals.css"
import { Toaster } from "sonner"

// Đây là Server Component, được phép export metadata
export const metadata: Metadata = {
  title: "Hệ Thống Quản Lý Dự Án",
  description: "Hệ Thống Quản Lý Dự Án Chính Phủ",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Nhúng Providers client-side vào đây */}
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  )
}
