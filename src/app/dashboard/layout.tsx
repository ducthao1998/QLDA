"use client"
import type React from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import  {Header as LayoutHeader }   from "@/components/layout/header"

import { SidebarProvider } from "@/components/ui/sidebar"
import { RequireAuth } from "@/components/RequireAuth"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden">
    <SidebarProvider>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
      <LayoutHeader fixed />
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">{children}</main>
      </div>
    </SidebarProvider>
    </div>
  )
}
