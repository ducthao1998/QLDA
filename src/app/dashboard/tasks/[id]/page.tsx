import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import type React from "react"
import {
  ArrowLeftIcon,
  PencilIcon,
  LayersIcon,
  TagIcon,
  CalendarIcon,
  UserIcon,
  FileTextIcon,
  ScaleIcon,
  RefreshCwIcon,
  LayoutTemplateIcon as TemplateIcon,
  BuildingIcon,
  ClockIcon,
  InfoIcon,
  ClipboardListIcon,
  EyeIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  ArchiveIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import type { RaciRole, TaskStatus } from "@/app/types/table-types"
import { cn } from "@/lib/utils"
import { DependencyTreeVisualization } from "@/components/task/dependency-tree-visualization"

// Định nghĩa kiểu dữ liệu chi tiết cho task sau khi query
type UserInfo = { id: string; full_name: string | null; position: string | null }
type RaciInfo = { role: RaciRole; users: UserInfo | null }

type TaskDetail = {
  id: number
  name: string
  note: string | null
  status: TaskStatus
  project_id: string
  unit_in_charge: string | null
  template_id: number | null
  duration_days: number | null
  projects: { id: string; name: string } | null
  task_templates: { id: number; name: string } | null
  task_raci: RaciInfo[]
  task_skills: { skills: { id: number; name: string } | null }[]
}

// Map trạng thái công việc với màu sắc, nhãn và icon hiển thị (đồng nhất phong cách)
const statusMap: Record<
  TaskStatus,
  {
    label: string
    variant: "default" | "secondary" | "destructive" | "outline"
    color: string
    icon: React.ReactNode
  }
> = {
  todo: {
    label: "Cần làm",
    variant: "secondary",
    color: "bg-gray-100 text-gray-800",
    icon: <ClipboardListIcon className="h-4 w-4" />,
  },
  in_progress: {
    label: "Đang thực hiện",
    variant: "default",
    color: "bg-blue-100 text-blue-800",
    icon: <RefreshCwIcon className="h-4 w-4" />,
  },
  review: {
    label: "Đang review",
    variant: "secondary",
    color: "bg-amber-100 text-amber-800",
    icon: <EyeIcon className="h-4 w-4" />,
  },
  done: {
    label: "Hoàn thành",
    variant: "default",
    color: "bg-emerald-100 text-emerald-800",
    icon: <CheckCircleIcon className="h-4 w-4" />,
  },
  blocked: {
    label: "Bị chặn",
    variant: "destructive",
    color: "bg-red-100 text-red-800",
    icon: <AlertTriangleIcon className="h-4 w-4" />,
  },
  archived: {
    label: "Lưu trữ",
    variant: "outline",
    color: "bg-gray-200 text-gray-600",
    icon: <ArchiveIcon className="h-4 w-4" />,
  },
}

// Map vai trò RACI với mô tả
const raciMap: Record<RaciRole, { label: string; description: string; color: string }> = {
  R: { label: "Responsible", description: "Người thực hiện", color: "bg-blue-100 text-blue-800" },
  A: { label: "Accountable", description: "Người chịu trách nhiệm", color: "bg-green-100 text-green-800" },
  C: { label: "Consulted", description: "Người tư vấn", color: "bg-yellow-100 text-yellow-800" },
  I: { label: "Informed", description: "Người được thông báo", color: "bg-gray-100 text-gray-800" },
}

// Hàm helper để định dạng ngày
const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return "Chưa xác định"
  try {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: vi })
  } catch {
    return "Ngày không hợp lệ"
  }
}

// Hàm helper để tính số ngày còn lại
const getDaysRemaining = (endDate: string | null) => {
  if (!endDate) return null
  try {
    const end = new Date(endDate)
    const now = new Date()
    const diffTime = end.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  } catch {
    return null
  }
}

// Component chính cho trang chi tiết công việc (Server Component)
export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const param = await params;
  const { data: task, error } = await supabase
    .from("tasks")
    .select(`
        id, name, note, status,project_id,
        unit_in_charge, template_id, duration_days,
        projects ( id, name ),
        task_templates ( id, name ),
        task_raci ( role, users ( id, full_name, position ) ),
        task_skills ( skills ( id, name ) )
    `)
    .eq("id", param.id)
    .single<TaskDetail>()

  if (error) {
    console.error("Error fetching task:", error)
    notFound()
  }

  if (!task) {
    notFound()
  }

  const responsibleUser = task.task_raci.find((r) => r.role === "R")?.users
  const accountableUser = task.task_raci.find((r) => r.role === "A")?.users
  const statusInfo = statusMap[task.status] || statusMap.todo

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      {/* Gradient Hero */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 p-8 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <FileTextIcon className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{task.name}</h1>
                  <div className="flex items-center gap-2 text-blue-100 mt-1">
                    <BuildingIcon className="h-4 w-4" />
                    <span>Thuộc dự án:</span>
                    <Link
                      href={`/dashboard/projects/${task.project_id}`}
                      className="font-medium underline-offset-2 hover:underline text-white"
                    >
                      {task.projects?.name}
                    </Link>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 text-sm">
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                  <span className="flex items-center gap-1.5">
                    {statusInfo.icon}
                    {statusInfo.label}
                  </span>
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="secondary" asChild className="bg-white/20 hover:bg-white/30 text-white border-white/30">
                <Link href={`/dashboard/tasks/${task.id}/edit`}>
                  <PencilIcon className="mr-2 h-4 w-4" />
                  Chỉnh sửa
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Trạng thái</p>
                <p className="text-xl font-bold text-green-900">{statusInfo.label}</p>
              </div>
              <div className="h-10 w-10 bg-green-500 rounded-lg flex items-center justify-center">{statusInfo.icon}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Dự án</p>
                <p className="text-xl font-bold text-blue-900">{task.projects?.name || "Không xác định"}</p>
              </div>
              <div className="h-10 w-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <BuildingIcon className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Thời lượng (ngày)</p>
                <p className="text-xl font-bold text-purple-900">{task.duration_days ?? "Chưa xác định"}</p>
              </div>
              <div className="h-10 w-10 bg-purple-500 rounded-lg flex items-center justify-center">
                <ClockIcon className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600">Người thực hiện</p>
                <p className="text-xl font-bold text-amber-900">{responsibleUser?.full_name || "Chưa gán"}</p>
              </div>
              <div className="h-10 w-10 bg-amber-500 rounded-lg flex items-center justify-center">
                <UserIcon className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Cột trái: Thông tin chính */}
        <div className="lg:col-span-8 space-y-6">
          {/* Mô tả công việc */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileTextIcon className="h-5 w-5" />
                Mô tả công việc
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {task.note || "Không có mô tả chi tiết cho công việc này."}
              </p>
            </CardContent>
          </Card>

       

          {/* Phân công RACI */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                Ma trận phân công trách nhiệm (RACI)
              </CardTitle>
              <CardDescription>Phân định vai trò và trách nhiệm của từng thành viên trong công việc</CardDescription>
            </CardHeader>
            <CardContent>
              {task.task_raci.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {task.task_raci.map(({ role, users }) => (
                    <div key={role + users?.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                      <div className="flex flex-col items-center gap-1">
                        <Badge className={cn("text-xs font-bold", raciMap[role].color)}>{role}</Badge>
                        <span className="text-xs text-muted-foreground text-center">{raciMap[role].description}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{users?.full_name || "Chưa gán"}</p>
                        <p className="text-sm text-muted-foreground">{users?.position || "Chưa có chức vụ"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <UserIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Chưa có phân công RACI cho công việc này</p>
                </div>
              )}
            </CardContent>
          </Card>
             {/* Dependency Tree Visualization */}
   <DependencyTreeVisualization
        projectId={task.project_id}
        currentTaskId={task.id.toString()}
      />
        </div>

        {/* Cột phải: Thông tin tóm tắt */}
        <div className="lg:col-span-4 space-y-6">
          {/* Thông tin cơ bản */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <InfoIcon className="h-5 w-5" />
                Thông tin cơ bản
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">ID công việc:</span>
                  <Badge variant="outline" className="font-mono">
                    #{task.id}
                  </Badge>
                </div>

                <Separator />

                <div className="flex justify-between items-start">
                  <span className="text-sm text-muted-foreground">Người thực hiện:</span>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{responsibleUser?.full_name || "Chưa gán"}</p>
                    {responsibleUser?.position && (
                      <p className="text-xs text-muted-foreground">{responsibleUser.position}</p>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-start">
                  <span className="text-sm text-muted-foreground">Người chịu trách nhiệm:</span>
                  <div className="text-right">
                    <p className="font-semibold text-sm">{accountableUser?.full_name || "Chưa gán"}</p>
                    {accountableUser?.position && (
                      <p className="text-xs text-muted-foreground">{accountableUser.position}</p>
                    )}
                  </div>
                </div>


                <Separator />

                {task.template_id && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <TemplateIcon className="h-3 w-3" />
                      Template:
                    </span>
                    <span className="font-semibold text-sm">
                      {task.task_templates?.name || `Template #${task.template_id}`}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Thời gian */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Thời gian thực hiện
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Khoảng thời gian hoàn thành công việc:</span>
                  <span className="font-semibold text-sm">{task.duration_days}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          
          {/* Kỹ năng yêu cầu */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TagIcon className="h-5 w-5" />
                Kỹ năng yêu cầu
              </CardTitle>
            </CardHeader>
            <CardContent>
              {task.task_skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {task.task_skills.map(
                    ({ skills }) =>
                      skills && (
                        <Badge key={skills.id} variant="secondary" className="text-xs">
                          {skills.name}
                        </Badge>
                      ),
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <TagIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Không yêu cầu kỹ năng cụ thể</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
