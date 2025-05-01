"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreHorizontalIcon, FileEditIcon, TrashIcon, EyeIcon, ListTodoIcon, UsersIcon } from "lucide-react"
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

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    try {
      setLoading(true)
      const response = await fetch("/api/projects")

      if (!response.ok) {
        throw new Error("Không thể tải danh sách dự án")
      }

      const data = await response.json()
      setProjects(data.projects || [])
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
            {projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                  Chưa có dự án nào. Hãy tạo dự án mới.
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project) => {
                const status = statusMap[project.status] || { label: project.status, variant: "secondary" }

                return (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.id.substring(0, 8)}</TableCell>
                    <TableCell>{project.name}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                  
                    <TableCell className="text-xs">
                      {format(new Date(project.start_date), "dd/MM/yyyy", { locale: vi })} -{" "}
                      {format(new Date(project.end_date), "dd/MM/yyyy", { locale: vi })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontalIcon className="h-4 w-4" />
                            <span className="sr-only">Mở menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => router.push(`/dashboard/projects/${project.id}`)}>
                            <EyeIcon className="h-4 w-4 mr-2" />
                            Xem chi tiết
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/dashboard/projects/${project.id}/edit`)}>
                            <FileEditIcon className="h-4 w-4 mr-2" />
                            Chỉnh sửa dự án
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/dashboard/projects/${project.id}?tab=tasks`)}>
                            <ListTodoIcon className="h-4 w-4 mr-2" />
                            Xem nhiệm vụ
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/dashboard/projects/${project.id}?tab=raci`)}>
                            <UsersIcon className="h-4 w-4 mr-2" />
                            Ma trận RACI
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onClick={() => setProjectToDelete(project.id)}>
                            <TrashIcon className="h-4 w-4 mr-2" />
                            Xóa dự án
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
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
