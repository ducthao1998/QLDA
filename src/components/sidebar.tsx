"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

import {
  Sidebar as ShadSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar"

import {
  BarChart3Icon,
  CalendarIcon,
  ClipboardListIcon,
  FileTextIcon,
  HomeIcon,
  LayoutIcon,
  Settings2Icon,
  UsersIcon,
  // user-menu icons
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "./ui/separator"
import { ShadLogo } from "@/utils/logo"

/* -------------------------------------------------------------------------- */
/*                                DATA SECTION                                */
/* -------------------------------------------------------------------------- */

const navItems = [
  { title: "Tổng Quan",     href: "/dashboard",          icon: HomeIcon },
  { title: "Dự Án",         href: "/dashboard/projects", icon: LayoutIcon },
  { title: "Nhiệm Vụ",      href: "/dashboard/tasks",    icon: ClipboardListIcon },
  { title: "Nhóm",          href: "/dashboard/team",     icon: UsersIcon },
  { title: "Ma Trận RACI",  href: "/dashboard/raci",     icon: FileTextIcon },
  { title: "Biểu Đồ Gantt", href: "/dashboard/gantt",    icon: BarChart3Icon },
  { title: "Lịch",          href: "/dashboard/shedule", icon: CalendarIcon },
  { title: "Cài Đặt",       href: "/dashboard/settings", icon: Settings2Icon },
]

const currentUser = {
  name: "Nguyễn Văn A",
  email: "nva@example.com",
  avatar: "/avatars/user.jpg",
}

/* -------------------------------------------------------------------------- */
/*                                NAV USER UI                                 */
/* -------------------------------------------------------------------------- */

function NavUser() {
  const { isMobile } = useSidebar()
  const { name, email, avatar } = currentUser

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={avatar} alt={name} />
                <AvatarFallback className="rounded-lg">NV</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 truncate text-left text-sm leading-tight">
                <span className="truncate font-semibold">{name}</span>
                <span className="truncate text-xs">{email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={avatar} alt={name} />
                  <AvatarFallback className="rounded-lg">NV</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 truncate text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{name}</span>
                  <span className="truncate text-xs">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Sparkles />
                <span>Nâng cấp Pro</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/settings/account">
                  <BadgeCheck /> <span>Tài khoản</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <CreditCard /> <span>Billing</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/notifications">
                  <Bell /> <span>Thông báo</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem>
              <LogOut /> <span>Đăng xuất</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

/* -------------------------------------------------------------------------- */
/*                              MAIN SIDEBAR UI                               */
/* -------------------------------------------------------------------------- */

export function Sidebar(
  props: React.ComponentProps<typeof ShadSidebar>
) {
  const pathname = usePathname()
  const [isManager, setIsManager] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('position')
          .eq('id', user.id)
          .single()
        
        setIsManager(userData?.position === 'quản lý')
      }
    }

    checkUserRole()
  }, [])

  return (
    <ShadSidebar collapsible="icon" variant="floating" {...props}>
      {/* header */}
      <SidebarHeader className="flex items-center gap-2 px-4 py-3">
        <ShadLogo className="h-5 w-5 shrink-0 text-slate-900 dark:text-slate-100" />
        <span className="text-base font-semibold sidebar:hidden">
          HTQL Dự Án
        </span>
      </SidebarHeader>
      <Separator />
      {/* menu */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map(({ title, href, icon: Icon }) => {
              if (href === "/dashboard/team" && !isManager) {
                return null
              }
              return (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === href}
                    tooltip={title}
                  >
                    <Link href={href}>
                      <Icon className="h-5 w-5" />
                      <span>{title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <Separator />   
      {/* avatar + dropdown */}
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>

      {/* rail thu nhỏ */}
      <SidebarRail />
    </ShadSidebar>
  )
}
