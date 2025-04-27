"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle, Clock, TrendingUp } from "lucide-react"
import { calculateProjectSchedule } from "@/algorithm/project-schedule"
import type { ProjectScheduleInput, ProjectScheduleOutput } from "@/algorithm/project-schedule"

interface ProjectScheduleProps {
  projectId: string
}

export function ProjectSchedule({ projectId }: ProjectScheduleProps) {
  const [schedule, setSchedule] = useState<ProjectScheduleOutput | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSchedule() {
      try {
        // Lấy thông tin dự án
        const projectRes = await fetch(`/api/projects/${projectId}`)
        if (!projectRes.ok) throw new Error("Không thể tải thông tin dự án")
        const project = await projectRes.json()

        // Lấy danh sách task
        const tasksRes = await fetch(`/api/projects/${projectId}/tasks`)
        if (!tasksRes.ok) throw new Error("Không thể tải danh sách task")
        const tasks = await tasksRes.json()

        // Lấy thông tin team
        const teamRes = await fetch("/api/user")
        if (!teamRes.ok) throw new Error("Không thể tải thông tin team")
        const team = await teamRes.json()

        // Tạo input cho thuật toán
        const input: ProjectScheduleInput = {
          tasks: tasks.tasks.map((task: any) => ({
            id: task.id,
            name: task.name,
            status: task.status,
            estimatedHours: task.estimate_high,
            actualHours: task.actual_hours,
            plannedStart: task.planned_start,
            plannedFinish: task.planned_finish,
            actualStart: task.actual_start,
            actualFinish: task.actual_finish,
            complexity: task.complexity,
            risk: task.risk_level
          })),
          team: team.users.map((user: any) => ({
            id: user.id,
            name: user.full_name,
            capacity: user.capacity_hrs,
            skills: user.skills || []
          })),
          project: {
            startDate: project.start_date,
            endDate: project.deadline,
            bufferDays: 5 // Số ngày đệm mặc định
          }
        }

        // Tính toán tiến độ
        const result = calculateProjectSchedule(input)
        setSchedule(result)
      } catch (error) {
        console.error("Lỗi khi tải tiến độ dự án:", error)
      } finally {
        setLoading(false)
      }
    }

    loadSchedule()
  }, [projectId])

  if (loading) {
    return <div>Đang tải...</div>
  }

  if (!schedule) {
    return <div>Không thể tải tiến độ dự án</div>
  }

  return (
    <div className="space-y-6">
      {/* Chỉ số tiến độ */}
      <Card>
        <CardHeader>
          <CardTitle>Chỉ số tiến độ</CardTitle>
          <CardDescription>Tổng quan về tiến độ dự án</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Tiến độ tổng thể</span>
              <span>{schedule.scheduleMetrics.progress.toFixed(1)}%</span>
            </div>
            <Progress value={schedule.scheduleMetrics.progress} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Thời gian kế hoạch</div>
              <div className="text-lg font-semibold">{schedule.scheduleMetrics.plannedDuration} ngày</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Thời gian thực tế</div>
              <div className="text-lg font-semibold">{schedule.scheduleMetrics.actualDuration} ngày</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Độ lệch tiến độ</div>
            <div className={`text-lg font-semibold ${schedule.scheduleMetrics.scheduleVariance > 0 ? "text-red-500" : "text-green-500"}`}>
              {schedule.scheduleMetrics.scheduleVariance > 0 ? "+" : ""}
              {schedule.scheduleMetrics.scheduleVariance} ngày
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Các mốc quan trọng */}
      <Card>
        <CardHeader>
          <CardTitle>Các mốc quan trọng</CardTitle>
          <CardDescription>Tiến độ theo tuần</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {schedule.milestones.map((milestone) => (
            <div key={milestone.name} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-1">
                <div className="font-medium">{milestone.name}</div>
                <div className="text-sm text-muted-foreground">
                  Kế hoạch: {new Date(milestone.plannedDate).toLocaleDateString()}
                </div>
              </div>
              <Badge
                variant={
                  milestone.status === "on_track"
                    ? "default"
                    : milestone.status === "at_risk"
                    ? "secondary"
                    : "destructive"
                }
              >
                {milestone.status === "on_track"
                  ? "Đúng tiến độ"
                  : milestone.status === "at_risk"
                  ? "Có rủi ro"
                  : "Chậm tiến độ"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Rủi ro tiến độ */}
      {schedule.scheduleRisks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rủi ro tiến độ</CardTitle>
            <CardDescription>Các task có nguy cơ chậm tiến độ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {schedule.scheduleRisks.map((risk) => (
              <Alert key={risk.taskId} variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{risk.name}</AlertTitle>
                <AlertDescription>
                  <div className="mt-2">
                    <div>Lý do: {risk.reason}</div>
                    <div className="mt-1">Mức độ ảnh hưởng: {(risk.impact * 100).toFixed(1)}%</div>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Đề xuất cải thiện */}
      <Card>
        <CardHeader>
          <CardTitle>Đề xuất cải thiện</CardTitle>
          <CardDescription>Các biện pháp để cải thiện tiến độ</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {schedule.recommendations.map((recommendation, index) => (
            <Alert key={index}>
              <TrendingUp className="h-4 w-4" />
              <AlertDescription>{recommendation}</AlertDescription>
            </Alert>
          ))}
        </CardContent>
      </Card>
    </div>
  )
} 