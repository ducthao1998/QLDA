"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeftIcon, ChevronRightIcon, ZoomInIcon, ZoomOutIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

interface GanttChartProps {
  projectId: string
  onOptimize?: (optimizedData: any) => void
}

export function GanttChart({ projectId, onOptimize }: GanttChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zoom, setZoom] = useState(1)
  const [scrollPosition, setScrollPosition] = useState(0)
  const [projectData, setProjectData] = useState<any>(null)
  const [optimizedData, setOptimizedData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showOptimized, setShowOptimized] = useState(false)

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
    const { project, tasks, phases } = displayData

    // Tính toán phạm vi ngày
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
      const y = headerHeight + index * rowHeight + rowHeight / 2 + 4
      ctx.fillText(task.name, 10, y)
    })

    // Vẽ thanh nhiệm vụ
    tasks.forEach((task: any, index: number) => {
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
      const phaseIndex = phases.findIndex((phase: any) => phase.id === task.phase_id)
      const colors = ["#4338ca", "#0891b2", "#0d9488", "#0284c7", "#7c3aed", "#e11d48", "#ea580c", "#4f46e5"]
      const color = colors[phaseIndex % colors.length] || "#64748b"

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

    // Vẽ các phụ thuộc
    ctx.strokeStyle = "#94a3b8"
    ctx.lineWidth = 1

    tasks.forEach((task: any, taskIndex: number) => {
      if (task.dependencies && task.dependencies.length > 0) {
        const taskStartDate = new Date(showOptimized && task.optimized_start ? task.optimized_start : task.start_date)
        const taskStartDays = (taskStartDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        const taskStartX = chartStartX + taskStartDays * dayWidth - scrollPosition
        const taskStartY = headerHeight + taskIndex * rowHeight + rowHeight / 2

        task.dependencies.forEach((depId: string) => {
          const depTaskIndex = tasks.findIndex((t: any) => t.id === depId)
          if (depTaskIndex !== -1) {
            const depTask = tasks[depTaskIndex]
            const depEndDate = new Date(
              showOptimized && depTask.optimized_end ? depTask.optimized_end : depTask.end_date,
            )
            const depEndDays = (depEndDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
            const depEndX = chartStartX + depEndDays * dayWidth - scrollPosition
            const depEndY = headerHeight + depTaskIndex * rowHeight + rowHeight / 2

            // Vẽ mũi tên từ điểm kết thúc phụ thuộc đến điểm bắt đầu nhiệm vụ
            ctx.beginPath()
            ctx.moveTo(depEndX, depEndY)

            // Tạo đường dẫn với góc vuông
            const midX = (depEndX + taskStartX) / 2
            ctx.lineTo(midX, depEndY)
            ctx.lineTo(midX, taskStartY)
            ctx.lineTo(taskStartX, taskStartY)

            ctx.stroke()

            // Vẽ đầu mũi tên
            ctx.beginPath()
            ctx.moveTo(taskStartX, taskStartY)
            ctx.lineTo(taskStartX - 5, taskStartY - 3)
            ctx.lineTo(taskStartX - 5, taskStartY + 3)
            ctx.closePath()
            ctx.fillStyle = "#94a3b8"
            ctx.fill()
          }
        })
      }
    })

    // Vẽ đường găng nếu có dữ liệu tối ưu
    if (showOptimized && optimizedData && optimizedData.criticalPath) {
      const criticalPath = optimizedData.criticalPath

      // Vẽ đường găng
      ctx.strokeStyle = "#ef4444"
      ctx.lineWidth = 2

      criticalPath.forEach((taskId: string) => {
        const taskIndex = tasks.findIndex((t: any) => t.id === taskId)
        if (taskIndex !== -1) {
          const task = tasks[taskIndex]
          const taskStartDate = new Date(task.optimized_start || task.start_date)
          const taskEndDate = new Date(task.optimized_end || task.end_date)

          const taskStartDays = (taskStartDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
          const taskDuration = (taskEndDate.getTime() - taskStartDate.getTime()) / (1000 * 60 * 60 * 24)

          const x = chartStartX + taskStartDays * dayWidth - scrollPosition
          const y = headerHeight + taskIndex * rowHeight + rowHeight / 2
          const width = taskDuration * dayWidth

          // Vẽ đường dưới thanh công việc
          ctx.beginPath()
          ctx.moveTo(x, y + 10)
          ctx.lineTo(x + width, y + 10)
          ctx.stroke()
        }
      })
    }
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

    try {
      setIsLoading(true)
      const response = await fetch(`/api/projects/${projectId}/optimize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          algorithm: "genetic", // Có thể thay đổi thành "cpm" hoặc "resource-leveling"
          objective: "multi", // Có thể thay đổi thành "time", "resource", hoặc "balance"
        }),
      })

      if (!response.ok) throw new Error("Không thể tối ưu hóa lịch trình")

      const data = await response.json()
      setOptimizedData(data.schedule)
      setShowOptimized(true)

      // Gọi callback nếu có
      if (onOptimize) {
        onOptimize(data.schedule)
      }

      toast.success("Đã tối ưu hóa lịch trình thành công")
    } catch (error) {
      console.error("Error optimizing schedule:", error)
      toast.error("Lỗi khi tối ưu hóa lịch trình")
    } finally {
      setIsLoading(false)
    }
  }

  const toggleOptimizedView = () => {
    setShowOptimized((prev) => !prev)
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between gap-2 mb-4">
          <div>
            {optimizedData && (
              <Button variant={showOptimized ? "default" : "outline"} onClick={toggleOptimizedView} className="mr-2">
                {showOptimized ? "Xem lịch gốc" : "Xem lịch tối ưu"}
              </Button>
            )}
            <Button variant="outline" onClick={handleOptimize} disabled={isLoading || !projectData}>
              {isLoading ? (
                <>
                  <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
                  Đang tối ưu...
                </>
              ) : (
                "Tối ưu lịch trình"
              )}
            </Button>
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
        {showOptimized && optimizedData && (
          <div className="mt-4 text-sm">
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-md p-3">
                <div className="font-medium mb-1">Thời gian hoàn thành</div>
                <div className="text-lg">{optimizedData.makespan} giờ</div>
              </div>
              <div className="border rounded-md p-3">
                <div className="font-medium mb-1">Tỷ lệ sử dụng tài nguyên</div>
                <div className="text-lg">{Math.round(optimizedData.resourceUtilization * 100)}%</div>
              </div>
              <div className="border rounded-md p-3">
                <div className="font-medium mb-1">Cân bằng khối lượng</div>
                <div className="text-lg">{Math.round(optimizedData.workloadBalance * 100)}%</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
