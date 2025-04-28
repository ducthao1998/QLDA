import { notFound } from "next/navigation"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { ClockIcon, AlertCircleIcon, UserIcon, CalendarIcon, FileTextIcon, TagIcon, EditIcon } from "lucide-react"
import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { calculateRiskPrediction } from "@/algorithm/risk-prediction"
import { calculateTaskWeight } from "@/algorithm/task-weight"
import { calculateEstimatedTime } from "@/algorithm/estimated-time"
import { Task } from "@/app/types/task"

type Params = { id: string }

const statusColors: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
  todo: { variant: "secondary", label: "Chưa bắt đầu" },
  in_progress: { variant: "default", label: "Đang thực hiện" },
  review: { variant: "secondary", label: "Đang xem xét" },
  completed: { variant: "default", label: "Hoàn thành" },
  blocked: { variant: "destructive", label: "Bị chặn" },
  archived: { variant: "outline", label: "Lưu trữ" }
}

export default async function TaskDetailPage({ params }: { params: Params }) {
  const { id } = params
  
  const response = await fetch(`http://localhost:3000/api/tasks/${id}`, {
    cache: 'no-store'
  })

  if (!response.ok) {
    notFound()
  }

  const task = await response.json() as Task

  const riskPrediction = await calculateRiskPrediction({
    taskId: task.id,
    complexity: task.complexity,
    riskLevel: task.risk_level,
    status: task.status,
    dueDate: task.due_date
  })

  const taskWeight = calculateTaskWeight({
    complexity: task.complexity,
    risk: task.risk_level
  })

  const estimatedTime = calculateEstimatedTime({
    complexity: task.complexity,
    risk: task.risk_level,
    baseTime: (task.estimate_low + task.estimate_high) / 2
  })

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{task.name}</h1>
          <p className="text-muted-foreground mt-2">
            Dự án: {task.projects?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusColors[task.status]?.variant || "secondary"}>
            {statusColors[task.status]?.label || task.status}
          </Badge>
          <Button variant="outline" size="icon" asChild>
            <Link href={`/dashboard/tasks/${task.id}/edit`}>
              <EditIcon className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin chi tiết</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center">
                <FileTextIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="font-medium">Mô tả:</span>
              </div>
              <p className="text-muted-foreground pl-6">{task.description || "Không có mô tả"}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center">
                  <ClockIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="font-medium">Ước tính thời gian:</span>
                </div>
                <p className="text-muted-foreground pl-6">
                  {task.estimate_low}-{task.estimate_high} giờ
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center">
                  <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="font-medium">Hạn hoàn thành:</span>
                </div>
                <p className="text-muted-foreground pl-6">
                  {format(new Date(task.due_date), "dd MMMM yyyy", { locale: vi })}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center">
                  <UserIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="font-medium">Người phụ trách:</span>
                </div>
                <p className="text-muted-foreground pl-6">
                  {task.users?.full_name || "Chưa gán"}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center">
                  <TagIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="font-medium">Độ phức tạp:</span>
                </div>
                <p className="text-muted-foreground pl-6">{task.complexity}/5</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phân tích kỹ thuật</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Mức độ rủi ro</span>
                <span className="text-muted-foreground">{riskPrediction.riskLevel}/5</span>
              </div>
              <Progress value={riskPrediction.riskLevel * 20} />
            </div>

            {riskPrediction.riskFactors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center">
                  <AlertCircleIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span className="font-medium">Yếu tố rủi ro:</span>
                </div>
                <ul className="list-disc list-inside text-muted-foreground pl-6">
                  {riskPrediction.riskFactors.map((factor, index) => (
                    <li key={index}>{factor}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Trọng số nhiệm vụ</span>
                <span className="text-muted-foreground">{taskWeight.weight.toFixed(2)}</span>
              </div>
              <Progress value={taskWeight.weight * 20} />
              <div className="text-sm text-muted-foreground">
                <p>Trọng số độ phức tạp: {taskWeight.complexityWeight.toFixed(2)}</p>
                <p>Trọng số rủi ro: {taskWeight.riskWeight.toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center">
                <ClockIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="font-medium">Thời gian ước tính thực tế:</span>
              </div>
              <p className="text-muted-foreground pl-6">
                {estimatedTime.estimatedTime.toFixed(1)} giờ
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 