"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeftIcon, ChevronRightIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react"

export function GanttChart() {
  const canvasRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [scrollPosition, setScrollPosition] = useState(0)

  // Dữ liệu dự án mẫu
  const project = {
    name: "Dự Án Xây Dựng Đường Cao Tốc",
    startDate: new Date(2025, 0, 15), // 15/01/2025
    endDate: new Date(2025, 11, 30), // 30/12/2025
    tasks: [
      {
        id: 1,
        name: "Lập Kế Hoạch Dự Án",
        startDate: new Date(2025, 0, 15),
        endDate: new Date(2025, 1, 28),
        progress: 100,
        dependencies: [],
        color: "#4338ca",
      },
      {
        id: 2,
        name: "Đánh Giá Môi Trường",
        startDate: new Date(2025, 1, 1),
        endDate: new Date(2025, 3, 30),
        progress: 80,
        dependencies: [1],
        color: "#0891b2",
      },
      {
        id: 3,
        name: "Thu Hồi Đất",
        startDate: new Date(2025, 2, 15),
        endDate: new Date(2025, 5, 30),
        progress: 60,
        dependencies: [1],
        color: "#0d9488",
      },
      {
        id: 4,
        name: "Giai Đoạn Thiết Kế",
        startDate: new Date(2025, 3, 1),
        endDate: new Date(2025, 5, 30),
        progress: 70,
        dependencies: [2],
        color: "#0284c7",
      },
      {
        id: 5,
        name: "Mua Sắm",
        startDate: new Date(2025, 5, 1),
        endDate: new Date(2025, 6, 31),
        progress: 40,
        dependencies: [3, 4],
        color: "#7c3aed",
      },
      {
        id: 6,
        name: "Xây Dựng Giai Đoạn 1",
        startDate: new Date(2025, 7, 1),
        endDate: new Date(2025, 9, 31),
        progress: 20,
        dependencies: [5],
        color: "#e11d48",
      },
      {
        id: 7,
        name: "Xây Dựng Giai Đoạn 2",
        startDate: new Date(2025, 9, 1),
        endDate: new Date(2025, 11, 15),
        progress: 0,
        dependencies: [6],
        color: "#ea580c",
      },
      {
        id: 8,
        name: "Kiểm Tra Cuối Cùng",
        startDate: new Date(2025, 11, 15),
        endDate: new Date(2025, 11, 30),
        progress: 0,
        dependencies: [7],
        color: "#4f46e5",
      },
    ],
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
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

    // Tính toán phạm vi ngày
    const projectDuration = (project.endDate - project.startDate) / (1000 * 60 * 60 * 24)
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
    for (let i = 0; i <= project.tasks.length; i++) {
      const y = headerHeight + i * rowHeight
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    // Vẽ đường lưới dọc và nhãn tháng
    const months = ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12"]
    const currentDate = new Date(project.startDate)
    currentDate.setDate(1) // Bắt đầu từ đầu tháng

    while (currentDate <= project.endDate) {
      const days = (currentDate - project.startDate) / (1000 * 60 * 60 * 24)
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

    project.tasks.forEach((task, index) => {
      const y = headerHeight + index * rowHeight + rowHeight / 2 + 4
      ctx.fillText(task.name, 10, y)
    })

    // Vẽ thanh nhiệm vụ
    project.tasks.forEach((task, index) => {
      const taskStartDays = (task.startDate - project.startDate) / (1000 * 60 * 60 * 24)
      const taskDuration = (task.endDate - task.startDate) / (1000 * 60 * 60 * 24)

      const x = chartStartX + taskStartDays * dayWidth - scrollPosition
      const y = headerHeight + index * rowHeight + 10
      const width = taskDuration * dayWidth
      const height = rowHeight - 20

      // Chỉ vẽ nếu nhìn thấy được
      if (x + width >= chartStartX && x <= chartStartX + chartWidth) {
        // Vẽ nền thanh nhiệm vụ
        ctx.fillStyle = task.color + "40" // Thêm độ trong suốt
        ctx.fillRect(x, y, width, height)

        // Vẽ tiến độ
        ctx.fillStyle = task.color
        ctx.fillRect(x, y, width * (task.progress / 100), height)

        // Vẽ viền thanh nhiệm vụ
        ctx.strokeStyle = task.color
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, width, height)

        // Vẽ tên nhiệm vụ trên thanh nếu có đủ không gian
        if (width > 50) {
          ctx.fillStyle = "#ffffff"
          ctx.font = "10px Inter, sans-serif"
          ctx.textAlign = "left"
          ctx.fillText(`${task.progress}%`, x + 5, y + height / 2 + 3)
        }
      }
    })

    // Vẽ các phụ thuộc
    ctx.strokeStyle = "#94a3b8"
    ctx.lineWidth = 1

    project.tasks.forEach((task) => {
      if (task.dependencies.length > 0) {
        const taskStartDays = (task.startDate - project.startDate) / (1000 * 60 * 60 * 24)
        const taskStartX = chartStartX + taskStartDays * dayWidth - scrollPosition
        const taskStartY = headerHeight + project.tasks.findIndex((t) => t.id === task.id) * rowHeight + rowHeight / 2

        task.dependencies.forEach((depId) => {
          const depTask = project.tasks.find((t) => t.id === depId)
          if (depTask) {
            const depEndDays = (depTask.endDate - project.startDate) / (1000 * 60 * 60 * 24)
            const depEndX = chartStartX + depEndDays * dayWidth - scrollPosition
            const depEndY = headerHeight + project.tasks.findIndex((t) => t.id === depId) * rowHeight + rowHeight / 2

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
  }, [zoom, scrollPosition])

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
    // Tính toán cuộn tối đa dựa trên thời gian dự án và zoom
    const projectDuration = (project.endDate - project.startDate) / (1000 * 60 * 60 * 24)
    const maxScroll = projectDuration * 10 * zoom - 500 // Tính toán gần đúng
    setScrollPosition((prev) => Math.min(prev + 100, maxScroll))
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-end gap-2 mb-4">
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
        <div className="w-full h-[500px] overflow-hidden">
          <canvas ref={canvasRef} className="w-full h-full" style={{ width: "100%", height: "100%" }} />
        </div>
      </CardContent>
    </Card>
  )
}
