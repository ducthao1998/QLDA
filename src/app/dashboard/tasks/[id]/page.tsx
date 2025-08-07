import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
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

// Map trạng thái công việc với màu sắc và nhãn hiển thị
const statusMap: Record<TaskStatus, { label: string; className: string; icon: string }> = {
  todo: { label: "Cần làm", className: "bg-gray-100 text-gray-800 border-gray-300", icon: "⏳" },
  in_progress: { label: "Đang thực hiện", className: "bg-blue-100 text-blue-800 border-blue-300", icon: "🔄" },
  review: { label: "Đang review", className: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: "👀" },
  done: { label: "Hoàn thành", className: "bg-green-100 text-green-800 border-green-300", icon: "✅" },
  blocked: { label: "Bị chặn", className: "bg-red-100 text-red-800 border-red-300", icon: "🚫" },
  archived: { label: "Lưu trữ", className: "bg-gray-100 text-gray-600 border-gray-300", icon: "📦" },
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
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/projects/${task.project_id}`}>
              <ArrowLeftIcon className="mr-2 h-4 w-4" />
              Quay lại Dự án
            </Link>
          </Button>

          <div className="flex items-center gap-3">
            <Badge className={cn("text-sm border", statusInfo.className)}>
              <span className="mr-1">{statusInfo.icon}</span>
              {statusInfo.label}
            </Badge>
            <Button asChild>
              <Link href={`/dashboard/tasks/${task.id}/edit`}>
                <PencilIcon className="mr-2 h-4 w-4" />
                Chỉnh sửa
              </Link>
            </Button>
          </div>
        </div>

        {/* Task Title & Project Info */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{task.name}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <BuildingIcon className="h-4 w-4" />
            <span>Thuộc dự án:</span>
            <Link href={`/dashboard/projects/${task.project_id}`} className="font-medium text-primary hover:underline">
              {task.projects?.name}
            </Link>
          </div>
        </div>
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
