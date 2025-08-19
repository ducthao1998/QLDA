"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreHorizontalIcon, FileEditIcon, TrashIcon, EyeIcon, ListTodoIcon, UsersIcon, FolderKanban, BarChart4Icon, CheckCircleIcon, ClipboardListIcon, PlusIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { LoadingSpinner } from "@/components/ui/loading"
import Link from "next/link"
import { ClockIcon } from "lucide-react"

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  planning: { label: "Lập kế hoạch", variant: "secondary" },
  in_progress: { label: "Đang thực hiện", variant: "default" },
  on_hold: { label: "Tạm dừng", variant: "outline" },
  completed: { label: "Hoàn thành", variant: "default" },
  cancelled: { label: "Đã hủy", variant: "destructive" },
}

export function ProjectsList() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ProjectsListContent />
    </Suspense>
  )
}

function ProjectsListContent() {
  const router = useRouter()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [userPermissions, setUserPermissions] = useState<{
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
  }>({
    canCreate: false,
    canEdit: false,
    canDelete: false
  })

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    try {
      setLoading(true)
      const response = await fetch("/api/projects")
      console.log("API projects data:", response)
      if (!response.ok) {
        throw new Error("Không thể tải danh sách dự án")
      }

      const data = await response.json()
      setProjects(data.projects || [])
      setUserPermissions(data.userPermissions)
    } catch (error) {
      console.error("Lỗi khi tải dự án:", error)
      toast.error("Lỗi",{
        description: "Không thể tải danh sách dự án",
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteProject(id: string) {
    try {
      setIsDeleting(true)

      const response = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Có lỗi xảy ra khi xóa dự án")
      }

      toast.success( "Xóa dự án thành công",{
        description: "Dự án đã được xóa khỏi hệ thống",
      })

      // Refresh projects list
      fetchProjects()
    } catch (error) {
      console.error("Lỗi:", error)
      toast("Lỗi",{
        description: error instanceof Error ? error.message : "Có lỗi xảy ra khi xóa dự án",
      })
    } finally {
      setIsDeleting(false)
      setProjectToDelete(null)
    }
  }

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Trạng Thái</TableHead>
              <TableHead>Thời Gian</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map((i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-4 w-[60px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[200px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-6 w-[100px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[100px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-[150px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-8 rounded-full" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header with stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Tổng dự án</p>
                  <p className="text-2xl font-bold text-blue-900">{projects.length}</p>
                </div>
                <div className="h-8 w-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <FolderKanban className="h-4 w-4 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Đang thực hiện</p>
                  <p className="text-2xl font-bold text-green-900">
                    {projects.filter(p => p.status === 'in_progress').length}
                  </p>
                </div>
                <div className="h-8 w-8 bg-green-500 rounded-lg flex items-center justify-center">
                  <BarChart4Icon className="h-4 w-4 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-600">Hoàn thành</p>
                  <p className="text-2xl font-bold text-emerald-900">
                    {projects.filter(p => p.status === 'completed').length}
                  </p>
                </div>
                <div className="h-8 w-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <CheckCircleIcon className="h-4 w-4 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-600">Lập kế hoạch</p>
                  <p className="text-2xl font-bold text-amber-900">
                    {projects.filter(p => p.status === 'planning').length}
                  </p>
                </div>
                <div className="h-8 w-8 bg-amber-500 rounded-lg flex items-center justify-center">
                  <ClipboardListIcon className="h-4 w-4 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.length === 0 ? (
            <div className="col-span-full">
              <Card className="border-dashed border-2 border-gray-300">
                <CardContent className="p-12 text-center">
                  <FolderKanban className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Chưa có dự án nào</h3>
                  <p className="text-gray-500 mb-4">
                    {userPermissions.canCreate ? "Bắt đầu tạo dự án đầu tiên của bạn" : "Liên hệ admin để tạo dự án"}
                  </p>
                  {userPermissions.canCreate && (
                    <Button asChild>
                      <Link href="/dashboard/projects/new">
                        <PlusIcon className="mr-2 h-4 w-4" />
                        Tạo dự án mới
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            projects.map((project) => {
              const status = statusMap[project.status] || { label: project.status, variant: "secondary" }
              const statusColors = {
                planning: "bg-amber-100 text-amber-800 border-amber-200",
                in_progress: "bg-green-100 text-green-800 border-green-200",
                on_hold: "bg-orange-100 text-orange-800 border-orange-200",
                completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
                cancelled: "bg-red-100 text-red-800 border-red-200"
              }
              
              return (
                <Card key={project.id} className="group hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg font-semibold group-hover:text-blue-600 transition-colors">
                          <Link href={`/dashboard/projects/${project.id}`} className="hover:underline">
                            {project.name}
                          </Link>
                        </CardTitle>
                        <CardDescription className="mt-1 line-clamp-2">
                          {project.description || "Không có mô tả"}
                        </CardDescription>
                      </div>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Thao tác</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/projects/${project.id}`}>
                              <EyeIcon className="mr-2 h-4 w-4" />
                              Xem chi tiết
                            </Link>
                          </DropdownMenuItem>
                          {userPermissions.canEdit && (
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/projects/${project.id}/edit`}>
                                <FileEditIcon className="mr-2 h-4 w-4" />
                                Chỉnh sửa
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {userPermissions.canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => setProjectToDelete(project.id)}
                              >
                                <TrashIcon className="mr-2 h-4 w-4" />
                                Xóa
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge 
                        variant="outline" 
                        className={`${statusColors[project.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800 border-gray-200'}`}
                      >
                        {status.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ID: {project.id}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ClockIcon className="h-4 w-4" />
                      <span>
                        Bắt đầu: {format(new Date(project.start_date), "dd/MM/yyyy", { locale: vi })}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <UsersIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {project.users?.full_name || "Chưa phân công"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>

      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể hoàn tác. Dự án này sẽ bị xóa vĩnh viễn khỏi hệ thống.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => projectToDelete && handleDeleteProject(projectToDelete)}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Đang xóa..." : "Xóa dự án"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
