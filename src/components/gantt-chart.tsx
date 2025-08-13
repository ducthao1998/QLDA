"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
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
  onOptimize?: (results: OptimizationResult) => void
  showOptimizationResults?: boolean
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
  resource_utilization_before: number
  resource_utilization_after: number
  resource_utilization: number // For backward compatibility
  workload_balance: number
  explanation: {
    strategy: string
    key_improvements: string[]
    trade_offs: string[]
    constraints_considered: string[]
    why_optimal: string
  }
  schedule_changes: Array<{
    task_id: string
    task_name: string
    change_type: string
    original_start: string
    new_start: string
    original_assignee?: string
    new_assignee?: string
    reason: string
    impact: string
  }>
  critical_path: string[]
  critical_path_details?: {
    criticalPath: string[]
    totalDuration: number
    criticalPathDuration: number
    explanation: string
    taskDetails: Array<{
      taskId: string
      taskName: string
      duration: number
      slack: number
      isCritical: boolean
      reason: string
    }>
  }
  optimized_schedule?: Task[]
  duration_analysis: {
    total_task_duration: number
    original_parallel_duration: number
    optimized_parallel_duration: number
    duration_reduction: number
    parallel_tasks_count: number
  }
  resource_analysis: {
    total_users: number
    assigned_users: number
    average_workload: number
    max_workload: number
    min_workload: number
    workload_distribution: Array<{
      user_id: string
      user_name: string
      total_hours: number
      task_count: number
      utilization_percentage: number
    }>
  }
  optimization_details: {
    tasks_parallelized: number
    tasks_rescheduled: number
    tasks_reassigned: number
    critical_path_optimized: boolean
    bottlenecks_identified: string[]
  }
}

type ViewMode = "day" | "week" | "month"

export function GanttChart({ projectId, onOptimize, showOptimizationResults = false }: GanttChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [scrollPosition, setScrollPosition] = useState(0)
  const [verticalScroll, setVerticalScroll] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [projectData, setProjectData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [showDependenciesOnly, setShowDependenciesOnly] = useState(false)
  const [hoveredTask, setHoveredTask] = useState<Task | null>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  // Sắp xếp task theo thứ tự logic (topological sort)
  const sortTasksByDependencies = (tasks: Task[], dependencies: any[]): Task[] => {
    if (!dependencies || dependencies.length === 0) {
      return tasks.map((task, index) => ({ ...task, level: index }))
    }

    const taskMap = new Map<string, Task>()
    const dependencyMap = new Map<string, string[]>()
    const inDegree = new Map<string, number>()

    tasks.forEach((task) => {
      taskMap.set(task.id, task)
      const deps = dependencies.filter((dep) => dep.task_id === task.id).map((dep) => dep.depends_on_id)
      dependencyMap.set(task.id, deps)
      inDegree.set(task.id, deps.length)
    })

    const sortedTasks: Task[] = []
    const queue: string[] = []
    const levels = new Map<string, number>()

    tasks.forEach((task) => {
      if (inDegree.get(task.id) === 0) {
        queue.push(task.id)
        levels.set(task.id, 0)
      }
    })

    while (queue.length > 0) {
      const currentTaskId = queue.shift()!
      const currentTask = taskMap.get(currentTaskId)!
      const currentLevel = levels.get(currentTaskId) || 0

      currentTask.level = currentLevel
      sortedTasks.push(currentTask)

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

    const remainingTasks = tasks.filter((task) => !sortedTasks.find((t) => t.id === task.id))
    remainingTasks.forEach((task, index) => {
      task.level = sortedTasks.length + index
      sortedTasks.push(task)
    })

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

  const calculateTaskDates = (tasks: Task[], dependencies: any[], projectStartDate: Date): Task[] => {
    const taskMap = new Map<string, Task>()
    const dependencyMap = new Map<string, string[]>()

    tasks.forEach((task) => {
      taskMap.set(task.id, { ...task, calculated_start_date: "", calculated_end_date: "" })
      dependencyMap.set(
        task.id,
        dependencies.filter((dep) => dep.task_id === task.id).map((dep) => dep.depends_on_id),
      )
    })

    const sortedTasks = sortTasksByDependencies(tasks, dependencies)

    sortedTasks.forEach((task) => {
      const deps = dependencyMap.get(task.id) || []
      let startDate = new Date(projectStartDate)

      if (deps.length > 0) {
        let latestEndDate = new Date(projectStartDate)
        deps.forEach((depId) => {
          const depTask = taskMap.get(depId)
          if (depTask && depTask.calculated_end_date) {
            const depEndDate = new Date(depTask.calculated_end_date)
            if (depEndDate >= latestEndDate) {
              latestEndDate = new Date(depEndDate)
              latestEndDate.setDate(latestEndDate.getDate() + 1)
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

  const getDisplayTasks = () => {
    if (!projectData) return []

    const { tasks = [] } = projectData
    let displayTasks = optimizationResult?.optimized_schedule || tasks

    // Always sort by dependencies to get proper levels
    if (projectData.dependencies) {
      displayTasks = sortTasksByDependencies(displayTasks, projectData.dependencies)
    } else {
      // If no dependencies, assign levels based on index
      displayTasks = displayTasks.map((task: Task, index: number) => ({ ...task, level: index }))
    }

    const allTaskIds = new Set(displayTasks.map((t: Task) => t.id))
    const missingTasks = tasks.filter((t: Task) => !allTaskIds.has(t.id))
    if (missingTasks.length > 0) {
      // Assign levels to missing tasks
      const maxLevel = Math.max(...displayTasks.map((t: Task) => t.level || 0))
      missingTasks.forEach((task: Task, index: number) => {
        task.level = maxLevel + 1 + index
      })
      displayTasks = [...displayTasks, ...missingTasks]
    }

    if (showDependenciesOnly && projectData.dependencies) {
      const tasksWithDeps = new Set<string>()

      // Add tasks that have dependencies
      displayTasks.forEach((task: Task) => {
        if (task.dependencies && task.dependencies.length > 0) {
          tasksWithDeps.add(task.id)
        }
      })

      // Add tasks that are dependencies of others
      projectData.dependencies.forEach((dep: any) => {
        tasksWithDeps.add(dep.depends_on_id) // The task being depended on
        tasksWithDeps.add(dep.task_id) // The task that depends on it
      })

      displayTasks = displayTasks.filter((task: Task) => tasksWithDeps.has(task.id))
    }

    // Sort by level for proper display
    return displayTasks.sort((a: Task, b: Task) => (a.level || 0) - (b.level || 0))
  }

  useEffect(() => {
    if (!projectId) return

    async function fetchProjectDataAndOptimize() {
      try {
        setIsLoading(true)
        console.log("Fetching project data for ID:", projectId)

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

        if (data.tasks && data.tasks.length > 0 && data.project?.start_date) {
          const projectStartDate = new Date(data.project.start_date)
          const tasksWithDates = calculateTaskDates(data.tasks, data.dependencies || [], projectStartDate)

          data.tasks = tasksWithDates

          const latestEndDate = new Date(
            Math.max(...tasksWithDates.map((t) => new Date(t.calculated_end_date || 0).getTime())),
          )
          data.project.end_date = latestEndDate.toISOString()
        }

        setProjectData(data)

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
            
            // Call the onOptimize callback if provided
            if (onOptimize) {
              onOptimize(optimizationData)
            }
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

  const getTimeUnitWidth = (projectDuration: number, chartWidth: number) => {
    let baseWidth
    switch (viewMode) {
      case "day":
        baseWidth = Math.max(30, chartWidth / projectDuration)
        break
      case "week":
        baseWidth = Math.max(50, chartWidth / (projectDuration / 7))
        break
      case "month":
        baseWidth = Math.max(80, chartWidth / (projectDuration / 30))
        break
      default:
        baseWidth = Math.max(30, chartWidth / projectDuration)
    }
    return baseWidth * zoom
  }

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

    const displayTasks = getDisplayTasks()
    const rowHeight = 50
    const headerHeight = 100
    const minChartHeight = 400
    const calculatedHeight = Math.max(minChartHeight, headerHeight + displayTasks.length * rowHeight + 50)

    // Set canvas size with proper height
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = calculatedHeight * dpr
    canvas.style.height = `${calculatedHeight}px`
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Chart settings - Make left panel wider like in the image
    const chartStartX = 400
    const chartWidth = Math.max(800, canvas.width / dpr - chartStartX - 20)

    const { project, tasks = [] } = projectData || {}

    if (!project?.start_date || !project?.end_date) {
      console.log("Missing project dates:", project)
      return
    }

    const startDate = new Date(project.start_date)
    const endDate = new Date(project.end_date)
    const projectDuration = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const unitWidth = getTimeUnitWidth(projectDuration, chartWidth)

    const maxVerticalScroll = Math.max(0, displayTasks.length * rowHeight - (calculatedHeight - headerHeight - 50))

    // Draw header background
    ctx.fillStyle = "#f8fafc"
    ctx.fillRect(0, 0, canvas.width, headerHeight)

    // Draw task names background
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, headerHeight, chartStartX, calculatedHeight - headerHeight)
    ctx.strokeStyle = "#e2e8f0"
    ctx.lineWidth = 1
    ctx.strokeRect(0, headerHeight, chartStartX, calculatedHeight - headerHeight)

    // Draw chart background
    ctx.fillStyle = "#fefefe"
    ctx.fillRect(chartStartX, headerHeight, chartWidth, calculatedHeight - headerHeight)

    // Draw grid lines
    ctx.strokeStyle = "#e2e8f0"
    ctx.lineWidth = 0.5

    for (let i = 0; i <= displayTasks.length; i++) {
      const y = headerHeight + i * rowHeight - verticalScroll
      if (y >= headerHeight && y <= calculatedHeight) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }
    }

    // Vertical grid lines and time labels
    const currentDate = new Date(startDate)

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
    let lastLabelX = chartStartX - 50

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
        ctx.strokeStyle = "#e2e8f0"
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(x, headerHeight)
        ctx.lineTo(x, calculatedHeight)
        ctx.stroke()

        const label = formatDateLabel(currentDate)
        const labelWidth = ctx.measureText(label).width
        const minSpacing = 60

        if (x - lastLabelX >= minSpacing) {
          ctx.fillStyle = "#64748b"
          ctx.font = "12px Inter, sans-serif"
          ctx.textAlign = "center"
          ctx.fillText(label, x, headerHeight - 30)
          lastLabelX = x + labelWidth / 2
        }
      }

      const nextDate = getNextTimeUnit(currentDate)
      currentDate.setTime(nextDate.getTime())
    }

    ctx.fillStyle = "#0f172a"
    ctx.font = "bold 14px Inter, sans-serif"
    ctx.textAlign = "left"

    // Header labels - fixed position regardless of scroll
    ctx.fillText("Tên công việc", 20, headerHeight - 60)
    ctx.fillText("Người thực hiện", 20, headerHeight - 40)
    ctx.fillText("Tiến độ", 20, headerHeight - 20)

    ctx.textAlign = "center"
    ctx.fillText("Thời gian thực hiện", chartStartX + chartWidth / 2, headerHeight - 60)

    displayTasks.forEach((task: Task, index: number) => {
      const y = headerHeight + index * rowHeight - verticalScroll
      const taskAreaHeight = rowHeight - 2

      // Skip if task is not visible in current viewport
      if (y + taskAreaHeight < headerHeight || y > calculatedHeight) {
        return
      }

      // Clean row background - subtle alternating colors like in the image
      if ((task.level || 0) % 2 === 0) {
        ctx.fillStyle = "#f8fafc"
        ctx.fillRect(0, y, chartStartX, taskAreaHeight)
      }

      // Draw task info with better formatting - Clean layout like in the image
      ctx.textAlign = "left"

      // Task name (bold, larger) - Main focus
      ctx.fillStyle = "#0f172a"
      ctx.font = "bold 14px Inter, sans-serif"
      const displayName = task.name.length > 35 ? task.name.substring(0, 35) + "..." : task.name
      ctx.fillText(displayName, 20, y + 20)

      // Assigned user (smaller, muted)
      ctx.fillStyle = "#64748b"
      ctx.font = "12px Inter, sans-serif"
      const userName = task.assigned_user_name || "Chưa phân công"
      const displayUserName = userName.length > 25 ? userName.substring(0, 25) + "..." : userName
      ctx.fillText(`👤 ${displayUserName}`, 20, y + 38)

      // Progress (with percentage)
      ctx.fillStyle = "#059669"
      ctx.font = "12px Inter, sans-serif"
      ctx.fillText(`📊 ${task.progress}%`, 20, y + 56)

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
          barWidth = Math.max(20, taskDuration * unitWidth)
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

      let barColor = "#3b82f6"
      let barLabel = ""

      if (task.status === "done") {
        barColor = "#10b981"
        barLabel = "✓"
      } else if (task.is_overdue) {
        barColor = "#ef4444"
        barLabel = "⚠"
      } else if (task.status === "in_progress") {
        barColor = "#f59e0b"
        barLabel = "⏳"
      }

      const isCriticalPath = optimizationResult?.critical_path?.includes(task.id) || task.is_critical_path
      if (isCriticalPath) {
        barColor = "#dc2626"
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

        // Draw task label inside bar if there's space - Clean like in the image
        if (barWidth > 80) {
          ctx.fillStyle = "#ffffff"
          ctx.font = "bold 12px Inter, sans-serif"
          ctx.textAlign = "center"
          const shortName = task.name.length > 20 ? task.name.substring(0, 20) + "..." : task.name
          ctx.fillText(shortName, barX + barWidth / 2, barY + barHeight / 2 + 4)
        } else if (barWidth > 40) {
          ctx.fillStyle = "#ffffff"
          ctx.font = "12px Inter, sans-serif"
          ctx.textAlign = "center"
          ctx.fillText(barLabel, barX + barWidth / 2, barY + barHeight / 2 + 4)
        }

        // Draw dependencies arrows - Always show them
        // Draw dependencies arrows - Clean and simple like in the image
        if (task.dependencies && task.dependencies.length > 0) {
          ctx.strokeStyle = "#94a3b8"
          ctx.lineWidth = 1.5
          ctx.setLineDash([4, 4])

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

              // Draw simple straight arrow like in the image
              ctx.beginPath()
              ctx.moveTo(depX + 3, depY)
              ctx.lineTo(barX - 3, barY + barHeight / 2)
              ctx.stroke()

              // Draw arrow head
              ctx.beginPath()
              ctx.moveTo(barX - 3, barY + barHeight / 2)
              ctx.lineTo(barX - 8, barY + barHeight / 2 - 3)
              ctx.lineTo(barX - 8, barY + barHeight / 2 + 3)
              ctx.closePath()
              ctx.fillStyle = "#94a3b8"
              ctx.fill()
            }
          })
          ctx.setLineDash([])
        }
      }
    })
  }, [projectData, zoom, scrollPosition, verticalScroll, optimizationResult, viewMode, showDependenciesOnly])

  useEffect(() => {
    if (canvasRef.current && projectData) {
      const canvas = canvasRef.current
      const displayTasks = getDisplayTasks()
      const rowHeight = 50
      const headerHeight = 100
      const minChartHeight = 400
      const calculatedHeight = Math.max(minChartHeight, headerHeight + displayTasks.length * rowHeight + 50)

      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = calculatedHeight * dpr
      canvas.style.height = `${calculatedHeight}px`

      // Reset vertical scroll when toggling dependencies
      setVerticalScroll(0)
    }
  }, [showDependenciesOnly, projectData])

  const handleZoomIn = () => setZoom((prev) => Math.min(prev * 1.5, 5))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev / 1.5, 0.3))

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const displayTasks = getDisplayTasks()
    const rowHeight = 50
    const headerHeight = 100
    const calculatedHeight = Math.max(400, headerHeight + displayTasks.length * rowHeight + 50)
    const maxVerticalScroll = Math.max(0, displayTasks.length * rowHeight - (calculatedHeight - headerHeight - 50))

    setVerticalScroll((prev) => {
      const newScroll = prev + e.deltaY * 0.5 // Slower scroll speed
      return Math.max(0, Math.min(newScroll, maxVerticalScroll))
    })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) {
      // Handle hover for tooltip
      const canvas = canvasRef.current
      if (!canvas || !projectData) return

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // Find task under mouse
      const displayTasks = getDisplayTasks()
      const rowHeight = 50
      const headerHeight = 100
      const chartStartX = 350

      if (x >= chartStartX && y >= headerHeight) {
        const taskIndex = Math.floor((y - headerHeight + verticalScroll) / rowHeight)
        const task = displayTasks[taskIndex]

        if (task) {
          // Check if mouse is over task bar
          const { project } = projectData
          const startDate = new Date(project.start_date)
          const endDate = new Date(project.end_date)
          const projectDuration = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          const chartWidth = Math.max(800, canvas.width - chartStartX - 20)
          const unitWidth = getTimeUnitWidth(projectDuration, chartWidth)

          const taskStartDate = task.calculated_start_date ? new Date(task.calculated_start_date) : null
          const taskEndDate = task.calculated_end_date ? new Date(task.calculated_end_date) : null

          if (taskStartDate && taskEndDate) {
            const taskStartDays = (taskStartDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
            const taskDuration = (taskEndDate.getTime() - taskStartDate.getTime()) / (1000 * 60 * 60 * 24) + 1

            let barX: number, barWidth: number
            switch (viewMode) {
              case "day":
                barX = chartStartX + taskStartDays * unitWidth - scrollPosition
                barWidth = Math.max(20, taskDuration * unitWidth)
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

            if (x >= barX && x <= barX + barWidth) {
              setHoveredTask(task)
              setMousePosition({ x: e.clientX, y: e.clientY })
              return
            }
          }
        }
      }
      setHoveredTask(null)
    } else {
      // Handle dragging
      const deltaX = dragStart.x - e.clientX
      const deltaY = dragStart.y - e.clientY

      // Horizontal scroll
      setScrollPosition((prev) => Math.max(0, prev + deltaX))

      // Vertical scroll with bounds
      const displayTasks = getDisplayTasks()
      const rowHeight = 50
      const headerHeight = 100
      const calculatedHeight = Math.max(400, headerHeight + displayTasks.length * rowHeight + 50)
      const maxVerticalScroll = Math.max(0, displayTasks.length * rowHeight - (calculatedHeight - headerHeight - 50))

      setVerticalScroll((prev) => Math.max(0, Math.min(prev + deltaY, maxVerticalScroll)))

      setDragStart({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  return (
    <div className="space-y-6">
      {/* Optimization Results - Only show if showOptimizationResults is true */}
      {optimizationResult && showOptimizationResults && (
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
                    Giảm {(optimizationResult.improvement_percentage || 0).toFixed(1)}% thời gian
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
                  {((optimizationResult.resource_utilization_after || optimizationResult.resource_utilization || 0) * 100).toFixed(1)}%
                </div>
                <Progress value={(optimizationResult.resource_utilization_after || optimizationResult.resource_utilization || 0) * 100} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  Từ {((optimizationResult.resource_utilization_before || 0) * 100).toFixed(1)}% 
                  {optimizationResult.resource_utilization_after > optimizationResult.resource_utilization_before && (
                    <span className="text-green-600 font-medium">
                      (+{(((optimizationResult.resource_utilization_after - optimizationResult.resource_utilization_before) / Math.max(optimizationResult.resource_utilization_before, 0.01)) * 100).toFixed(1)}%)
                    </span>
                  )}
                </p>
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
                      {optimizationResult.critical_path_details && (
                        <li>• {optimizationResult.critical_path_details.explanation}</li>
                      )}
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
                    <p>
                      • <strong>Thời gian:</strong> Giảm từ {optimizationResult.original_makespan} xuống{" "}
                      {optimizationResult.optimized_makespan} ngày 
                      {optimizationResult.improvement_percentage > 0 && (
                        <span className="text-green-600 font-semibold">
                          (-{optimizationResult.improvement_percentage.toFixed(1)}%)
                        </span>
                      )}
                    </p>
                    <p>
                      • <strong>Hiệu suất tài nguyên:</strong> Từ {((optimizationResult.resource_utilization_before || 0) * 100).toFixed(1)}% 
                      lên {((optimizationResult.resource_utilization_after || optimizationResult.resource_utilization || 0) * 100).toFixed(1)}%
                    </p>
                    <p>
                      • <strong>Đường găng:</strong> {optimizationResult.critical_path?.length || 0} tasks quan trọng
                      {optimizationResult.critical_path_details && (
                        <span className="text-blue-600">
                          ({optimizationResult.critical_path_details.criticalPathDuration.toFixed(1)} ngày)
                        </span>
                      )}
                    </p>
                    <p>
                      • <strong>Tổng duration:</strong> {optimizationResult.duration_analysis?.total_task_duration || 0} ngày công việc
                    </p>
                    <p>
                      • <strong>Thời gian song song:</strong> {optimizationResult.duration_analysis?.optimized_parallel_duration || 0} ngày 
                      (tiết kiệm {optimizationResult.duration_analysis?.duration_reduction || 0} ngày)
                    </p>
                    <p>
                      • <strong>Tasks song song:</strong> {optimizationResult.duration_analysis?.parallel_tasks_count || 0} tasks có thể chạy đồng thời
                    </p>
                    <p>
                      • <strong>Nhân sự được phân công:</strong> {optimizationResult.resource_analysis?.assigned_users || 0}/{optimizationResult.resource_analysis?.total_users || 0} người
                    </p>
                    <p>
                      • <strong>Tasks được tối ưu:</strong> {optimizationResult.optimization_details?.tasks_rescheduled || 0} tasks được điều chỉnh lịch trình
                    </p>
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
            <div className="relative" ref={containerRef}>
              <canvas
                ref={canvasRef}
                className="w-full border rounded-lg shadow-sm cursor-grab active:cursor-grabbing"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ touchAction: "none" }} // Prevent touch scrolling on mobile
              />
              {optimizationResult && (
                <div className="absolute top-4 right-4 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                  ⚡ Multi-Project CPM - Đã tối ưu
                </div>
              )}
              {getDisplayTasks().length > 8 && (
                <div className="absolute bottom-4 left-4 bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                  Cuộn để xem thêm tasks ({getDisplayTasks().length} tổng cộng)
                </div>
              )}
              

              
              {/* Hover Tooltip */}
              {hoveredTask && (
                <div 
                  className="absolute bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 max-w-sm"
                  style={{
                    left: mousePosition.x + 10,
                    top: mousePosition.y - 10,
                    transform: 'translateY(-100%)'
                  }}
                >
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm text-gray-900">{hoveredTask.name}</h4>
                    
                    <div className="text-xs space-y-1">
                      <p><strong>Duration:</strong> {hoveredTask.duration_days} ngày</p>
                      <p><strong>Status:</strong> {hoveredTask.status}</p>
                      <p><strong>Progress:</strong> {hoveredTask.progress}%</p>
                      {hoveredTask.assigned_user_name && (
                        <p><strong>Assigned:</strong> {hoveredTask.assigned_user_name}</p>
                      )}
                      
                      {optimizationResult && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="font-medium text-blue-600">Tối ưu hóa:</p>
                          {optimizationResult.critical_path?.includes(hoveredTask.id) && (
                            <p className="text-red-600">🔥 Critical Path Task</p>
                          )}
                          {optimizationResult.schedule_changes?.find(change => change.task_id === hoveredTask.id) && (
                            <div className="text-xs">
                              <p><strong>Thay đổi:</strong> {optimizationResult.schedule_changes.find(change => change.task_id === hoveredTask.id)?.change_type}</p>
                              <p><strong>Lý do:</strong> {optimizationResult.schedule_changes.find(change => change.task_id === hoveredTask.id)?.reason}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
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
