"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ZoomInIcon,
  ZoomOutIcon,
  RefreshCwIcon,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Clock,
  Users,
  Scale,
  ArrowRight,
  Sparkles,
  Calendar,
  CalendarDays,
  CalendarRange,
} from "lucide-react"
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface GanttChartProps {
  projectId: string
  onOptimize?: (optimizedData: any) => void
}

interface Task {
  id: string
  name: string
  start_date: string
  end_date: string
  phase_id: string
  status: string
  progress: number
  assigned_to?: string
  assigned_user_name?: string
  dependencies: string[]
  is_overdue: boolean
}

interface OptimizationResult {
  algorithm_used: string
  original_makespan: number
  optimized_makespan: number
  improvement_percentage: number
  resource_utilization_before: number
  resource_utilization_after: number
  workload_balance: number
  explanation: {
    strategy: string
    key_improvements: string[]
    trade_offs: string[]
    constraints_considered: string[]
    why_optimal: string
  }
  schedule_changes: {
    task_id: string
    task_name: string
    change_type: string
    original_start: string
    new_start: string
    original_assignee?: string
    new_assignee?: string
    reason: string
    impact: string
  }[]
  critical_path: string[]
}

type ViewMode = "day" | "week" | "month"

export function GanttChart({ projectId, onOptimize }: GanttChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(1)
  const [scrollPosition, setScrollPosition] = useState(0)
  const [projectData, setProjectData] = useState<any>(null)
  const [optimizedData, setOptimizedData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showOptimized, setShowOptimized] = useState(false)
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<"cpm" | "genetic" | "resource_leveling">("cpm")
  const [selectedObjective, setSelectedObjective] = useState<"time" | "resource" | "multi">("multi")
  const [viewMode, setViewMode] = useState<ViewMode>("month")

  // Load project data
  useEffect(() => {
    if (!projectId) return

    async function fetchProjectData() {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/projects/${projectId}/gantt`)
        if (!response.ok) throw new Error("Không thể tải dữ liệu dự án")
        const data = await response.json()
        setProjectData(data)
      } catch (error) {
        console.error("Error fetching project data:", error)
        toast.error("Lỗi khi tải dữ liệu dự án")
      } finally {
        setIsLoading(false)
      }
    }

    fetchProjectData()
  }, [projectId])

  // Helper function to get time unit width
  const getTimeUnitWidth = (projectDuration: number, chartWidth: number) => {
    let baseWidth
    switch (viewMode) {
      case "day":
        baseWidth = chartWidth / projectDuration
        break
      case "week":
        baseWidth = chartWidth / (projectDuration / 7)
        break
      case "month":
        baseWidth = chartWidth / (projectDuration / 30)
        break
      default:
        baseWidth = chartWidth / projectDuration
    }
    return baseWidth * zoom
  }

  // Helper function to format date labels
  const formatDateLabel = (date: Date) => {
    switch (viewMode) {
      case "day":
        return `${date.getDate()}/${date.getMonth() + 1}`
      case "week":
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        return `T${Math.ceil(date.getDate() / 7)} - ${date.getMonth() + 1}/${date.getFullYear()}`
      case "month":
        const months = ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12"]
        return `${months[date.getMonth()]} ${date.getFullYear()}`
      default:
        return date.toLocaleDateString("vi-VN")
    }
  }

  // Helper function to get next time unit
  const getNextTimeUnit = (currentDate: Date) => {
    const nextDate = new Date(currentDate)
    switch (viewMode) {
      case "day":
        nextDate.setDate(currentDate.getDate() + 1)
        break
      case "week":
        nextDate.setDate(currentDate.getDate() + 7)
        break
      case "month":
        nextDate.setMonth(currentDate.getMonth() + 1)
        break
    }
    return nextDate
  }

  // Draw Gantt chart
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !projectData) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Chart settings
    const chartStartX = 300
    const chartWidth = canvas.width / dpr - chartStartX - 20
    const rowHeight = 45
    const headerHeight = 80

    // Get display data (original or optimized)
    const displayData = showOptimized && optimizedData ? optimizedData : projectData
    const { project, tasks = [], phases = [] } = displayData || {}

    if (!project?.start_date || !project?.end_date) return

    const startDate = new Date(project.start_date)
    const endDate = new Date(project.end_date)
    const projectDuration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)

    const unitWidth = getTimeUnitWidth(projectDuration, chartWidth)

    // Draw header background
    ctx.fillStyle = "#f8fafc"
    ctx.fillRect(0, 0, canvas.width, headerHeight)

    // Draw task names background
    ctx.fillStyle = "#f8fafc"
    ctx.fillRect(0, headerHeight, chartStartX, canvas.height)

    // Draw grid lines
    ctx.strokeStyle = "#e2e8f0"
    ctx.lineWidth = 1

    // Horizontal grid lines
    for (let i = 0; i <= tasks.length; i++) {
      const y = headerHeight + i * rowHeight
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    // Vertical grid lines and time labels
    const currentDate = new Date(startDate)

    // Adjust starting point based on view mode
    switch (viewMode) {
      case "day":
        // Start from the first day
        break
      case "week":
        // Start from the beginning of the week
        currentDate.setDate(startDate.getDate() - startDate.getDay())
        break
      case "month":
        // Start from the first day of the month
        currentDate.setDate(1)
        break
    }

    while (currentDate <= endDate) {
      const days = (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      let x: number

      switch (viewMode) {
        case "day":
          x = chartStartX + days * unitWidth - scrollPosition
          break
        case "week":
          x = chartStartX + (days / 7) * unitWidth - scrollPosition
          break
        case "month":
          x = chartStartX + (days / 30) * unitWidth - scrollPosition
          break
        default:
          x = chartStartX + days * unitWidth - scrollPosition
      }

      if (x >= chartStartX && x <= chartStartX + chartWidth) {
        // Draw vertical grid line
        ctx.beginPath()
        ctx.moveTo(x, headerHeight)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()

        // Draw time label
        ctx.fillStyle = "#64748b"
        ctx.font = "12px Inter, sans-serif"
        ctx.textAlign = "center"
        ctx.fillText(formatDateLabel(currentDate), x, headerHeight / 2)
      }

      // Move to next time unit
      const nextDate = getNextTimeUnit(currentDate)
      currentDate.setTime(nextDate.getTime())
    }

    // Draw column headers
    ctx.fillStyle = "#0f172a"
    ctx.font = "bold 14px Inter, sans-serif"
    ctx.textAlign = "left"
    ctx.fillText("Công việc", 10, headerHeight - 20)
    ctx.fillText("Người thực hiện", 140, headerHeight - 20)
    ctx.fillText("Tiến độ", 260, headerHeight - 20)

    // Draw tasks
    tasks.forEach((task: Task, index: number) => {
      const y = headerHeight + index * rowHeight

      // Draw task info
      ctx.fillStyle = "#0f172a"
      ctx.font = "13px Inter, sans-serif"
      ctx.textAlign = "left"

      // Task name
      const displayName = task.name.length > 20 ? task.name.substring(0, 20) + "..." : task.name
      ctx.fillText(displayName, 10, y + rowHeight / 2 + 4)

      // Assigned user
      ctx.fillStyle = "#64748b"
      ctx.font = "12px Inter, sans-serif"
      const userName = task.assigned_user_name || "Chưa phân công"
      ctx.fillText(userName, 160, y + rowHeight / 2 + 4)

      // Progress
      ctx.fillText(`${task.progress}%`, 250, y + rowHeight / 2 + 4)

      // Draw task bar
      if (!task.start_date || !task.end_date) return

      const taskStartDate = new Date(task.start_date)
      const taskEndDate = new Date(task.end_date)
      const taskStartDays = (taskStartDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      const taskDuration = (taskEndDate.getTime() - taskStartDate.getTime()) / (1000 * 60 * 60 * 24) + 1

      let barX: number, barWidth: number

      switch (viewMode) {
        case "day":
          barX = chartStartX + taskStartDays * unitWidth - scrollPosition
          barWidth = taskDuration * unitWidth
          break
        case "week":
          barX = chartStartX + (taskStartDays / 7) * unitWidth - scrollPosition
          barWidth = (taskDuration / 7) * unitWidth
          break
        case "month":
          barX = chartStartX + (taskStartDays / 30) * unitWidth - scrollPosition
          barWidth = (taskDuration / 30) * unitWidth
          break
        default:
          barX = chartStartX + taskStartDays * unitWidth - scrollPosition
          barWidth = taskDuration * unitWidth
      }

      const barY = y + 10
      const barHeight = rowHeight - 20

      // Determine color based on status and phase
      let barColor = "#3b82f6" // Default blue
      if (task.status === "done") {
        barColor = "#10b981" // Green
      } else if (task.is_overdue) {
        barColor = "#ef4444" // Red
      } else if (task.status === "in_progress") {
        barColor = "#f59e0b" // Orange
      }

      // Only draw if visible
      if (barX + barWidth >= chartStartX && barX <= chartStartX + chartWidth) {
        // Draw task background
        ctx.fillStyle = barColor + "20"
        ctx.fillRect(barX, barY, barWidth, barHeight)

        // Draw progress
        if (task.progress > 0) {
          ctx.fillStyle = barColor
          ctx.fillRect(barX, barY, barWidth * (task.progress / 100), barHeight)
        }

        // Draw border
        ctx.strokeStyle = barColor
        ctx.lineWidth = 2
        ctx.strokeRect(barX, barY, barWidth, barHeight)

        // Draw dependencies
        if (task.dependencies.length > 0) {
          ctx.strokeStyle = "#94a3b8"
          ctx.lineWidth = 1
          ctx.setLineDash([5, 5])

          task.dependencies.forEach((depId) => {
            const depTask = tasks.find((t: Task) => t.id === depId)
            if (depTask) {
              const depIndex = tasks.indexOf(depTask)
              const depEndDate = new Date(depTask.end_date)
              const depEndDays = (depEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)

              let depX: number
              switch (viewMode) {
                case "day":
                  depX = chartStartX + depEndDays * unitWidth - scrollPosition
                  break
                case "week":
                  depX = chartStartX + (depEndDays / 7) * unitWidth - scrollPosition
                  break
                case "month":
                  depX = chartStartX + (depEndDays / 30) * unitWidth - scrollPosition
                  break
                default:
                  depX = chartStartX + depEndDays * unitWidth - scrollPosition
              }

              const depY = headerHeight + depIndex * rowHeight + rowHeight / 2

              // Draw arrow from dependency to current task
              ctx.beginPath()
              ctx.moveTo(depX, depY)
              ctx.lineTo(barX - 5, barY + barHeight / 2)
              ctx.stroke()

              // Draw arrow head
              ctx.beginPath()
              ctx.moveTo(barX - 5, barY + barHeight / 2)
              ctx.lineTo(barX - 10, barY + barHeight / 2 - 5)
              ctx.lineTo(barX - 10, barY + barHeight / 2 + 5)
              ctx.closePath()
              ctx.fillStyle = "#94a3b8"
              ctx.fill()
            }
          })

          ctx.setLineDash([])
        }
      }
    })

    // Draw comparison if showing optimized view
    if (showOptimized && optimizationResult) {
      // Draw legend
      ctx.fillStyle = "#0f172a"
      ctx.font = "12px Inter, sans-serif"
      ctx.textAlign = "left"
      ctx.fillText("Chú thích:", 10, canvas.height / dpr - 40)

      ctx.fillStyle = "#3b82f620"
      ctx.fillRect(80, canvas.height / dpr - 50, 20, 15)
      ctx.strokeStyle = "#3b82f6"
      ctx.strokeRect(80, canvas.height / dpr - 50, 20, 15)
      ctx.fillStyle = "#0f172a"
      ctx.fillText("Lịch tối ưu", 105, canvas.height / dpr - 40)

      // Draw critical path indicator
      ctx.fillStyle = "#ef444420"
      ctx.fillRect(200, canvas.height / dpr - 50, 20, 15)
      ctx.strokeStyle = "#ef4444"
      ctx.strokeRect(200, canvas.height / dpr - 50, 20, 15)
      ctx.fillStyle = "#0f172a"
      ctx.fillText("Đường găng", 225, canvas.height / dpr - 40)
    }
  }, [projectData, optimizedData, zoom, scrollPosition, showOptimized, optimizationResult, viewMode])

  const handleOptimize = async () => {
    if (!projectId) return

    setIsOptimizing(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/optimize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          algorithm: selectedAlgorithm,
          objective: {
            type: selectedObjective,
            weights:
              selectedObjective === "multi"
                ? {
                    time_weight: 0.4,
                    resource_weight: 0.3,
                    cost_weight: 0.3,
                  }
                : undefined,
          },
        }),
      })

      if (!response.ok) throw new Error("Không thể tối ưu hóa lịch trình")

      const result = await response.json()

      // Update optimized data
      if (result.schedule_changes) {
        const optimizedTasks = projectData.tasks.map((task: Task) => {
          const change = result.schedule_changes.find((c: any) => c.task_id === task.id)

          if (change && change.change_type !== "unchanged") {
            return {
              ...task,
              start_date: change.new_start,
              end_date: change.new_end,
              assigned_to: change.new_assignee || task.assigned_to,
              is_optimized: true,
            }
          }

          return task
        })

        setOptimizedData({
          ...projectData,
          tasks: optimizedTasks,
        })
      }

      setOptimizationResult(result)
      setShowOptimized(true)
      if (onOptimize) {
        onOptimize(result)
      }
      toast.success("Đã tối ưu hóa lịch trình thành công!")
    } catch (error) {
      console.error("Error optimizing schedule:", error)
      toast.error("Lỗi khi tối ưu hóa lịch trình")
    } finally {
      setIsOptimizing(false)
    }
  }

  const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.2, 3))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev / 1.2, 0.5))
  const handleScrollLeft = () => setScrollPosition((prev) => Math.max(prev - 100, 0))
  const handleScrollRight = () => setScrollPosition((prev) => prev + 100)

  return (
    <div className="space-y-6">
      {/* Optimization Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Tối ưu hóa lịch trình dự án
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Thuật toán</label>
              <select
                className="w-full px-3 py-2 border rounded-md"
                value={selectedAlgorithm}
                onChange={(e) => setSelectedAlgorithm(e.target.value as any)}
                disabled={isOptimizing}
              >
                <option value="cpm">Phương pháp đường găng (CPM)</option>
                <option value="genetic">Thuật toán di truyền (GA)</option>
                <option value="resource_leveling">Cân bằng tài nguyên</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Mục tiêu</label>
              <select
                className="w-full px-3 py-2 border rounded-md"
                value={selectedObjective}
                onChange={(e) => setSelectedObjective(e.target.value as any)}
                disabled={isOptimizing}
              >
                <option value="time">Tối ưu thời gian</option>
                <option value="resource">Tối ưu tài nguyên</option>
                <option value="multi">Tối ưu đa mục tiêu</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button onClick={handleOptimize} disabled={isOptimizing} className="w-full">
                {isOptimizing ? (
                  <>
                    <RefreshCwIcon className="mr-2 h-4 w-4 animate-spin" />
                    Đang tối ưu...
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Tối ưu hóa
                  </>
                )}
              </Button>
            </div>
          </div>

          {selectedAlgorithm && (
            <Alert className="mt-4">
              <AlertDescription>
                {selectedAlgorithm === "cpm" &&
                  "CPM xác định chuỗi công việc quan trọng nhất và tối ưu hóa để rút ngắn thời gian hoàn thành dự án."}
                {selectedAlgorithm === "genetic" &&
                  "GA sử dụng nguyên lý tiến hóa để tìm kiếm giải pháp tối ưu qua nhiều thế hệ."}
                {selectedAlgorithm === "resource_leveling" &&
                  "Cân bằng việc phân bổ công việc để tránh quá tải và tối ưu hóa hiệu suất làm việc."}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Optimization Results */}
      {optimizationResult && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Thời gian hoàn thành</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Ban đầu:</span>
                    <span className="text-lg font-semibold">{optimizationResult.original_makespan} ngày</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-green-600" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Tối ưu:</span>
                    <span className="text-2xl font-bold text-green-600">
                      {optimizationResult.optimized_makespan} ngày
                    </span>
                  </div>
                  <Progress value={100 - optimizationResult.improvement_percentage} className="mt-2" />
                  <p className="text-xs text-green-600 font-medium">
                    Giảm {optimizationResult.improvement_percentage.toFixed(1)}% thời gian
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hiệu suất tài nguyên</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Ban đầu:</span>
                    <span className="text-lg font-semibold">
                      {(optimizationResult.resource_utilization_before * 100).toFixed(1)}%
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Tối ưu:</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {(optimizationResult.resource_utilization_after * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={optimizationResult.resource_utilization_after * 100} className="mt-2" />
                  <p className="text-xs text-blue-600 font-medium">
                    Tăng{" "}
                    {(
                      (optimizationResult.resource_utilization_after - optimizationResult.resource_utilization_before) *
                      100
                    ).toFixed(1)}
                    % hiệu suất
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cân bằng công việc</CardTitle>
                <Scale className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(optimizationResult.workload_balance * 100).toFixed(1)}%</div>
                <Progress value={optimizationResult.workload_balance * 100} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">Mức độ đồng đều trong phân bổ công việc</p>
                {optimizationResult.workload_balance > 0.8 && (
                  <Badge variant="default" className="mt-2">
                    Xuất sắc
                  </Badge>
                )}
                {optimizationResult.workload_balance > 0.6 && optimizationResult.workload_balance <= 0.8 && (
                  <Badge variant="secondary" className="mt-2">
                    Tốt
                  </Badge>
                )}
                {optimizationResult.workload_balance <= 0.6 && (
                  <Badge variant="outline" className="mt-2">
                    Cần cải thiện
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detailed Explanation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Chi tiết tối ưu hóa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Strategy */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-600" />
                  Chiến lược áp dụng
                </h4>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                  {optimizationResult.explanation.strategy}
                </p>
              </div>

              {/* Key Improvements */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Cải thiện chính
                </h4>
                <div className="grid gap-2">
                  {optimizationResult.explanation.key_improvements.map((improvement, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{improvement}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trade-offs */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  Đánh đổi cần xem xét
                </h4>
                <div className="grid gap-2">
                  {optimizationResult.explanation.trade_offs.map((tradeoff, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{tradeoff}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Why Optimal */}
              <div>
                <h4 className="font-semibold mb-2">Tại sao đây là giải pháp tối ưu?</h4>
                <Alert>
                  <TrendingUp className="h-4 w-4" />
                  <AlertDescription>{optimizationResult.explanation.why_optimal}</AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>

          {/* Schedule Changes */}
          <Card>
            <CardHeader>
              <CardTitle>Thay đổi chi tiết trong lịch trình</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {optimizationResult.schedule_changes
                  .filter((change) => change.change_type !== "unchanged")
                  .map((change, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium">{change.task_name}</h5>
                        <Badge
                          variant={
                            change.change_type === "rescheduled"
                              ? "secondary"
                              : change.change_type === "reassigned"
                                ? "default"
                                : "outline"
                          }
                        >
                          {change.change_type === "rescheduled" && "Dời lịch"}
                          {change.change_type === "reassigned" && "Đổi người"}
                          {change.change_type === "both" && "Dời lịch & Đổi người"}
                        </Badge>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        {change.change_type !== "reassigned" && (
                          <div>
                            <p className="text-muted-foreground mb-1">Thời gian:</p>
                            <div className="flex items-center gap-2">
                              <span>{new Date(change.original_start).toLocaleDateString("vi-VN")}</span>
                              <ArrowRight className="h-4 w-4" />
                              <span className="font-medium text-blue-600">
                                {new Date(change.new_start).toLocaleDateString("vi-VN")}
                              </span>
                            </div>
                          </div>
                        )}

                        {change.new_assignee && change.new_assignee !== change.original_assignee && (
                          <div>
                            <p className="text-muted-foreground mb-1">Người thực hiện:</p>
                            <div className="flex items-center gap-2">
                              <span>{change.original_assignee || "Chưa phân công"}</span>
                              <ArrowRight className="h-4 w-4" />
                              <span className="font-medium text-green-600">{change.new_assignee}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium">Lý do: </span>
                          {change.reason}
                        </p>
                        <p className="text-sm text-green-600 mt-1">
                          <span className="font-medium">Tác động: </span>
                          {change.impact}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Gantt Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Biểu đồ Gantt</CardTitle>
            <div className="flex items-center gap-4">
              {/* View Mode Selection */}
              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="day" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Ngày
                  </TabsTrigger>
                  <TabsTrigger value="week" className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Tuần
                  </TabsTrigger>
                  <TabsTrigger value="month" className="flex items-center gap-2">
                    <CalendarRange className="h-4 w-4" />
                    Tháng
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-2">
                {optimizedData && (
                  <Button
                    variant={showOptimized ? "default" : "outline"}
                    onClick={() => setShowOptimized(!showOptimized)}
                    size="sm"
                  >
                    {showOptimized ? "Xem lịch gốc" : "Xem lịch tối ưu"}
                  </Button>
                )}
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" onClick={handleZoomOut}>
                    <ZoomOutIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleZoomIn}>
                    <ZoomInIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleScrollLeft}>
                    <ChevronLeftIcon className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleScrollRight}>
                    <ChevronRightIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="w-full h-[600px] overflow-hidden border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCwIcon className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <canvas ref={canvasRef} className="w-full h-full" style={{ width: "100%", height: "100%" }} />
            )}
          </div>

          {/* Chart Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span>Chưa bắt đầu</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span>Đang thực hiện</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>Hoàn thành</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>Quá hạn</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0 border-t-2 border-dashed border-gray-400"></div>
              <span>Phụ thuộc</span>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <span className="text-muted-foreground">Chế độ xem:</span>
              <Badge variant="outline">{viewMode === "day" ? "Ngày" : viewMode === "week" ? "Tuần" : "Tháng"}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
