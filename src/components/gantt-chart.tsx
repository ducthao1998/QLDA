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
  TrendingUp,
  Clock,
  Users,
  Calendar,
  CalendarDays,
  CalendarRange,
  Route,
  Target,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface GanttChartProps {
  projectId: string
}

interface Task {
  id: string
  name: string
  duration_days: number
  status: string
  progress: number
  assigned_to?: string
  assigned_user_name?: string
  dependencies: string[]
  is_overdue: boolean
  is_critical_path?: boolean
  calculated_start_date?: string
  calculated_end_date?: string
  level?: number
}

interface OptimizationResult {
  algorithm_used: string
  original_makespan: number
  optimized_makespan: number
  improvement_percentage: number
  resource_utilization: number
  critical_path: string[]
  optimized_schedule: Task[]
}

type ViewMode = "day" | "week" | "month"

export function GanttChart({ projectId }: GanttChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [scrollPosition, setScrollPosition] = useState(0)
  const [verticalScroll, setVerticalScroll] = useState(0)
  const [projectData, setProjectData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [showDependenciesOnly, setShowDependenciesOnly] = useState(false)

  // Sắp xếp task theo thứ tự logic (topological sort)
  const sortTasksByDependencies = (tasks: Task[], dependencies: any[]): Task[] => {
    if (!dependencies || dependencies.length === 0) {
      // Nếu không có dependencies, sắp xếp theo thứ tự ban đầu
      return tasks.map((task, index) => ({ ...task, level: index }))
    }

    const taskMap = new Map<string, Task>()
    const dependencyMap = new Map<string, string[]>()
    const inDegree = new Map<string, number>()

    // Initialize maps
    tasks.forEach((task) => {
      taskMap.set(task.id, task)
      const deps = dependencies.filter((dep) => dep.task_id === task.id).map((dep) => dep.depends_on_id)
      dependencyMap.set(task.id, deps)
      inDegree.set(task.id, deps.length)
    })

    const sortedTasks: Task[] = []
    const queue: string[] = []
    const levels = new Map<string, number>()

    // Find tasks with no dependencies (level 0)
    tasks.forEach((task) => {
      if (inDegree.get(task.id) === 0) {
        queue.push(task.id)
        levels.set(task.id, 0)
      }
    })

    // Process tasks level by level
    while (queue.length > 0) {
      const currentTaskId = queue.shift()!
      const currentTask = taskMap.get(currentTaskId)!
      const currentLevel = levels.get(currentTaskId) || 0

      currentTask.level = currentLevel
      sortedTasks.push(currentTask)

      // Update dependent tasks
      tasks.forEach((task) => {
        const deps = dependencyMap.get(task.id) || []
        if (deps.includes(currentTaskId)) {
          const newInDegree = (inDegree.get(task.id) || 0) - 1
          inDegree.set(task.id, newInDegree)

          if (newInDegree === 0) {
            queue.push(task.id)
            levels.set(task.id, currentLevel + 1)
          }
        }
      })
    }

    // Add remaining tasks (those without proper dependencies) at the end
    const remainingTasks = tasks.filter((task) => !sortedTasks.find((t) => t.id === task.id))
    remainingTasks.forEach((task, index) => {
      task.level = sortedTasks.length + index
      sortedTasks.push(task)
    })

    // Ensure all tasks are included
    if (sortedTasks.length !== tasks.length) {
      console.warn(`Sorting issue: ${sortedTasks.length} vs ${tasks.length} tasks`)
      const missingTasks = tasks.filter((task) => !sortedTasks.find((t) => t.id === task.id))
      missingTasks.forEach((task, index) => {
        task.level = sortedTasks.length + index
        sortedTasks.push(task)
      })
    }

    return sortedTasks
  }

  // Calculate task dates based on dependencies and duration
  const calculateTaskDates = (tasks: Task[], dependencies: any[], projectStartDate: Date): Task[] => {
    const taskMap = new Map<string, Task>()
    const dependencyMap = new Map<string, string[]>()

    // Initialize task map and dependency map
    tasks.forEach((task) => {
      taskMap.set(task.id, { ...task, calculated_start_date: "", calculated_end_date: "" })
      dependencyMap.set(
        task.id,
        dependencies.filter((dep) => dep.task_id === task.id).map((dep) => dep.depends_on_id),
      )
    })

    // Sort tasks by dependencies first
    const sortedTasks = sortTasksByDependencies(tasks, dependencies)

    // Calculate dates for each task in sorted order
    sortedTasks.forEach((task) => {
      const deps = dependencyMap.get(task.id) || []
      let startDate = new Date(projectStartDate)

      // If task has dependencies, start after the latest dependency ends
      if (deps.length > 0) {
        let latestEndDate = new Date(projectStartDate)
        deps.forEach((depId) => {
          const depTask = taskMap.get(depId)
          if (depTask && depTask.calculated_end_date) {
            const depEndDate = new Date(depTask.calculated_end_date)
            if (depEndDate >= latestEndDate) {
              latestEndDate = new Date(depEndDate)
              latestEndDate.setDate(latestEndDate.getDate() + 1) // Start next day
            }
          }
        })
        startDate = latestEndDate
      }

      const endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + (task.duration_days || 1) - 1)

      const updatedTask = taskMap.get(task.id)!
      updatedTask.calculated_start_date = startDate.toISOString()
      updatedTask.calculated_end_date = endDate.toISOString()
      taskMap.set(task.id, updatedTask)
    })

    return Array.from(taskMap.values())
  }

  // Calculate display tasks for height calculation
  const getDisplayTasks = () => {
    if (!projectData) return []
    
    const { tasks = [] } = projectData
    let displayTasks = optimizationResult?.optimized_schedule || tasks

    // Sort tasks by dependencies for better display
    if (projectData.dependencies) {
      displayTasks = sortTasksByDependencies(displayTasks, projectData.dependencies)
    }

    // Ensure all tasks are in the sorted list (fix for missing tasks)
    const allTaskIds = new Set(displayTasks.map((t: Task) => t.id))
    const missingTasks = tasks.filter((t: Task) => !allTaskIds.has(t.id))
    if (missingTasks.length > 0) {
      displayTasks = [...displayTasks, ...missingTasks]
    }

    // Filter tasks based on dependencies toggle
    if (showDependenciesOnly) {
      displayTasks = displayTasks.filter((task: Task) => task.dependencies.length > 0)
    }

    return displayTasks
  }

  // Load project data and auto-optimize
  useEffect(() => {
    if (!projectId) return

    async function fetchProjectDataAndOptimize() {
      try {
        setIsLoading(true)
        console.log("Fetching project data for ID:", projectId)

        // Fetch project data
        const response = await fetch(`/api/projects/${projectId}/gantt`)
        console.log("Response status:", response.status)

        if (!response.ok) {
          const errorText = await response.text()
          console.error("API Error:", errorText)
          throw new Error(`Không thể tải dữ liệu dự án: ${response.status}`)
        }

        const data = await response.json()
        console.log("Received data:", data)
        console.log("Tasks count:", data.tasks?.length || 0)

        // Calculate task dates based on dependencies
        if (data.tasks && data.tasks.length > 0 && data.project?.start_date) {
          const projectStartDate = new Date(data.project.start_date)
          const tasksWithDates = calculateTaskDates(data.tasks, data.dependencies || [], projectStartDate)

          // Update data with calculated dates
          data.tasks = tasksWithDates

          // Calculate project end date based on latest task end date
          const latestEndDate = new Date(
            Math.max(...tasksWithDates.map((t) => new Date(t.calculated_end_date || 0).getTime())),
          )
          data.project.end_date = latestEndDate.toISOString()
        }

        setProjectData(data)

        // Auto-optimize using Multi-Project CPM
        if (data.tasks && data.tasks.length > 0) {
          console.log("Auto-optimizing project with Multi-Project CPM...")
          const optimizeResponse = await fetch(`/api/projects/${projectId}/optimize`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              algorithm: "multi_project_cpm",
              objective: {
                type: "multi",
                weights: {
                  time_weight: 0.5,
                  resource_weight: 0.3,
                  cost_weight: 0.2,
                },
              },
            }),
          })

          if (optimizeResponse.ok) {
            const optimizationData = await optimizeResponse.json()
            setOptimizationResult(optimizationData)
            console.log("Multi-Project CPM optimization completed:", optimizationData)
            toast.success("Dự án đã được tối ưu hóa với Multi-Project CPM!")
          } else {
            console.warn("Auto-optimization failed, continuing with original data")
          }
        }
      } catch (error) {
        console.error("Error fetching project data:", error)
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        toast.error(`Lỗi khi tải dữ liệu dự án: ${errorMessage}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProjectDataAndOptimize()
  }, [projectId])

  // Helper function to get time unit width
  const getTimeUnitWidth = (projectDuration: number, chartWidth: number) => {
    let baseWidth
    switch (viewMode) {
      case "day":
        baseWidth = Math.max(30, chartWidth / projectDuration) // Minimum 30px per day
        break
      case "week":
        baseWidth = Math.max(50, chartWidth / (projectDuration / 7)) // Minimum 50px per week
        break
      case "month":
        baseWidth = Math.max(80, chartWidth / (projectDuration / 30)) // Minimum 80px per month
        break
      default:
        baseWidth = Math.max(30, chartWidth / projectDuration)
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
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        return `${weekStart.getDate()}/${weekStart.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`
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
    if (!canvas || !projectData) {
      console.log("Canvas or project data missing:", { canvas: !!canvas, projectData: !!projectData })
      return
    }

    const ctx = canvas.getContext("2d")
    if (!ctx) {
      console.log("Cannot get canvas context")
      return
    }

    console.log("Drawing optimized Gantt chart with data:", projectData)

    const dpr = window.devicePixelRatio || 1

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Chart settings
    const chartStartX = 350 // Increased for better task name display
    const chartWidth = Math.max(800, canvas.width / dpr - chartStartX - 20) // Minimum chart width
    const rowHeight = 50 // Increased row height
    const headerHeight = 100 // Increased header height

    // Get display data - use optimized schedule if available
    const { project, tasks = [] } = projectData || {}
    let displayTasks = optimizationResult?.optimized_schedule || tasks

    if (!project?.start_date || !project?.end_date) {
      console.log("Missing project dates:", project)
      return
    }

    // Sort tasks by dependencies for better display
    if (projectData.dependencies) {
      displayTasks = sortTasksByDependencies(displayTasks, projectData.dependencies)
    }

    // Ensure all tasks are in the sorted list (fix for missing tasks)
    const allTaskIds = new Set(displayTasks.map((t: Task) => t.id))
    const missingTasks = tasks.filter((t: Task) => !allTaskIds.has(t.id))
    if (missingTasks.length > 0) {
      displayTasks = [...displayTasks, ...missingTasks]
    }

    // Filter tasks based on dependencies toggle
    if (showDependenciesOnly) {
      displayTasks = displayTasks.filter((task: Task) => task.dependencies.length > 0)
    }

    const startDate = new Date(project.start_date)
    const endDate = new Date(project.end_date)
    const projectDuration = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const unitWidth = getTimeUnitWidth(projectDuration, chartWidth)

    // Draw header background
    ctx.fillStyle = "#f8fafc"
    ctx.fillRect(0, 0, canvas.width, headerHeight)

    // Draw task names background
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, headerHeight, chartStartX, canvas.height)
    ctx.strokeStyle = "#e2e8f0"
    ctx.lineWidth = 1
    ctx.strokeRect(0, headerHeight, chartStartX, canvas.height - headerHeight)

    // Draw chart background
    ctx.fillStyle = "#fefefe"
    ctx.fillRect(chartStartX, headerHeight, chartWidth, canvas.height - headerHeight)

    // Draw grid lines
    ctx.strokeStyle = "#e2e8f0"
    ctx.lineWidth = 0.5

    // Horizontal grid lines
    for (let i = 0; i <= displayTasks.length; i++) {
      const y = headerHeight + i * rowHeight - verticalScroll
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
        break
      case "week":
        currentDate.setDate(startDate.getDate() - startDate.getDay())
        break
      case "month":
        currentDate.setDate(1)
        break
    }

         const maxX = chartStartX + chartWidth
     let lastLabelX = chartStartX - 50 // Track last label position to avoid overlap
     
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

       if (x >= chartStartX && x <= maxX) {
         // Draw vertical grid line
         ctx.strokeStyle = "#e2e8f0"
         ctx.lineWidth = 0.5
         ctx.beginPath()
         ctx.moveTo(x, headerHeight)
         ctx.lineTo(x, canvas.height)
         ctx.stroke()

         // Draw time label with spacing check
         const label = formatDateLabel(currentDate)
         const labelWidth = ctx.measureText(label).width
         const minSpacing = 60 // Minimum spacing between labels
         
         if (x - lastLabelX >= minSpacing) {
           ctx.fillStyle = "#64748b"
           ctx.font = "12px Inter, sans-serif"
           ctx.textAlign = "center"
           ctx.fillText(label, x, headerHeight - 30)
           lastLabelX = x + labelWidth / 2
         }
       }

       // Move to next time unit
       const nextDate = getNextTimeUnit(currentDate)
       currentDate.setTime(nextDate.getTime())
     }

    // Draw column headers
    ctx.fillStyle = "#0f172a"
    ctx.font = "bold 14px Inter, sans-serif"
    ctx.textAlign = "left"

    // Header labels
    ctx.fillText("Tên công việc", 15, headerHeight - 60)
    ctx.fillText("Người thực hiện", 15, headerHeight - 40)
    ctx.fillText("Tiến độ", 15, headerHeight - 20)

    // Draw timeline header
    ctx.textAlign = "center"
    ctx.fillText("Thời gian thực hiện", chartStartX + chartWidth / 2, headerHeight - 60)

    // Draw tasks with optimized schedule
    displayTasks.forEach((task: Task, index: number) => {
      const y = headerHeight + index * rowHeight - verticalScroll
      const taskAreaHeight = rowHeight - 2

      // Skip if task is not visible
      if (y + taskAreaHeight < headerHeight || y > canvas.height / dpr) {
        return
      }

      // Alternate row background
      if (index % 2 === 0) {
        ctx.fillStyle = "#f9fafb"
        ctx.fillRect(0, y, chartStartX, taskAreaHeight)
      }

      // Draw task info with better formatting
      ctx.textAlign = "left"

      // Task name (bold, larger)
      ctx.fillStyle = "#0f172a"
      ctx.font = "bold 13px Inter, sans-serif"
      const displayName = task.name.length > 25 ? task.name.substring(0, 25) + "..." : task.name
      ctx.fillText(displayName, 15, y + 18)

      // Assigned user (smaller, muted)
      ctx.fillStyle = "#64748b"
      ctx.font = "11px Inter, sans-serif"
      const userName = task.assigned_user_name || "Chưa phân công"
      const displayUserName = userName.length > 20 ? userName.substring(0, 20) + "..." : userName
      ctx.fillText(`👤 ${displayUserName}`, 15, y + 32)

      // Progress (with percentage)
      ctx.fillStyle = "#059669"
      ctx.font = "11px Inter, sans-serif"
      ctx.fillText(`📊 ${task.progress}%`, 15, y + 46)

      // Draw task bar using calculated dates
      const taskStartDate = task.calculated_start_date ? new Date(task.calculated_start_date) : null
      const taskEndDate = task.calculated_end_date ? new Date(task.calculated_end_date) : null

      if (!taskStartDate || !taskEndDate) {
        console.log(`Task ${task.id} missing calculated dates`)
        return
      }

      const taskStartDays = (taskStartDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      const taskDuration = (taskEndDate.getTime() - taskStartDate.getTime()) / (1000 * 60 * 60 * 24) + 1

      let barX: number, barWidth: number

      switch (viewMode) {
        case "day":
          barX = chartStartX + taskStartDays * unitWidth - scrollPosition
          barWidth = Math.max(20, taskDuration * unitWidth) // Minimum width
          break
        case "week":
          barX = chartStartX + (taskStartDays / 7) * unitWidth - scrollPosition
          barWidth = Math.max(30, (taskDuration / 7) * unitWidth)
          break
        case "month":
          barX = chartStartX + (taskStartDays / 30) * unitWidth - scrollPosition
          barWidth = Math.max(40, (taskDuration / 30) * unitWidth)
          break
        default:
          barX = chartStartX + taskStartDays * unitWidth - scrollPosition
          barWidth = Math.max(20, taskDuration * unitWidth)
      }

      const barY = y + 8
      const barHeight = taskAreaHeight - 16

      // Determine color based on status and critical path
      let barColor = "#3b82f6" // Default blue
      let barLabel = ""

      if (task.status === "done") {
        barColor = "#10b981" // Green
        barLabel = "✓"
      } else if (task.is_overdue) {
        barColor = "#ef4444" // Red
        barLabel = "⚠"
      } else if (task.status === "in_progress") {
        barColor = "#f59e0b" // Orange
        barLabel = "⏳"
      }

      // Highlight critical path tasks
      const isCriticalPath = optimizationResult?.critical_path?.includes(task.id) || task.is_critical_path
      if (isCriticalPath) {
        barColor = "#dc2626" // Critical path red
        barLabel = "🔥"
      }

      // Only draw if visible
      if (barX + barWidth >= chartStartX && barX <= maxX) {
        // Draw task background with rounded corners
        ctx.fillStyle = barColor + "20"
        ctx.beginPath()
        ctx.roundRect(barX, barY, barWidth, barHeight, 4)
        ctx.fill()

        // Draw progress
        if (task.progress > 0) {
          ctx.fillStyle = barColor
          ctx.beginPath()
          ctx.roundRect(barX, barY, barWidth * (task.progress / 100), barHeight, 4)
          ctx.fill()
        }

        // Draw border
        ctx.strokeStyle = barColor
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(barX, barY, barWidth, barHeight, 4)
        ctx.stroke()

        // Draw task label inside bar if there's space
        if (barWidth > 60) {
          ctx.fillStyle = "#ffffff"
          ctx.font = "bold 11px Inter, sans-serif"
          ctx.textAlign = "center"
          const shortName = task.name.length > 15 ? task.name.substring(0, 15) + "..." : task.name
          ctx.fillText(`${barLabel} ${shortName}`, barX + barWidth / 2, barY + barHeight / 2 + 4)
        } else if (barWidth > 30) {
          ctx.fillStyle = "#ffffff"
          ctx.font = "12px Inter, sans-serif"
          ctx.textAlign = "center"
          ctx.fillText(barLabel, barX + barWidth / 2, barY + barHeight / 2 + 4)
        }

        // Draw dependencies with better styling
        if (task.dependencies.length > 0) {
          ctx.strokeStyle = "#94a3b8"
          ctx.lineWidth = 2
          ctx.setLineDash([3, 3])

          task.dependencies.forEach((depId) => {
            const depTask = displayTasks.find((t: Task) => t.id === depId)
            if (depTask && depTask.calculated_end_date) {
              const depIndex = displayTasks.indexOf(depTask)
              const depEndDate = new Date(depTask.calculated_end_date)
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

              const depY = headerHeight + depIndex * rowHeight + rowHeight / 2 - verticalScroll

              // Only draw arrow if dependency is visible and not too far vertically
              const verticalDistance = Math.abs(depY - (barY + barHeight / 2))
              if (verticalDistance < 200 && depY >= headerHeight - 50) {
                // Draw curved arrow from dependency to current task
                ctx.beginPath()
                ctx.moveTo(depX + 5, depY)

                // Control points for curve - make it more horizontal
                const midX = (depX + barX) / 2
                const midY1 = depY
                const midY2 = barY + barHeight / 2

                ctx.bezierCurveTo(midX, midY1, midX, midY2, barX - 8, barY + barHeight / 2)
                ctx.stroke()

                // Draw arrow head
                ctx.beginPath()
                ctx.moveTo(barX - 8, barY + barHeight / 2)
                ctx.lineTo(barX - 15, barY + barHeight / 2 - 4)
                ctx.lineTo(barX - 15, barY + barHeight / 2 + 4)
                ctx.closePath()
                ctx.fillStyle = "#94a3b8"
                ctx.fill()
              }
            }
          })
          ctx.setLineDash([])
        }
      }
    })

         // Draw legend
    //  if (optimizationResult) {
    //    const legendY = canvas.height / dpr - 80
    //    ctx.fillStyle = "#ffffff"
    //    ctx.fillRect(10, legendY - 15, 500, 70)
    //    ctx.strokeStyle = "#e2e8f0"
    //    ctx.strokeRect(10, legendY - 15, 500, 70)

    //    ctx.fillStyle = "#0f172a"
    //    ctx.font = "bold 12px Inter, sans-serif"
    //    ctx.textAlign = "left"
    //    ctx.fillText("Chú thích:", 20, legendY + 5)

    //    // Critical path indicator
    //    ctx.fillStyle = "#dc262620"
    //    ctx.fillRect(90, legendY - 5, 20, 15)
    //    ctx.strokeStyle = "#dc2626"
    //    ctx.strokeRect(90, legendY - 5, 20, 15)
    //    ctx.fillStyle = "#0f172a"
    //    ctx.font = "11px Inter, sans-serif"
    //    ctx.fillText("🔥 Đường găng (Multi-Project CPM)", 115, legendY + 5)

    //    // Status indicators - better spacing
    //    ctx.fillText("✓ Hoàn thành", 20, legendY + 25)
    //    ctx.fillText("⏳ Đang thực hiện", 120, legendY + 25)
    //    ctx.fillText("⚠ Quá hạn", 220, legendY + 25)
    //    ctx.fillText("🔵 Chưa bắt đầu", 320, legendY + 25)

    //    // Second row for more indicators
    //    ctx.fillText("📊 Tiến độ", 20, legendY + 45)
    //    ctx.fillText("👤 Người thực hiện", 120, legendY + 45)
    //    ctx.fillText("🔗 Dependencies", 220, legendY + 45)
    //  }
        }, [projectData, zoom, scrollPosition, verticalScroll, optimizationResult, viewMode, showDependenciesOnly])

   // Force canvas re-render when dependencies toggle changes
   useEffect(() => {
     if (canvasRef.current && projectData) {
       const canvas = canvasRef.current
       const rect = canvas.getBoundingClientRect()
       const dpr = window.devicePixelRatio || 1
       canvas.width = rect.width * dpr
       canvas.height = rect.height * dpr
     }
   }, [showDependenciesOnly, projectData])

   const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.5, 5))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev / 1.5, 0.3))
  const handleScrollLeft = () => setScrollPosition((prev) => Math.max(prev - 150, 0))
  const handleScrollRight = () => setScrollPosition((prev) => prev + 150)
  const handleScrollUp = () => setVerticalScroll((prev) => Math.max(prev - 50, 0))
  const handleScrollDown = () => setVerticalScroll((prev) => prev + 50)

  // Handle mouse wheel for vertical scrolling
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setVerticalScroll((prev) => {
      const newScroll = prev + e.deltaY
      return Math.max(0, newScroll)
    })
  }

  return (
    <div className="space-y-6">
             {/* Optimization Results */}
       {optimizationResult && (
         <div className="space-y-4">
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
                 <div className="text-2xl font-bold text-blue-600">
                   {(optimizationResult.resource_utilization * 100).toFixed(1)}%
                 </div>
                 <Progress value={optimizationResult.resource_utilization * 100} className="mt-2" />
                 <p className="text-xs text-muted-foreground mt-2">Tỷ lệ sử dụng tài nguyên tối ưu</p>
               </CardContent>
             </Card>

             <Card>
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-medium">Thuật toán</CardTitle>
                 <Zap className="h-4 w-4 text-muted-foreground" />
               </CardHeader>
               <CardContent>
                 <div className="flex items-center gap-2">
                   <Route className="h-5 w-5 text-purple-600" />
                   <span className="text-lg font-semibold">Multi-Project CPM</span>
                 </div>
                 <p className="text-xs text-muted-foreground mt-2">Tối ưu hóa đường đi dựa trên Critical Path Method</p>
                 <Badge variant="default" className="mt-2">
                   <Target className="h-3 w-3 mr-1" />
                   Đường găng tối ưu
                 </Badge>
               </CardContent>
             </Card>
           </div>

           {/* Optimization Explanation */}
           <Card>
             <CardHeader>
               <CardTitle className="flex items-center gap-2">
                 <Target className="h-5 w-5 text-purple-600" />
                 Giải thích tối ưu hóa Multi-Project CPM
               </CardTitle>
             </CardHeader>
             <CardContent>
               <div className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div>
                     <h4 className="font-semibold text-sm mb-2">🔥 Đường găng (Critical Path)</h4>
                     <ul className="text-sm text-muted-foreground space-y-1">
                       <li>• Xác định chuỗi tasks dài nhất</li>
                       <li>• Tasks không thể trì hoãn</li>
                       <li>• Màu đỏ trong biểu đồ</li>
                     </ul>
                   </div>
                   <div>
                     <h4 className="font-semibold text-sm mb-2">⚡ Tối ưu hóa</h4>
                     <ul className="text-sm text-muted-foreground space-y-1">
                       <li>• Sắp xếp theo dependencies</li>
                       <li>• Giảm thời gian chờ</li>
                       <li>• Tăng hiệu suất tài nguyên</li>
                     </ul>
                   </div>
                 </div>
                 
                 <div className="bg-blue-50 p-4 rounded-lg">
                   <h4 className="font-semibold text-sm mb-2 text-blue-800">📊 Kết quả cụ thể</h4>
                   <div className="text-sm text-blue-700 space-y-1">
                     <p>• <strong>Thời gian:</strong> Giảm từ {optimizationResult.original_makespan} xuống {optimizationResult.optimized_makespan} ngày</p>
                     <p>• <strong>Hiệu suất:</strong> Tăng {(optimizationResult.resource_utilization * 100).toFixed(1)}% sử dụng tài nguyên</p>
                     <p>• <strong>Đường găng:</strong> {optimizationResult.critical_path?.length || 0} tasks quan trọng</p>
                   </div>
                 </div>
               </div>
             </CardContent>
           </Card>
         </div>
       )}

      {/* Gantt Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Biểu đồ Gantt - Multi-Project CPM Optimization
            </CardTitle>
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

                             {/* Controls */}
               <div className="flex items-center gap-2">
                 <Button 
                   variant={showDependenciesOnly ? "default" : "outline"} 
                   size="sm" 
                   onClick={() => setShowDependenciesOnly(!showDependenciesOnly)}
                 >
                   🔗 {showDependenciesOnly ? "Hiện tất cả" : "Chỉ dependencies"}
                 </Button>
                 <Button variant="outline" size="sm" onClick={handleScrollLeft}>
                   <ChevronLeftIcon className="h-4 w-4" />
                 </Button>
                 <Button variant="outline" size="sm" onClick={handleScrollRight}>
                   <ChevronRightIcon className="h-4 w-4" />
                 </Button>
                 <Button variant="outline" size="sm" onClick={handleScrollUp}>
                   ↑
                 </Button>
                 <Button variant="outline" size="sm" onClick={handleScrollDown}>
                   ↓
                 </Button>
                 <Button variant="outline" size="sm" onClick={handleZoomOut}>
                   <ZoomOutIcon className="h-4 w-4" />
                 </Button>
                 <Button variant="outline" size="sm" onClick={handleZoomIn}>
                   <ZoomInIcon className="h-4 w-4" />
                 </Button>
                 <Button variant="outline" size="sm" onClick={() => window.location.reload()} disabled={isLoading}>
                   <RefreshCwIcon className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                 </Button>
               </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <RefreshCwIcon className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Đang tải và tối ưu hóa dự án với Multi-Project CPM...</p>
              </div>
            </div>
          ) : projectData ? (
            <div className="relative" ref={containerRef} onWheel={handleWheel}>
                             <canvas
                 ref={canvasRef}
                 className="w-full border rounded-lg shadow-sm cursor-grab active:cursor-grabbing"
                 style={{ 
                  //  height: `${Math.max(500, (getDisplayTasks()?.length || 0) * 50 + 160)}px`,
                   transition: 'height 0.3s ease-in-out'
                 }}
               />
              {optimizationResult && (
                <div className="absolute top-4 right-4 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                  ⚡ Multi-Project CPM
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <TrendingUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Không có dữ liệu</h3>
                <p className="text-muted-foreground">Không thể tải dữ liệu dự án hoặc dự án chưa có công việc nào.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
