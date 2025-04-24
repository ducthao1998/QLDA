"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  BarChart3Icon,
  CalendarIcon,
  ClipboardListIcon,
  FileTextIcon,
  HomeIcon,
  LayoutIcon,
  Settings2Icon,
  UsersIcon,
} from "lucide-react"

const navItems = [
  {
    title: "Tổng Quan",
    href: "/dashboard",
    icon: HomeIcon,
  },
  {
    title: "Dự Án",
    href: "/dashboard/projects",
    icon: LayoutIcon,
  },
  {
    title: "Nhiệm Vụ",
    href: "/dashboard/tasks",
    icon: ClipboardListIcon,
  },
  {
    title: "Nhóm",
    href: "/dashboard/team",
    icon: UsersIcon,
  },
  {
    title: "Ma Trận RACI",
    href: "/dashboard/raci",
    icon: FileTextIcon,
  },
  {
    title: "Biểu Đồ Gantt",
    href: "/dashboard/gantt",
    icon: BarChart3Icon,
  },
  {
    title: "Lịch",
    href: "/dashboard/calendar",
    icon: CalendarIcon,
  },
  {
    title: "Cài Đặt",
    href: "/dashboard/settings",
    icon: Settings2Icon,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="hidden md:flex flex-col w-64 border-r bg-white dark:bg-gray-950 dark:border-gray-800">
      <div className="p-6">
        <h2 className="text-2xl font-bold">HTQL Dự Án</h2>
      </div>
      <nav className="flex-1 px-4 pb-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                  pathname === item.href
                    ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-50",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
