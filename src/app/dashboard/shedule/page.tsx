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
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, AlertCircleIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import Link from "next/link"

interface Task {
  id: string
  name: string
  project_id: string
  phase_id: string
  status: string
  start_date: string
  end_date: string
  assigned_to: string | null
  users?: {
    full_name: string
    position?: string
  }
  phases?: {
    name: string
    order_no: number
  }
}

interface Project {
  id: string
  name: string
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
  const [isLoading, setIsLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"week" | "month">("week")

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (selectedProject) {
      loadTasks()
      loadPhases()
    }
  }, [selectedProject])

  async function loadProjects() {
    try {
      const res = await fetch("/api/projects")
      if (!res.ok) throw new Error("Failed to load projects")
      const data = await res.json()
      setProjects(data.projects || [])
      if (data.projects?.length > 0) {
        setSelectedProject(data.projects[0].id)
      }
    } catch (err) {
      toast.error("Lỗi", { description: "Không thể tải danh sách dự án" })
    }
  }

  async function loadTasks() {
    try {
      setIsLoading(true)
      const res = await fetch(`/api/projects/${selectedProject}/tasks`)
      if (!res.ok) throw new Error("Failed to load tasks")
      const data = await res.json()
      setTasks(data.tasks || [])
    } catch (err) {
      toast.error("Lỗi", { description: "Không thể tải danh sách công việc" })
    } finally {
      setIsLoading(false)
    }
  }

  async function loadPhases() {
    try {
      const res = await fetch(`/api/projects/${selectedProject}/phases`)
      if (!res.ok) throw new Error("Failed to load phases")
      const data = await res.json()
      setPhases(data.phases || [])
    } catch (err) {
      toast.error("Lỗi", { description: "Không thể tải danh sách giai đoạn" })
    }
  }

  // Get days for the current view
  const getDaysInView = () => {
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 }) // Start on Monday
      const end = endOfWeek(currentDate, { weekStartsOn: 1 })
      return eachDayOfInterval({ start, end })
    } else {
      // Month view - show 4 weeks
      const start = startOfWeek(currentDate, { weekStartsOn: 1 })
      const end = addDays(start, 27) // 4 weeks
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
        return "bg-gray-200"
      case "in_progress":
        return "bg-blue-500"
      case "review":
        return "bg-amber-400"
      case "completed":
      case "done":
        return "bg-green-500"
      case "blocked":
        return "bg-red-500"
      default:
        return "bg-gray-300"
    }
  }

  // Calculate task position and width in the calendar
  const getTaskStyle = (task: Task) => {
    if (!task.start_date || !task.end_date) return {}

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Lịch dự án</h1>
        <div className="flex items-center gap-2">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[200px]">
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
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Calendar header */}
              <div className="grid grid-cols-7 gap-1">
                {days.slice(0, 7).map((day, i) => (
                  <div key={i} className="text-center font-medium py-2">
                    {format(day, "EEEE", { locale: vi })}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((day, i) => {
                  const isToday = isSameDay(day, new Date())
                  return (
                    <div
                      key={i}
                      className={`border rounded-md h-12 p-1 text-right ${isToday ? "bg-blue-50 border-blue-300" : ""}`}
                    >
                      <span className={`text-sm ${isToday ? "font-bold text-blue-600" : ""}`}>{format(day, "d")}</span>
                    </div>
                  )
                })}
              </div>

              {/* Tasks by phase */}
              <div className="space-y-6 mt-6">
                {tasksByPhase.map(({ phase, tasks }) => (
                  <div key={phase.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{phase.name}</h3>
                      <Badge variant="outline">{tasks.length} công việc</Badge>
                    </div>
                    <div className="relative">
                      {/* Calendar grid lines */}
                      <div className="grid grid-cols-7 gap-1 absolute inset-0 pointer-events-none">
                        {days.map((day, i) => (
                          <div key={i} className="border-r h-full"></div>
                        ))}
                      </div>

                      {/* Tasks */}
                      <div className="relative min-h-[100px] pt-2">
                        {tasks.map((task) => {
                          const taskStyle = getTaskStyle(task)
                          const isApproaching = isApproachingDeadline(task)
                          const isLate = isOverdue(task)

                          return (
                            <TooltipProvider key={task.id}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Link href={`/dashboard/tasks/${task.id}`}>
                                    <div
                                      className={`absolute h-10 rounded-md px-2 py-1 text-xs text-white flex items-center overflow-hidden ${getStatusColor(task.status)} ${
                                        isApproaching ? "border-2 border-amber-400" : ""
                                      } ${isLate ? "border-2 border-red-500" : ""}`}
                                      style={taskStyle}
                                    >
                                      <div className="flex items-center gap-1 w-full">
                                        {task.users && (
                                          <Avatar className="h-5 w-5">
                                            <AvatarFallback className="text-[10px]">
                                              {task.users.full_name?.[0]}
                                            </AvatarFallback>
                                          </Avatar>
                                        )}
                                        <span className="truncate">{task.name}</span>
                                        {isLate && <AlertCircleIcon className="h-3 w-3 flex-shrink-0 text-white" />}
                                      </div>
                                    </div>
                                  </Link>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="space-y-1">
                                    <p className="font-medium">{task.name}</p>
                                    <p className="text-xs">
                                      {format(new Date(task.start_date), "dd/MM/yyyy")} -{" "}
                                      {format(new Date(task.end_date), "dd/MM/yyyy")}
                                    </p>
                                    <p className="text-xs">Người thực hiện: {task.users?.full_name || "Chưa gán"}</p>
                                    {isLate && <p className="text-xs text-red-500 font-medium">Đã quá hạn!</p>}
                                    {isApproaching && !isLate && (
                                      <p className="text-xs text-amber-500 font-medium">Sắp đến hạn!</p>
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
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-sm border-t pt-4">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                  <span>Đang thực hiện</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-amber-400 rounded-sm"></div>
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
                  <div className="w-3 h-3 bg-gray-200 rounded-sm"></div>
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
