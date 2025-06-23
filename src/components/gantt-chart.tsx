"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeftIcon, ChevronRightIcon, ZoomInIcon, ZoomOutIcon, RefreshCwIcon, CheckCircle, AlertCircle, TrendingUp, Clock, Users, Scale } from "lucide-react"
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

interface GanttChartProps {
  projectId: string
  onOptimize?: (optimizedData: any) => void
}

interface OptimizationResult {
  algorithm_used: string;
  original_makespan: number;
  optimized_makespan: number;
  improvement_percentage: number;
  resource_utilization_before: number;
  resource_utilization_after: number;
  workload_balance: number;
  explanation: {
  strategy: string;
  key_improvements: string[];
  trade_offs: string[];
  constraints_considered: string[];
  why_optimal: string;
  };
  schedule_changes: {
  task_id: string;
  task_name: string;
    change_type: string;
  original_start: string;
  new_start: string;
  original_assignee?: string;
  new_assignee?: string;
  reason: string;
  impact: string;
  }[];
  critical_path: string[];
}

interface OptimizationConfig {
  algorithm: 'genetic' | 'cpm' | 'resource_leveling';
  objective: {
    type: 'time' | 'resource' | 'cost' | 'multi';
    weights?: {
      time_weight: number;
      resource_weight: number;
      cost_weight: number;
    };
  };
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
  const [optimizationConfig, setOptimizationConfig] = useState<OptimizationConfig>({
    algorithm: 'genetic',
    objective: {
      type: 'multi',
      weights: {
        time_weight: 0.4,
        resource_weight: 0.3,
        cost_weight: 0.3
      }
    }
  })

  // Tải dữ liệu dự án
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

  // Vẽ biểu đồ Gantt
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !projectData) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    // Thiết lập kích thước canvas
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    // Xóa canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Cài đặt biểu đồ
    const chartStartX = 250
    const chartWidth = canvas.width / dpr - chartStartX
    const rowHeight = 40
    const headerHeight = 60

    // Lấy dữ liệu hiển thị (gốc hoặc đã tối ưu)
    const displayData = showOptimized && optimizedData ? optimizedData : projectData
    const { project, tasks = [], phases = [] } = displayData || {}

    // Tính toán phạm vi ngày
    if (!project?.start_date || !project?.end_date) return
    const startDate = new Date(project.start_date)
    const endDate = new Date(project.end_date)
    const projectDuration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    const dayWidth = (chartWidth / projectDuration) * zoom

    // Vẽ tiêu đề
    ctx.fillStyle = "#f8fafc"
    ctx.fillRect(0, 0, canvas.width, headerHeight)

    // Vẽ nền tên nhiệm vụ
    ctx.fillStyle = "#f8fafc"
    ctx.fillRect(0, headerHeight, chartStartX, canvas.height)

    // Vẽ đường lưới
    ctx.strokeStyle = "#e2e8f0"
    ctx.lineWidth = 1

    // Vẽ đường lưới ngang
    for (let i = 0; i <= tasks.length; i++) {
      const y = headerHeight + i * rowHeight
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    // Vẽ đường lưới dọc và nhãn tháng
    const months = ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12"]
    const currentDate = new Date(startDate)
    currentDate.setDate(1) // Bắt đầu từ đầu tháng

    while (currentDate <= endDate) {
      const days = (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      const x = chartStartX + days * dayWidth - scrollPosition

      if (x >= chartStartX && x <= chartStartX + chartWidth) {
        // Vẽ đường dọc
        ctx.beginPath()
        ctx.moveTo(x, headerHeight)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()

        // Vẽ nhãn tháng
        ctx.fillStyle = "#64748b"
        ctx.font = "12px Inter, sans-serif"
        ctx.textAlign = "center"
        ctx.fillText(`${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`, x, headerHeight / 2)
      }

      // Chuyển sang tháng tiếp theo
      currentDate.setMonth(currentDate.getMonth() + 1)
    }

    // Vẽ tên nhiệm vụ
    ctx.fillStyle = "#0f172a"
    ctx.font = "12px Inter, sans-serif"
    ctx.textAlign = "left"

    tasks.forEach((task: any, index: number) => {
      if (!task?.name) return
      const y = headerHeight + index * rowHeight + rowHeight / 2 + 4
      ctx.fillText(task.name, 10, y)
    })

    // Vẽ thanh nhiệm vụ
    tasks.forEach((task: any, index: number) => {
      if (!task?.start_date || !task?.end_date) return
      // Xác định ngày bắt đầu và kết thúc (gốc hoặc đã tối ưu)
      const taskStartDate = new Date(showOptimized && task.optimized_start ? task.optimized_start : task.start_date)
      const taskEndDate = new Date(showOptimized && task.optimized_end ? task.optimized_end : task.end_date)

      const taskStartDays = (taskStartDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      const taskDuration = (taskEndDate.getTime() - taskStartDate.getTime()) / (1000 * 60 * 60 * 24)

      const x = chartStartX + taskStartDays * dayWidth - scrollPosition
      const y = headerHeight + index * rowHeight + 10
      const width = taskDuration * dayWidth
      const height = rowHeight - 20

      // Xác định màu sắc dựa trên giai đoạn hoặc trạng thái
      const phaseIndex = phases?.findIndex((phase: any) => phase.id === task.phase_id) ?? -1
      const colors = ["#4338ca", "#0891b2", "#0d9488", "#0284c7", "#7c3aed", "#e11d48", "#ea580c", "#4f46e5"]
      const color = phaseIndex >= 0 ? colors[phaseIndex % colors.length] : "#64748b"

      // Chỉ vẽ nếu nhìn thấy được
      if (x + width >= chartStartX && x <= chartStartX + chartWidth) {
        // Vẽ nền thanh nhiệm vụ
        ctx.fillStyle = color + "40" // Thêm độ trong suốt
        ctx.fillRect(x, y, width, height)

        // Vẽ tiến độ nếu có
        if (task.progress !== undefined) {
          ctx.fillStyle = color
          ctx.fillRect(x, y, width * (task.progress / 100), height)
        }

        // Vẽ viền thanh nhiệm vụ
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, width, height)

        // Vẽ tên nhiệm vụ trên thanh nếu có đủ không gian
        if (width > 50) {
          ctx.fillStyle = "#ffffff"
          ctx.font = "10px Inter, sans-serif"
          ctx.textAlign = "left"
          ctx.fillText(task.name, x + 5, y + height / 2 + 3)
        }
      }
    })
  }, [projectData, optimizedData, zoom, scrollPosition, showOptimized])

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev * 1.2, 3))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev / 1.2, 0.5))
  }

  const handleScrollLeft = () => {
    setScrollPosition((prev) => Math.max(prev - 100, 0))
  }

  const handleScrollRight = () => {
    if (!projectData) return

    // Tính toán cuộn tối đa dựa trên thời gian dự án và zoom
    const { project } = projectData
    const startDate = new Date(project.start_date)
    const endDate = new Date(project.end_date)
    const projectDuration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    const maxScroll = projectDuration * 10 * zoom - 500 // Tính toán gần đúng
    setScrollPosition((prev) => Math.min(prev + 100, maxScroll))
  }

  const handleOptimize = async () => {
    if (!projectId) return

    setIsOptimizing(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/optimize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(optimizationConfig),
      })

      if (!response.ok) throw new Error("Không thể tối ưu hóa lịch trình")

      const data = await response.json()
      
      // Cập nhật kết quả tối ưu
      if (data.schedule) {
        setOptimizedData({
          ...projectData,
          tasks: projectData.tasks.map((task: any) => {
            const optimizedTask = data.schedule.schedule_changes.find(
              (change: any) => change.task_id === task.id
            );
            if (optimizedTask) {
              return {
                ...task,
                optimized_start: optimizedTask.new_start,
                optimized_end: optimizedTask.new_start, // You may want to calculate this based on task duration
                optimized_assignee: optimizedTask.new_assignee
              };
            }
            return task;
          })
        });
      }
      setShowOptimized(true)
      setOptimizationResult(data)

      if (onOptimize) {
        onOptimize(data.schedule)
      }

      toast.success("Đã tối ưu hóa lịch trình thành công")
    } catch (error) {
      console.error("Error optimizing schedule:", error)
      toast.error("Lỗi khi tối ưu hóa lịch trình")
    } finally {
      setIsOptimizing(false)
    }
  }

  const toggleOptimizedView = () => {
    setShowOptimized((prev) => !prev)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Biểu đồ Gantt</h2>
        <div className="flex gap-4">
          <select
            className="px-3 py-2 border rounded-md"
            value={optimizationConfig.algorithm}
            onChange={(e) => setOptimizationConfig(prev => ({
              ...prev,
              algorithm: e.target.value as 'genetic' | 'cpm' | 'resource_leveling'
            }))}
          >
            <option value="genetic">Thuật toán di truyền</option>
            <option value="cpm">Phương pháp đường găng</option>
            <option value="resource_leveling">Cân bằng tài nguyên</option>
          </select>
          <select
            className="px-3 py-2 border rounded-md"
            value={optimizationConfig.objective.type}
            onChange={(e) => setOptimizationConfig(prev => ({
              ...prev,
            objective: { 
                ...prev.objective,
                type: e.target.value as 'time' | 'resource' | 'cost' | 'multi'
              }
            }))}
          >
            <option value="time">Tối ưu thời gian</option>
            <option value="resource">Tối ưu tài nguyên</option>
            <option value="cost">Tối ưu chi phí</option>
            <option value="multi">Tối ưu đa mục tiêu</option>
          </select>
          <Button 
            onClick={handleOptimize}
            disabled={isOptimizing}
          >
            {isOptimizing ? "Đang tối ưu..." : "Tối ưu lịch trình"}
          </Button>
        </div>
      </div>

      {optimizationResult && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Thời gian hoàn thành
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{optimizationResult.optimized_makespan.toFixed(1)} giờ</div>
              <Progress value={optimizationResult.improvement_percentage} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-2">
                Giảm {optimizationResult.improvement_percentage.toFixed(1)}% so với kế hoạch ban đầu
              </p>
            </CardContent>
          </Card>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Tỷ lệ sử dụng tài nguyên
            </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
              <div className="text-2xl font-bold">
                {(optimizationResult.resource_utilization_after * 100).toFixed(1)}%
                </div>
              <Progress value={optimizationResult.resource_utilization_after * 100} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-2">
                Tăng {((optimizationResult.resource_utilization_after - optimizationResult.resource_utilization_before) * 100).toFixed(1)}% so với trước
              </p>
          </CardContent>
        </Card>
        
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Cân bằng khối lượng
              </CardTitle>
              <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
              <div className="text-2xl font-bold">
                {(optimizationResult.workload_balance * 100).toFixed(1)}%
            </div>
              <Progress value={optimizationResult.workload_balance * 100} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-2">
                Phân bổ công việc đồng đều giữa các thành viên
              </p>
          </CardContent>
        </Card>
        </div>
      )}
        
      {optimizationResult && (
        <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Giải thích tối ưu
            </CardTitle>
          </CardHeader>
          <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Chiến lược tối ưu:</h4>
                  <p className="text-sm text-muted-foreground">{optimizationResult.explanation.strategy}</p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Cải thiện chính:</h4>
            <ul className="space-y-2">
                    {optimizationResult.explanation.key_improvements.map((improvement, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{improvement}</span>
                </li>
              ))}
            </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Đánh đổi:</h4>
            <ul className="space-y-2">
                    {optimizationResult.explanation.trade_offs.map((tradeoff, index) => (
                <li key={index} className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{tradeoff}</span>
                </li>
              ))}
            </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Ràng buộc đã xem xét:</h4>
                  <ul className="space-y-2">
                    {optimizationResult.explanation.constraints_considered.map((constraint, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{constraint}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Tại sao đây là giải pháp tối ưu:</h4>
                  <p className="text-sm text-muted-foreground">{optimizationResult.explanation.why_optimal}</p>
                </div>
              </div>
          </CardContent>
        </Card>
        
          <Card>
            <CardHeader>
              <CardTitle>Thay đổi lịch trình</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {optimizationResult.schedule_changes.map((change, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{change.task_name}</span>
                      <Badge variant="outline">{change.change_type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">{change.reason}</p>
                    <p className="text-sm font-medium text-green-600">{change.impact}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        )}
        
        <Card>
        <CardContent className="p-4">
          <div className="flex justify-between gap-2 mb-4">
            <div>
              {optimizedData && (
                <Button variant={showOptimized ? "default" : "outline"} onClick={toggleOptimizedView} className="mr-2">
                  {showOptimized ? "Xem lịch gốc" : "Xem lịch tối ưu"}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
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
          <div className="w-full h-[500px] overflow-hidden">
            {isLoading && !projectData ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCwIcon className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <canvas ref={canvasRef} className="w-full h-full" style={{ width: "100%", height: "100%" }} />
            )}
          </div>
          </CardContent>
        </Card>
      </div>
  )
  }
