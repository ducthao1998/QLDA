"use client"

import type React from "react"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { getUserPermissions, type UserPermissions } from "@/lib/permissions"
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

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  requiresPermission?: keyof UserPermissions
}

const navItems: NavItem[] = [
  { title: "Tổng Quan", href: "/dashboard", icon: HomeIcon },
  { title: "Dự Án", href: "/dashboard/projects", icon: LayoutIcon },
  {
    title: "Nhiệm Vụ",
    href: "/dashboard/tasks",
    icon: ClipboardListIcon,
    requiresPermission: "canViewTasks",
  },
  {
    title: "Nhóm",
    href: "/dashboard/team",
    icon: UsersIcon,
    requiresPermission: "canViewTeam",
  },
  { title: "Ma Trận RACI", href: "/dashboard/raci", icon: FileTextIcon },
  {
    title: "Biểu Đồ Gantt",
    href: "/dashboard/gantt",
    icon: BarChart3Icon,
    requiresPermission: "canViewGantt",
  },
  { title: "Lịch", href: "/dashboard/schedule", icon: CalendarIcon },
  { title: "Cài Đặt", href: "/dashboard/settings", icon: Settings2Icon },
]

interface CurrentUser {
  name: string
  email: string
  avatar: string
  position: string
}

/* -------------------------------------------------------------------------- */
/*                                NAV USER UI                                 */
/* -------------------------------------------------------------------------- */
function NavUser({ currentUser }: { currentUser: CurrentUser | null }) {
  const { isMobile } = useSidebar()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  if (!currentUser) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarFallback className="rounded-lg">?</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 truncate text-left text-sm leading-tight">
              <span className="truncate font-semibold">Đang tải...</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  const { name, email, avatar, position } = currentUser

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
                <AvatarImage src={avatar || "/placeholder.svg"} alt={name} />
                <AvatarFallback className="rounded-lg">{name?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
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
                  <AvatarImage src={avatar || "/placeholder.svg"} alt={name} />
                  <AvatarFallback className="rounded-lg">{name?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 truncate text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{name}</span>
                  <span className="truncate text-xs">{email}</span>
                  <span className="truncate text-xs text-muted-foreground">{position}</span>
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
            <DropdownMenuItem onClick={handleLogout}>
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
export function Sidebar(props: React.ComponentProps<typeof ShadSidebar>) {
  const pathname = usePathname()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [userPermissions, setUserPermissions] = useState<UserPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          const { data: userData } = await supabase
            .from("users")
            .select("full_name, position, org_unit")
            .eq("id", user.id)
            .single()

          if (userData) {
            const permissions = getUserPermissions(userData.position || "")

            setCurrentUser({
              name: userData.full_name || "Người dùng",
              email: user.email || "",
              avatar: "/avatars/user.jpg", // Default avatar
              position: userData.position || "Chưa xác định",
            })

            setUserPermissions(permissions)
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [])

  // Filter nav items based on permissions
  const filteredNavItems = navItems.filter((item) => {
    if (!item.requiresPermission || !userPermissions) {
      return true
    }
    return userPermissions[item.requiresPermission] === true
  })

  if (loading) {
    return (
      <ShadSidebar collapsible="icon" variant="floating" {...props}>
        <SidebarHeader className="flex items-center gap-2 px-4 py-3">
          <ShadLogo className="h-5 w-5 shrink-0 text-slate-900 dark:text-slate-100" />
          <span className="text-base font-semibold sidebar:hidden">HTQL Dự Án</span>
        </SidebarHeader>
        <Separator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {/* Loading skeleton */}
              {Array.from({ length: 6 }).map((_, i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuButton disabled>
                    <div className="h-5 w-5 bg-muted rounded animate-pulse" />
                    <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </ShadSidebar>
    )
  }

  return (
    <ShadSidebar
      collapsible="icon"
      variant="floating"
      className="bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:bg-gray-950/80"
      {...props}
    >
      {/* header */}
      <SidebarHeader className="px-3 pt-3 pb-2">
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 p-3 text-white">
          <div className="absolute inset-0 bg-white/5" />
          <div className="relative z-10 flex items-center gap-2">
            <ShadLogo className="h-5 w-5 shrink-0 text-white" />
            <span className="text-sm font-semibold tracking-wide sidebar:hidden">HTQL Dự Án</span>
          </div>
        </div>
      </SidebarHeader>
      <Separator />

      {/* menu */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {filteredNavItems.map(({ title, href, icon: Icon }) => (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === href}
                  tooltip={title}
                  className="rounded-lg transition-colors data-[active=true]:bg-gradient-to-r data-[active=true]:from-blue-50 data-[active=true]:to-blue-100 data-[active=true]:text-blue-900 dark:data-[active=true]:from-slate-800 dark:data-[active=true]:to-slate-700 data-[active=true]:border-l-4 data-[active=true]:border-blue-500 hover:bg-muted"
                >
                  <Link href={href} className="flex items-center gap-2">
                    <Icon className="h-5 w-5" />
                    <span>{title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <Separator />

      {/* avatar + dropdown */}
      <SidebarFooter>
        <NavUser currentUser={currentUser} />
      </SidebarFooter>

      {/* rail thu nhỏ */}
      <SidebarRail />
    </ShadSidebar>
  )
}
