"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import {
  CalendarIcon,
  ClockIcon,
  FileEditIcon,
  UsersIcon,
  BarChart4Icon,
  AlertTriangleIcon,
  CheckCircleIcon,
  PauseCircleIcon,
  ClipboardListIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProjectTasks } from "@/components/project/project-tasks"
import { ProjectRaci } from "@/components/project/project-raci" 
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Project, TaskStatus } from "@/app/types/table-types"

const statusMap: Record<
  TaskStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  todo: {
    label: "Chưa bắt đầu",
    color: "bg-gray-100 text-gray-800",
    icon: <ClipboardListIcon className="h-4 w-4" />,
  },
  in_progress: {
    label: "Đang thực hiện",
    color: "bg-green-100 text-green-800",
    icon: <BarChart4Icon className="h-4 w-4" />,
  },
  blocked: {
    label: "Bị khoá",
    color: "bg-amber-100 text-amber-800",
    icon: <PauseCircleIcon className="h-4 w-4" />,
  },
  review: {
    label: "Đang xem xét",
    color: "bg-blue-100 text-blue-800",
    icon: <AlertTriangleIcon className="h-4 w-4" />,
  },
  done: {
    label: "Hoàn thành",
    color: "bg-emerald-100 text-emerald-800",
    icon: <CheckCircleIcon className="h-4 w-4" />,
  },
  archived: {
    label: "Lưu trữ",
    color: "bg-gray-200 text-gray-600",
    icon: <AlertTriangleIcon className="h-4 w-4" />,
  },
}


const priorityLabelMap: Record<number, string> = {
    1: "Cao nhất",
    2: "Cao",
    3: "Trung bình",
    4: "Thấp",
    5: "Thấp nhất",
  }
  
  const priorityColorMap: Record<number, string> = {
    1: "bg-red-100 text-red-800",
    2: "bg-orange-100 text-orange-800",
    3: "bg-yellow-100 text-yellow-800",
    4: "bg-blue-100 text-blue-800",
    5: "bg-gray-100 text-gray-800",
  }
export function ProjectDetails({ project }: { project: Project }) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const status = statusMap[project.status] || {
    label: project.status,
    color: "bg-gray-100 text-gray-800",
    icon: null,
  }

  const priorityLabel = priorityLabelMap[project.priority] ?? "Không xác định"
  const priorityColor =
    priorityColorMap[project.priority] ?? "bg-gray-100 text-gray-800"
  async function handleDelete() {
    try {
      setIsDeleting(true)

      const response = await fetch(`/api/projects/${project.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Có lỗi xảy ra khi xóa dự án")
      }

      toast.success("Xóa dự án thành công",{
        description: "Dự án đã được xóa khỏi hệ thống",
      })

      router.push("/dashboard/projects")
      router.refresh()
    } catch (error) {
      console.error("Lỗi:", error)
      toast.error("Lỗi",{
        description: error instanceof Error ? error.message : "Có lỗi xảy ra khi xóa dự án",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge className={status.color}>
              <span className="flex items-center gap-1">
                {status.icon}
                {status.label}
              </span>
            </Badge>
            <Badge className={priorityColor}>Ưu tiên: {priorityLabel}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/dashboard/projects/${project.id}/edit`)}>
            <FileEditIcon className="mr-2 h-4 w-4" />
            Chỉnh sửa
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Xóa dự án</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
                <AlertDialogDescription>
                  Hành động này không thể hoàn tác. Dự án này sẽ bị xóa vĩnh viễn khỏi hệ thống.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700">
                  {isDeleting ? "Đang xóa..." : "Xóa dự án"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Thời gian</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-2">
              <div className="flex items-center">
                <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="text-sm">
                  Bắt đầu: {format(new Date(project.start_date), "dd/MM/yyyy", { locale: vi })}
                </span>
              </div>
              <div className="flex items-center">
                <ClockIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="text-sm">
                  Hạn chót: {format(new Date(project.deadline), "dd/MM/yyyy", { locale: vi })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Người tạo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <UsersIcon className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="text-sm">{project.users?.full_name || "Không xác định"}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {project.users?.position && project.users?.org_unit
                ? `${project.users.position}, ${project.users.org_unit}`
                : ""}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tiến độ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${project.progress || 0}%` }}></div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{project.progress || 0}% hoàn thành</span>
                <span>
                  {project.tasks_completed || 0}/{project.tasks_total || 0} nhiệm vụ
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mô tả dự án</CardTitle>
          <CardDescription>Chi tiết phạm vi và mục tiêu</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <p>{project.description}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="tasks">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tasks">Nhiệm vụ</TabsTrigger>
          <TabsTrigger value="raci">Ma trận RACI</TabsTrigger>
          <TabsTrigger value="gantt">Biểu đồ Gantt</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks" className="mt-6">
          <ProjectTasks projectId={project.id} />
        </TabsContent>
        <TabsContent value="raci" className="mt-6">
          <ProjectRaci projectId={project.id} />
        </TabsContent>
        <TabsContent value="gantt" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Biểu đồ Gantt</CardTitle>
              <CardDescription>Lịch trình và tiến độ dự án theo thời gian</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96 flex items-center justify-center border rounded-md bg-muted/20">
                <p className="text-muted-foreground">Tính năng biểu đồ Gantt đang được phát triển</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
