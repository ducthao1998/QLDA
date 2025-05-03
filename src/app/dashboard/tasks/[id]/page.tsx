import type React from "react"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import { format, formatDuration } from "date-fns"
import { vi } from "date-fns/locale"
import {
  ClockIcon,
  AlertCircleIcon,
  UserIcon,
  CalendarIcon,
  FileTextIcon,
  TagIcon,
  EditIcon,
  LightbulbIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  BriefcaseIcon,
  LinkIcon,
  BarChartIcon,
} from "lucide-react"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import { calculateRiskPrediction } from "@/algorithm/risk-prediction"
import { calculateTaskWeight } from "@/algorithm/task-weight"
import { calculateEstimatedTime } from "@/algorithm/estimated-time"
import { createClient } from "@/lib/supabase/server"
import { RaciRole, Skill } from "@/app/types/table-types"

type Params = { id: string }

const statusColors: Record<
  string,
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: React.ReactNode }
> = {
  todo: { variant: "secondary", label: "Chưa bắt đầu", icon: <InfoIcon className="h-4 w-4 mr-2" /> },
  in_progress: { variant: "default", label: "Đang thực hiện", icon: <BarChartIcon className="h-4 w-4 mr-2" /> },
  review: { variant: "secondary", label: "Đang xem xét", icon: <AlertTriangleIcon className="h-4 w-4 mr-2" /> },
  completed: { variant: "default", label: "Hoàn thành", icon: <CheckCircleIcon className="h-4 w-4 mr-2" /> },
  blocked: { variant: "destructive", label: "Bị chặn", icon: <XCircleIcon className="h-4 w-4 mr-2" /> },
  archived: { variant: "outline", label: "Lưu trữ", icon: <BriefcaseIcon className="h-4 w-4 mr-2" /> },
  done: { variant: "default", label: "Hoàn thành", icon: <CheckCircleIcon className="h-4 w-4 mr-2" /> },
}

export default async function TaskDetailPage({ params }: { params: Params }) {
  const { id } = await params
  const headersList = await headers()
  const host = headersList.get("host") || "localhost:3000"
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https"

  try {
    // Fetch task data
    const { data: task, error } = await (await createClient())
      .from("tasks")
      .select(`
      *,
      users:assigned_to (
        full_name,
        position,
        org_unit
      ),
      projects (
        name
      ),
      phases:phase_id (
        name
      ),
      task_skills (
        skill:skills (
          id,
          name
        )
      )
    `)
      .eq("id", id)
      .single()

    if (error) {
      console.error("Error fetching task:", error)
      notFound()
    }

    if (!task) {
      console.error("Task not found")
      notFound()
    }

    // Fetch RACI matrix data
    const { data: raciData, error: raciError } = await (await createClient())
      .from("task_raci")
      .select(`
    id,
    role,
    users:user_id (
      id,
      full_name,
      position,
      org_unit
    )
  `)
      .eq("task_id", id)

    if (raciError) {
      console.error("Error fetching RACI data:", raciError)
    }

    // Add RACI data to task
    task.task_raci = raciData || []

    console.log("Fetched task data:", task)

    // Process task data with defaults for missing properties
    const processedTask = {
      ...task,
      description: task.description || "",
      start_date: task.start_date || null,
      end_date: task.end_date || null,
      note: task.note || "",
      unit_in_charge: task.unit_in_charge || "",
      legal_basis: task.legal_basis || "",
      // These properties might not exist in the actual task data
      min_duration_hours: task.min_duration_hours || 0,
      max_duration_hours: task.max_duration_hours || 0,
      max_retries: task.max_retries || 0,
      skills: task.task_skills?.map((ts: any) => ts.skill) || [],
      task_raci: task.task_raci || [],
    }

    console.log("Processed task data:", processedTask)

    const startDate = processedTask.start_date ? new Date(processedTask.start_date) : null
    const endDate = processedTask.end_date ? new Date(processedTask.end_date) : null
    
    const minDurationHours = startDate && endDate ? 
      Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60))) : 0
    const maxDurationHours = minDurationHours * 1.5 // Add 50% buffer

    const riskPrediction = await calculateRiskPrediction({
      taskId: processedTask.id,
      min_duration_hours: minDurationHours,
      max_duration_hours: maxDurationHours,
      max_retries: processedTask.max_retries,
      dependencies: processedTask.dependencies,
      status: processedTask.status,
    })

    const taskWeight = calculateTaskWeight({
      min_duration_hours: minDurationHours,
      max_duration_hours: maxDurationHours,
      max_retries: processedTask.max_retries,
      dependencies: processedTask.dependencies || [],
      skill_complexity: processedTask.skill_id ? 3 : 1,
    })

    const estimatedTime = calculateEstimatedTime({
      start_date: processedTask.start_date,
      end_date: processedTask.end_date,
      max_retries: processedTask.max_retries,
      dependencies: processedTask.dependencies,
    })

    // Format the dates if they exist, including time
    const formatDateTime = (dateTimeStr: string | null) => {
      if (!dateTimeStr) return null
      const date = new Date(dateTimeStr)
      return {
        date: format(date, "dd MMMM yyyy", { locale: vi }),
        time: format(date, "HH:mm", { locale: vi }),
        full: format(date, "dd MMMM yyyy 'lúc' HH:mm", { locale: vi }),
      }
    }

    const startDateTime = formatDateTime(processedTask.start_date)
    const endDateTime = formatDateTime(processedTask.end_date)
    const dueDateTime = formatDateTime(processedTask.due_date)

    // Remove the raciUsers variable since we're now using processedTask.task_raci directly

    return (
      <div className="container px-4 py-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="mr-2">
              <Link href="/dashboard/tasks">
                <ArrowLeftIcon className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{processedTask.name}</h1>
          </div>
          <div className="flex items-center gap-2 self-start">
            <div className="flex items-center">
              {statusColors[processedTask.status]?.icon}
              <Badge variant={statusColors[processedTask.status]?.variant || "secondary"} className="text-sm px-3 py-1">
                {statusColors[processedTask.status]?.label || processedTask.status}
              </Badge>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" asChild>
                    <Link href={`/dashboard/tasks/${processedTask.id}/edit`}>
                      <EditIcon className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Chỉnh sửa công việc</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Project info */}
        <div className="flex items-center text-sm text-muted-foreground">
          <BriefcaseIcon className="h-4 w-4 mr-2" />
          <Link
            href={`/dashboard/projects/${processedTask.project_id}`}
            className="hover:underline hover:text-foreground transition-colors"
          >
            {processedTask.projects?.name || "Dự án không xác định"}
          </Link>
          {processedTask.phase_id && (
            <>
              <span className="mx-2">•</span>
              <span>Giai đoạn: {processedTask.phases?.name || "Không xác định"}</span>
            </>
          )}
        </div>

        <Separator className="my-4" />

        {/* Main content with tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid grid-cols-3 max-w-md">
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="technical">Phân tích kỹ thuật</TabsTrigger>
            <TabsTrigger value="assignments">Phân công</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Main info card */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileTextIcon className="h-5 w-5" />
                    Chi tiết công việc
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Description */}
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm text-muted-foreground">Mô tả:</h3>
                    <p className="text-sm border-l-2 border-muted pl-3 py-1">
                      {processedTask.description || "Không có mô tả"}
                    </p>
                  </div>

                  {/* Notes */}
                  {processedTask.note && (
                    <div className="space-y-2">
                      <h3 className="font-medium text-sm text-muted-foreground">Ghi chú:</h3>
                      <p className="text-sm border-l-2 border-muted pl-3 py-1">{processedTask.note}</p>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <h3 className="font-medium text-sm text-muted-foreground flex items-center">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        Ngày bắt đầu
                      </h3>
                      <p className="text-sm">{startDateTime?.full || "Chưa thiết lập"}</p>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-medium text-sm text-muted-foreground flex items-center">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        Ngày kết thúc
                      </h3>
                      <p className="text-sm">{endDateTime?.full || "Chưa thiết lập"}</p>
                    </div>

                  </div>

                  {/* Assigned User */}
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm text-muted-foreground flex items-center">
                      <UserIcon className="h-4 w-4 mr-2" />
                      Người phụ trách
                    </h3>
                    <div className="flex items-center">
                      {processedTask.users ? (
                        <>
                          <Avatar className="h-6 w-6 mr-2">
                            <AvatarFallback>{processedTask.users.full_name?.[0] || "?"}</AvatarFallback>
                          </Avatar>
                          <span>{processedTask.users.full_name}</span>
                          {processedTask.users.position && (
                            <span className="text-xs text-muted-foreground ml-2">({processedTask.users.position})</span>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">Chưa phân công</span>
                      )}
                    </div>
                  </div>

                  {/* Additional info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {processedTask.unit_in_charge && (
                      <div className="space-y-2">
                        <h3 className="font-medium text-sm text-muted-foreground flex items-center">
                          <BriefcaseIcon className="h-4 w-4 mr-2" />
                          Đơn vị thực hiện
                        </h3>
                        <p className="text-sm">{processedTask.unit_in_charge}</p>
                      </div>
                    )}

                    {processedTask.legal_basis && (
                      <div className="space-y-2">
                        <h3 className="font-medium text-sm text-muted-foreground flex items-center">
                          <TagIcon className="h-4 w-4 mr-2" />
                          Căn cứ thực hiện
                        </h3>
                        <p className="text-sm">{processedTask.legal_basis}</p>
                      </div>
                    )}
                  </div>

                  {/* Skills and dependencies */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Skills */}
                    <div className="space-y-2">
                      <h3 className="font-medium text-sm text-muted-foreground flex items-center">
                        <TagIcon className="h-4 w-4 mr-2" />
                        Lĩnh vực
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {processedTask.skills?.map((skill: Skill) => (
                          <Badge key={skill.id} variant="outline">
                            {skill.name}
                          </Badge>
                        ))}
                        {(!processedTask.skills || processedTask.skills.length === 0) && (
                          <span className="text-sm text-muted-foreground">Không có lĩnh vực được chỉ định</span>
                        )}
                      </div>
                    </div>

                  
                  </div>
                </CardContent>
              </Card>

              {/* Time and Attempts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClockIcon className="h-5 w-5" />
                    Thời gian và nỗ lực
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-medium text-sm text-muted-foreground">Thời gian ước tính:</h3>
                    <div className="flex items-center justify-center bg-muted/50 py-4 rounded-md">
                      <span className="text-2xl font-bold">
                      {formatDuration(processedTask.min_duration_hours || 0)} -{" "}
                      {formatDuration(processedTask.max_duration_hours || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium text-sm text-muted-foreground">Thời gian ước tính thực tế:</h3>
                    <div className="flex items-center justify-between">
                    <span className="text-xl font-semibold">
                        {estimatedTime.displayTime} {estimatedTime.timeUnit === "hour" && "giờ"}
                        {estimatedTime.timeUnit === "day" && "ngày"}
                        {estimatedTime.timeUnit === "week" && "tuần"}
                        {estimatedTime.timeUnit === "month" && "tháng"}
                        {estimatedTime.timeUnit === "year" && "năm"}
                      </span>
                      <Badge variant="outline" className="ml-2">
                        Độ tin cậy: {(estimatedTime.confidence * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h3 className="font-medium text-sm text-muted-foreground flex items-center">
                      <AlertCircleIcon className="h-4 w-4 mr-2" />
                      Số lần thử lại tối đa:
                    </h3>
                    <div className="flex items-center justify-center bg-muted/50 py-3 rounded-md">
                      <span className="text-xl font-semibold">{processedTask.max_retries || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="technical" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Risk Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircleIcon className="h-5 w-5" />
                    Phân tích rủi ro
                  </CardTitle>
                  <CardDescription>Đánh giá rủi ro và đề xuất chiến lược giảm thiểu</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Mức độ rủi ro</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={riskPrediction.riskLevel > 3 ? "destructive" : "outline"}>
                          {riskPrediction.riskLevel}/5
                        </Badge>
                        <span className="text-sm text-muted-foreground">Điểm: {riskPrediction.riskScore}/100</span>
                      </div>
                    </div>
                    <Progress
                      value={riskPrediction.riskLevel * 20}
                      className={`h-2 ${
                        riskPrediction.riskLevel > 3
                          ? "bg-destructive"
                          : riskPrediction.riskLevel > 2
                            ? "bg-amber-500"
                            : "bg-green-500"
                      }`}
                    />
                  </div>

                  {riskPrediction.riskFactors.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-medium text-sm flex items-center">
                        <AlertTriangleIcon className="h-4 w-4 mr-2 text-amber-500" />
                        Yếu tố rủi ro:
                      </h3>
                      <ul className="space-y-1 text-sm">
                        {riskPrediction.riskFactors.map((factor, index) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {riskPrediction.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-medium text-sm flex items-center">
                        <LightbulbIcon className="h-4 w-4 mr-2 text-amber-500" />
                        Đề xuất:
                      </h3>
                      <ul className="space-y-1 text-sm">
                        {riskPrediction.recommendations.map((recommendation, index) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>{recommendation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Task Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChartIcon className="h-5 w-5" />
                    Phân tích nhiệm vụ
                  </CardTitle>
                  <CardDescription>Đánh giá độ phức tạp và trọng số các yếu tố</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Độ phức tạp tổng thể:</span>
                    <Badge
                      variant="outline"
                      className={
                        taskWeight.complexity > 4
                          ? "border-destructive text-destructive"
                          : taskWeight.complexity > 3
                            ? "border-amber-500 text-amber-500"
                            : "border-green-500 text-green-500"
                      }
                    >
                      {taskWeight.complexity}/5
                    </Badge>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Trọng số thời gian</span>
                        <span>{taskWeight.timeWeight.toFixed(2)}</span>
                      </div>
                      <Progress value={taskWeight.timeWeight * 100} className="h-1.5" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Trọng số thử lại</span>
                        <span>{taskWeight.retryWeight.toFixed(2)}</span>
                      </div>
                      <Progress value={taskWeight.retryWeight * 100} className="h-1.5" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Trọng số phụ thuộc</span>
                        <span>{taskWeight.dependencyWeight.toFixed(2)}</span>
                      </div>
                      <Progress value={taskWeight.dependencyWeight * 100} className="h-1.5" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Trọng số kỹ năng</span>
                        <span>{(taskWeight.skillComplexity / 5).toFixed(2)}</span>
                      </div>
                      <Progress value={(taskWeight.skillComplexity / 5) * 100} className="h-1.5" />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between items-center pt-0 pb-3">
                  <span className="text-xs text-muted-foreground">Trọng số cao = độ phức tạp cao hơn</span>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="assignments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserIcon className="h-5 w-5" />
                  Phân công RACI
                </CardTitle>
                <CardDescription>
                  Mô hình phân công trách nhiệm: Responsible (R), Accountable (A), Consulted (C), Informed (I)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {processedTask.task_raci && processedTask.task_raci.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {processedTask.task_raci.map((raci: { id: number; role: RaciRole; users: { full_name: string; position?: string; org_unit?: string } }) => {
                        const role = raci.role as RaciRole
                        const user = raci.users
                        const roleInfo = getRaciInfo(role)

                        return (
                          <div key={raci.id} className="flex items-start p-3 border rounded-md bg-card">
                            <Badge variant={roleInfo.variant as "default" | "destructive" | "secondary" | "outline"} className="mr-3 mt-0.5">
                              {role}
                            </Badge>
                            <div className="space-y-1">
                              <div className="flex items-center">
                                <Avatar className="h-6 w-6 mr-2">
                                  <AvatarFallback>{user?.full_name?.[0] || "?"}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{user?.full_name}</span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                <span>{user?.position || "Vị trí không xác định"}</span>
                                {user?.org_unit && <span> • {user.org_unit}</span>}
                              </div>
                              <div className="text-xs mt-1">{roleInfo.description}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <UserIcon className="mx-auto h-12 w-12 text-muted-foreground/30" />
                      <h3 className="mt-4 font-medium">Chưa có người được phân công</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Công việc này chưa có ai được phân công trách nhiệm
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )
  } catch (error) {
    console.error("Error in TaskDetailPage:", error)
    notFound()
  }
}

// Helper function to get RACI role information
function getRaciInfo(role: RaciRole) {
  switch (role) {
    case "R":
      return {
        variant: "default",
        description: "Người thực hiện: Trực tiếp làm công việc để hoàn thành nhiệm vụ.",
      }
    case "A":
      return {
        variant: "destructive",
        description: "Người chịu trách nhiệm: Phê duyệt và chịu trách nhiệm cuối cùng về kết quả.",
      }
    case "C":
      return {
        variant: "secondary",
        description: "Người tư vấn: Cung cấp ý kiến và hỗ trợ cho người thực hiện.",
      }
    case "I":
      return {
        variant: "outline",
        description: "Người được thông báo: Được cập nhật về tiến độ và kết quả.",
      }
    default:
      return {
        variant: "outline",
        description: "Vai trò không xác định.",
      }
  }
}
