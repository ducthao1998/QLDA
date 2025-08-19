"use client"

import { useState, useEffect } from "react"
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  differenceInDays,
  addWeeks,
  subWeeks,
  isBefore,
  isAfter,
} from "date-fns"
import { vi } from "date-fns/locale"
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, AlertCircleIcon, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import Link from "next/link"

interface Task {
  id: number
  name: string
  project_id: string
  phase_id: string | null
  status: string
  start_date: string | null
  end_date: string | null
  project_phases?: {
    id: string
    name: string
    order_no: number
  } | null
  task_raci?: Array<{
    role: string
    users: {
      id: string
      full_name: string
      position?: string
    } | null
  }>
}

interface Project {
  id: string
  name: string
  description?: string
}

interface ProjectPhase {
  id: string
  name: string
  order_no: number
  project_id: string
}

export default function SchedulePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>("")
  const [tasks, setTasks] = useState<Task[]>([])
  const [phases, setPhases] = useState<ProjectPhase[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"week" | "month">("week")

  // Debug state
  const [debugInfo, setDebugInfo] = useState<any>({})

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (selectedProject) {
      console.log("Selected project changed:", selectedProject)
      loadTasks()
      loadPhases()
    } else {
      setTasks([])
      setPhases([])
    }
  }, [selectedProject])

  async function loadProjects() {
    try {
      setIsLoadingProjects(true)
      setError(null)
      console.log("Loading projects...")

      const res = await fetch("/api/projects?limit=100")
      console.log("Projects API response status:", res.status)

      if (!res.ok) {
        const errorText = await res.text()
        console.error("Projects API error:", errorText)
        throw new Error(`Failed to load projects: ${res.status}`)
      }

      const data = await res.json()
      console.log("Projects API response data:", data)

      const projectsData = data.data || data.projects || []
      console.log("Processed projects:", projectsData)

      setProjects(projectsData)

      // Auto-select first project
      if (projectsData.length > 0 && !selectedProject) {
        console.log("Auto-selecting first project:", projectsData[0].id)
        setSelectedProject(projectsData[0].id)
      }

      setDebugInfo((prev: any) => ({ ...prev, projectsCount: projectsData.length }))
    } catch (err: any) {
      console.error("Error loading projects:", err)
      setError(`Không thể tải danh sách dự án: ${err.message}`)
      toast.error("Lỗi", { description: "Không thể tải danh sách dự án" })
    } finally {
      setIsLoadingProjects(false)
    }
  }

  async function loadTasks() {
    try {
      setIsLoadingTasks(true)
      setError(null)
      console.log("Loading tasks for project:", selectedProject)

      const res = await fetch(`/api/projects/${selectedProject}/tasks`)
      console.log("Tasks API response status:", res.status)

      if (!res.ok) {
        const errorText = await res.text()
        console.error("Tasks API error:", errorText)
        throw new Error(`Failed to load tasks: ${res.status}`)
      }

      const data = await res.json()
      console.log("Tasks API response data:", data)

      const tasksData = data.data || data.tasks || []
      console.log("Processed tasks:", tasksData)

      setTasks(tasksData)
      setDebugInfo((prev: any) => ({ ...prev, tasksCount: tasksData.length }))
    } catch (err: any) {
      console.error("Error loading tasks:", err)
      setError(`Không thể tải danh sách công việc: ${err.message}`)
      toast.error("Lỗi", { description: "Không thể tải danh sách công việc" })
    } finally {
      setIsLoadingTasks(false)
    }
  }

  async function loadPhases() {
    try {
      console.log("Loading phases for project:", selectedProject)

      const res = await fetch(`/api/projects/${selectedProject}/phases`)
      console.log("Phases API response status:", res.status)

      if (!res.ok) {
        const errorText = await res.text()
        console.error("Phases API error:", errorText)
        throw new Error(`Failed to load phases: ${res.status}`)
      }

      const data = await res.json()
      console.log("Phases API response data:", data)

      const phasesData = data.data || data.phases || []
      console.log("Processed phases:", phasesData)

      setPhases(phasesData)
      setDebugInfo((prev: any) => ({ ...prev, phasesCount: phasesData.length }))
    } catch (err: any) {
      console.error("Error loading phases:", err)
      toast.error("Lỗi", { description: "Không thể tải danh sách giai đoạn" })
    }
  }

  // Get days for the current view
  const getDaysInView = () => {
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      return eachDayOfInterval({ start, end })
    } else {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = addDays(start, 27)
      return eachDayOfInterval({ start, end })
    }
  }

  const days = getDaysInView()

  // Navigation functions
  const goToPrevious = () => {
    if (viewMode === "week") {
      setCurrentDate(subWeeks(currentDate, 1))
    } else {
      setCurrentDate(subWeeks(currentDate, 4))
    }
  }

  const goToNext = () => {
    if (viewMode === "week") {
      setCurrentDate(addWeeks(currentDate, 1))
    } else {
      setCurrentDate(addWeeks(currentDate, 4))
    }
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Group tasks by phase
  const tasksByPhase = phases
    .sort((a, b) => a.order_no - b.order_no)
    .map((phase) => {
      const phaseTasks = tasks.filter((task) => task.phase_id === phase.id)
      return {
        phase,
        tasks: phaseTasks,
      }
    })

  // Add tasks without phase
  const tasksWithoutPhase = tasks.filter((task) => !task.phase_id)
  if (tasksWithoutPhase.length > 0) {
    tasksByPhase.push({
      phase: { id: "no-phase", name: "Không có giai đoạn", order_no: 999, project_id: selectedProject },
      tasks: tasksWithoutPhase,
    })
  }

  // Check if a task is approaching deadline (within 3 days)
  const isApproachingDeadline = (task: Task) => {
    if (!task.end_date) return false
    const endDate = new Date(task.end_date)
    const today = new Date()
    const daysUntilDeadline = differenceInDays(endDate, today)
    return daysUntilDeadline >= 0 && daysUntilDeadline <= 3
  }

  // Check if a task is overdue
  const isOverdue = (task: Task) => {
    if (!task.end_date) return false
    const endDate = new Date(task.end_date)
    const today = new Date()
    return isBefore(endDate, today) && task.status !== "completed" && task.status !== "done"
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "todo":
        return "bg-gray-400"
      case "in_progress":
        return "bg-blue-500"
      case "review":
        return "bg-amber-500"
      case "completed":
      case "done":
        return "bg-green-500"
      case "blocked":
        return "bg-red-500"
      default:
        return "bg-gray-300"
    }
  }

  // Get responsible user from RACI
  const getResponsibleUser = (task: Task) => {
    return task.task_raci?.find((raci) => raci.role === "R")?.users
  }

  // Calculate task position and width in the calendar
  const getTaskStyle = (task: Task) => {
    if (!task.start_date || !task.end_date) return { display: "none" }

    const startDate = new Date(task.start_date)
    const endDate = new Date(task.end_date)

    // Check if task is within the current view
    const viewStart = days[0]
    const viewEnd = days[days.length - 1]

    if (isAfter(startDate, viewEnd) || isBefore(endDate, viewStart)) {
      return { display: "none" }
    }

    // Calculate position
    const visibleStartDate = isBefore(startDate, viewStart) ? viewStart : startDate
    const visibleEndDate = isAfter(endDate, viewEnd) ? viewEnd : endDate

    const startOffset = differenceInDays(visibleStartDate, viewStart)
    const duration = differenceInDays(visibleEndDate, visibleStartDate) + 1

    const startPercentage = (startOffset / days.length) * 100
    const widthPercentage = (duration / days.length) * 100

    return {
      left: `${startPercentage}%`,
      width: `${widthPercentage}%`,
    }
  }

  if (isLoadingProjects) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Đang tải dự án...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lịch dự án</h1>
          <p className="text-muted-foreground">Theo dõi tiến độ và lịch trình các công việc</p>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Chọn dự án" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={viewMode} onValueChange={(value: "week" | "month") => setViewMode(value)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Chế độ xem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Tuần</SelectItem>
              <SelectItem value="month">Tháng</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Debug Info */}
      {/* <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm">Debug Information</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-1">
          <p>Selected Project: {selectedProject}</p>
          <p>Projects Count: {debugInfo.projectsCount || 0}</p>
          <p>Tasks Count: {debugInfo.tasksCount || 0}</p>
          <p>Phases Count: {debugInfo.phasesCount || 0}</p>
          <p>Loading Tasks: {isLoadingTasks ? "Yes" : "No"}</p>
        </CardContent>
      </Card> */}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {viewMode === "week"
                ? `Tuần ${format(days[0], "'từ' dd/MM/yyyy 'đến' ", { locale: vi })}${format(days[days.length - 1], "dd/MM/yyyy", { locale: vi })}`
                : `Tháng ${format(currentDate, "MM/yyyy", { locale: vi })}`}
            </CardTitle>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToPrevious}>
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Hôm nay
              </Button>
              <Button variant="outline" size="sm" onClick={goToNext}>
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoadingTasks ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <p>Đang tải công việc...</p>
              </div>
            </div>
          ) : !selectedProject ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Vui lòng chọn một dự án để xem lịch trình</p>
              </div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-muted-foreground">
                <AlertCircleIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Không có công việc nào trong dự án này</p>
                <p className="text-sm mt-2">Hãy thêm công việc để xem lịch trình</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Calendar header */}
              <div className="grid grid-cols-7 gap-1">
                {days.slice(0, 7).map((day, i) => (
                  <div key={i} className="text-center font-medium py-2 text-sm">
                    {format(day, "EEEE", { locale: vi })}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1 mb-6">
                {days.map((day, i) => {
                  const isToday = isSameDay(day, new Date())
                  return (
                    <div
                      key={i}
                      className={`border rounded-md h-12 p-1 text-right ${
                        isToday ? "bg-blue-50 border-blue-300" : "hover:bg-muted/50"
                      }`}
                    >
                      <span className={`text-sm ${isToday ? "font-bold text-blue-600" : ""}`}>{format(day, "d")}</span>
                    </div>
                  )
                })}
              </div>

              {/* Tasks by phase */}
              <div className="space-y-6">
                {tasksByPhase.length > 0 ? (
                  tasksByPhase.map(({ phase, tasks: phaseTasks }) => (
                    <div key={phase.id} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{phase.name}</h3>
                        <Badge variant="outline">{phaseTasks.length} công việc</Badge>
                      </div>

                      <div className="relative bg-muted/20 rounded-lg p-4">
                        {/* Calendar grid lines */}
                        <div className="grid grid-cols-7 gap-1 absolute inset-4 pointer-events-none opacity-30">
                          {days.map((day, i) => (
                            <div key={i} className="border-r border-dashed h-full"></div>
                          ))}
                        </div>

                        {/* Tasks */}
                        <div className="relative min-h-[80px] space-y-2">
                          {phaseTasks.map((task, index) => {
                            const taskStyle = getTaskStyle(task)
                            const isApproaching = isApproachingDeadline(task)
                            const isLate = isOverdue(task)
                            const responsibleUser = getResponsibleUser(task)

                            if (taskStyle.display === "none") return null

                            return (
                              <TooltipProvider key={task.id}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Link href={`/dashboard/tasks/${task.id}`}>
                                      <div
                                        className={`absolute h-8 rounded-md px-2 py-1 text-xs text-white flex items-center overflow-hidden cursor-pointer hover:opacity-90 transition-opacity ${getStatusColor(task.status)} ${
                                          isApproaching ? "ring-2 ring-amber-400" : ""
                                        } ${isLate ? "ring-2 ring-red-500" : ""}`}
                                        style={{
                                          ...taskStyle,
                                          top: `${index * 36}px`,
                                          zIndex: 10,
                                        }}
                                      >
                                        <div className="flex items-center gap-1 w-full">
                                          {responsibleUser && (
                                            <Avatar className="h-4 w-4">
                                              <AvatarFallback className="text-[8px] bg-white/20">
                                                {responsibleUser.full_name?.[0]}
                                              </AvatarFallback>
                                            </Avatar>
                                          )}
                                          <span className="truncate font-medium">{task.name}</span>
                                          {isLate && <AlertCircleIcon className="h-3 w-3 flex-shrink-0" />}
                                        </div>
                                      </div>
                                    </Link>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <div className="space-y-1 max-w-xs">
                                      <p className="font-medium">{task.name}</p>
                                      {task.start_date && task.end_date && (
                                        <p className="text-xs">
                                          {format(new Date(task.start_date), "dd/MM/yyyy")} - {""}
                                          {format(new Date(task.end_date), "dd/MM/yyyy")}
                                        </p>
                                      )}
                                      <p className="text-xs">
                                        Người thực hiện: {responsibleUser?.full_name || "Chưa gán"}
                                      </p>
                                      <p className="text-xs">Trạng thái: {task.status}</p>
                                      {isLate && <p className="text-xs text-red-400 font-medium">⚠️ Đã quá hạn!</p>}
                                      {isApproaching && !isLate && (
                                        <p className="text-xs text-amber-400 font-medium">⏰ Sắp đến hạn!</p>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Không có giai đoạn nào được định nghĩa cho dự án này</p>
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 text-sm border-t pt-4">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                  <span>Đang thực hiện</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-amber-500 rounded-sm"></div>
                  <span>Đang xem xét</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                  <span>Hoàn thành</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                  <span>Bị chặn</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-gray-400 rounded-sm"></div>
                  <span>Chưa bắt đầu</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-amber-400 rounded-sm"></div>
                  <span>Sắp đến hạn</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-red-500 rounded-sm"></div>
                  <span>Quá hạn</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


