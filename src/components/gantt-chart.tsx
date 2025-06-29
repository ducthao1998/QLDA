"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeftIcon, ChevronRightIcon, ZoomInIcon, ZoomOutIcon, RefreshCwIcon, CheckCircle, AlertCircle, TrendingUp, Clock, Users, Scale, ArrowRight, Sparkles, BarChart3, Target, Zap } from 'lucide-react'
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"

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
    const dayWidth = (chartWidth / projectDuration) * zoom

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

    // Vertical grid lines and month labels
    const months = ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12"]
    const currentDate = new Date(startDate)
    currentDate.setDate(1)

    while (currentDate <= endDate) {
      const days = (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      const x = chartStartX + days * dayWidth - scrollPosition

      if (x >= chartStartX && x <= chartStartX + chartWidth) {
        ctx.beginPath()
        ctx.moveTo(x, headerHeight)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()

        ctx.fillStyle = "#64748b"
        ctx.font = "12px Inter, sans-serif"
        ctx.textAlign = "center"
        ctx.fillText(`${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`, x, headerHeight / 2)
      }

      currentDate.setMonth(currentDate.getMonth() + 1)
    }

    // Draw column headers
    ctx.fillStyle = "#0f172a"
    ctx.font = "bold 14px Inter, sans-serif"
    ctx.textAlign = "left"
    ctx.fillText("Công việc", 10, headerHeight - 20)
    ctx.fillText("Người thực hiện", 160, headerHeight - 20)
    ctx.fillText("Tiến độ", 250, headerHeight - 20)

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

      const barX = chartStartX + taskStartDays * dayWidth - scrollPosition
      const barY = y + 10
      const barWidth = taskDuration * dayWidth
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

        // Highlight critical path tasks
        if (optimizationResult?.critical_path.includes(task.id)) {
          ctx.strokeStyle = "#ef4444"
          ctx.lineWidth = 3
          ctx.setLineDash([5, 5])
          ctx.strokeRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4)
          ctx.setLineDash([])
        }

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
              const depX = chartStartX + depEndDays * dayWidth - scrollPosition
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
  }, [projectData, optimizedData, zoom, scrollPosition, showOptimized, optimizationResult])

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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCwIcon className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Đang tải dữ liệu Gantt Chart...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

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
              <Select
                value={selectedAlgorithm}
                onValueChange={(value) => setSelectedAlgorithm(value as any)}
                disabled={isOptimizing}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpm">Phương pháp đường găng (CPM)</SelectItem>
                  <SelectItem value="genetic">Thuật toán di truyền (GA)</SelectItem>
                  <SelectItem value="resource_leveling">Cân bằng tài nguyên</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Mục tiêu</label>
              <Select
                value={selectedObjective}
                onValueChange={(value) => setSelectedObjective(value as any)}
                disabled={isOptimizing}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">Tối ưu thời gian</SelectItem>
                  <SelectItem value="resource">Tối ưu tài nguyên</SelectItem>
                  <SelectItem value="multi">Tối ưu đa mục tiêu</SelectItem>
                </SelectContent>
              </Select>
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
        <Tabs defaultValue="metrics" className="space-y-4">
          <TabsList>
            <TabsTrigger value="metrics">Kết quả tối ưu</TabsTrigger>
            <TabsTrigger value="changes">Thay đổi lịch trình</TabsTrigger>
            <TabsTrigger value="explanation">Giải thích</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics">
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
                      Giảm {optimizationResult.improvement_percentage.toFixed(1)}%
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
                      <span className="text-sm text-muted-foreground">Trước:</span>
                      <span className="text-lg font-semibold">
                        {(optimizationResult.resource_utilization_before * 100).toFixed(1)}%
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-blue-600" />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Sau:</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {(optimizationResult.resource_utilization_after * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={optimizationResult.resource_utilization_after * 100} className="mt-2" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cân bằng khối lượng</CardTitle>
                  <Scale className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-purple-600">
                      {(optimizationResult.workload_balance * 100).toFixed(1)}%
                    </div>
                    <Progress value={optimizationResult.workload_balance * 100} className="mt-2" />
                    <p className="text-xs text-muted-foreground">
                      {optimizationResult.workload_balance > 0.8
                        ? "Rất cân bằng"
                        : optimizationResult.workload_balance > 0.6
                          ? "Khá cân bằng"
                          : "Cần cải thiện"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="changes">
            <Card>
              <CardHeader>
                <CardTitle>Thay đổi lịch trình</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {optimizationResult.schedule_changes.map((change, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{change.task_name}</h4>
                        <Badge
                          variant={
                            change.change_type === "rescheduled"
                              ? "default"
                              : change.change_type === "reassigned"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {change.change_type === "rescheduled" && "Dời lịch"}
                          {change.change_type === "reassigned" && "Phân công lại"}
                          {change.change_type === "both" && "Dời lịch & Phân công"}
                          {change.change_type === "unchanged" && "Không thay đổi"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>
                          <strong>Lý do:</strong> {change.reason}
                        </p>
                        <p>
                          <strong>Tác động:</strong> {change.impact}
                        </p>
                        {change.change_type !== "unchanged" && (
                          <div className="grid grid-cols-2 gap-4 mt-2">
                            <div>
                              <p className="text-xs font-medium">Thời gian:</p>
                              <p className="text-xs">
                                {new Date(change.original_start).toLocaleDateString()} →{" "}
                                {new Date(change.new_start).toLocaleDateString()}
                              </p>
                            </div>
                            {change.original_assignee !== change.new_assignee && (
                              <div>
                                <p className="text-xs font-medium">Người thực hiện:</p>
                                <p className="text-xs">
                                  {change.original_assignee || "Chưa gán"} → {change.new_assignee || "Chưa gán"}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="explanation">
            <Card>
              <CardHeader>
                <CardTitle>Giải thích thuật toán</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Chiến lược:</h4>
                  <p className="text-sm text-muted-foreground">{optimizationResult.explanation.strategy}</p>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Cải tiến chính:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {optimizationResult.explanation.key_improvements.map((improvement, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        {improvement}
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Đánh đổi:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {optimizationResult.explanation.trade_offs.map((tradeOff, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        {tradeOff}
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Ràng buộc đã xem xét:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {optimizationResult.explanation.constraints_considered.map((constraint, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-blue-600" />
                        {constraint}
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Tại sao đây là giải pháp tối ưu:</h4>
                  <p className="text-sm text-muted-foreground">{optimizationResult.explanation.why_optimal}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Gantt Chart Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Biểu đồ Gantt
              {showOptimized && (
                <Badge variant="secondary" className="ml-2">
                  Lịch tối ưu
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {optimizationResult && (
                <Button
                  variant={showOptimized ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowOptimized(!showOptimized)}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  {showOptimized ? "Xem bản gốc" : "Xem bản tối ưu"}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleScrollLeft}>
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleScrollRight}>
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleZoomOut}>
                <ZoomOutIcon className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleZoomIn}>
                <ZoomInIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full h-96 cursor-move"
              style={{ minHeight: "400px" }}
              onWheel={(e) => {
                e.preventDefault()
                if (e.deltaY > 0) {
                  handleZoomOut()
                } else {
                  handleZoomIn()
                }
              }}
            />
          </div>

          {/* Project Statistics */}
          {projectData?.project?.stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold">{projectData.project.stats.total_tasks}</div>
                <div className="text-xs text-muted-foreground">Tổng công việc</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{projectData.project.stats.completed_tasks}</div>
                <div className="text-xs text-muted-foreground">Hoàn thành</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{projectData.project.stats.in_progress_tasks}</div>
                <div className="text-xs text-muted-foreground">Đang thực hiện</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{projectData.project.stats.overdue_tasks}</div>
                <div className="text-xs text-muted-foreground">Quá hạn</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{projectData.project.stats.overall_progress}%</div>
                <div className="text-xs text-muted-foreground">Tiến độ chung</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
