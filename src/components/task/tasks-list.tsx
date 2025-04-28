"use client"
import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreHorizontalIcon, CalendarIcon, ClockIcon, AlertCircleIcon, BarChartIcon, Trash2Icon, PencilIcon, EyeIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { AddTaskDialog } from "@/components/task/add-task-dialog"
import Link from "next/link"

interface Task {
  id: string
  name: string
  project_id: string
  project: {
    name: string
  }
  description: string
  status: "todo" | "in_progress" | "review" | "completed" | "blocked" | "archived"
  estimate_low: number
  estimate_high: number
  weight: number
  due_date: string
  risk_level: number
  complexity: number
  assigned_to: string | null
  users?: {
    full_name: string
  }
  task_progress?: {
    planned_start: string
    planned_finish: string
    actual_start: string | null
    actual_finish: string | null
    status_snapshot: "on_time" | "late" | "ahead"
  }
  user_task_perf?: {
    planned_hours: number
    actual_hours: number
    on_time: boolean
    qual_score: number
  }
}

interface Project {
  id: string
  name: string
}

const statusColors: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
  todo: { variant: "secondary", label: "Chưa bắt đầu" },
  in_progress: { variant: "default", label: "Đang thực hiện" },
  review: { variant: "secondary", label: "Đang xem xét" },
  completed: { variant: "outline", label: "Hoàn thành" },
  blocked: { variant: "destructive", label: "Bị chặn" },
  archived: { variant: "outline", label: "Lưu trữ" }
}

export function TasksList() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (selectedProject) {
      loadTasks()
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

  async function updateTaskStatus(taskId: string, newStatus: string) {
    try {
      const res = await fetch(`/api/projects/${selectedProject}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error("Failed to update task status")
      toast.success("Cập nhật trạng thái thành công")
      loadTasks()
    } catch (err) {
      toast.error("Lỗi", { description: "Không thể cập nhật trạng thái" })
    }
  }

  async function updateTask() {
    if (!selectedTask) return
    try {
      const res = await fetch(`/api/projects/${selectedProject}/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedTask),
      })
      if (!res.ok) throw new Error("Failed to update task")
      toast.success("Cập nhật công việc thành công")
      setIsEditDialogOpen(false)
      setSelectedTask(null)
      loadTasks()
    } catch (err) {
      toast.error("Lỗi", { description: "Không thể cập nhật công việc" })
    }
  }

  async function deleteTask(taskId: string) {
    try {
      const res = await fetch(`/api/projects/${selectedProject}/tasks/${taskId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete task")
      toast.success("Xóa công việc thành công")
      loadTasks()
    } catch (err) {
      toast.error("Lỗi", { description: "Không thể xóa công việc" })
    }
  }

  function calculateProgress(task: Task): number {
    if (!task.task_progress) return 0
    const { planned_start, planned_finish, actual_start, actual_finish } = task.task_progress
    if (!actual_start) return 0
    if (actual_finish) return 100

    const start = new Date(planned_start).getTime()
    const finish = new Date(planned_finish).getTime()
    const now = new Date().getTime()
    const actualStart = new Date(actual_start).getTime()

    const totalDuration = finish - start
    const elapsedDuration = now - actualStart
    return Math.min(Math.round((elapsedDuration / totalDuration) * 100), 100)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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

        <AddTaskDialog projectId={selectedProject} onCreated={loadTasks} />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nhiệm Vụ</TableHead>
              <TableHead>Người Phụ Trách</TableHead>
              <TableHead>Tiến Độ</TableHead>
              <TableHead>Trạng Thái</TableHead>
              <TableHead>Ước Tính</TableHead>
              <TableHead>Rủi Ro</TableHead>
              <TableHead>Hạn Chót</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.isArray(tasks) && tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell className="font-medium">{task.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>{task.users?.full_name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs">{task.users?.full_name || "Chưa gán"}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${calculateProgress(task)}%` }}
                      />
                    </div>
                    <span className="text-xs">{calculateProgress(task)}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={statusColors[task.status]?.variant || "secondary"}>
                    {statusColors[task.status]?.label || task.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-xs">
                    <ClockIcon className="h-3 w-3" />
                    {task.estimate_low}-{task.estimate_high}h
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-xs">
                    <AlertCircleIcon className="h-3 w-3" />
                    {task.risk_level}/5
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-xs">
                    <CalendarIcon className="h-3 w-3" />
                    {format(new Date(task.due_date), "dd/MM/yyyy")}
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Mở menu</span>
                        <MoreHorizontalIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Thao tác</DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/tasks/${task.id}`}>
                          <EyeIcon className="mr-2 h-4 w-4" />
                          Xem chi tiết
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setSelectedTask(task)
                        setIsEditDialogOpen(true)
                      }}>
                        <PencilIcon className="mr-2 h-4 w-4" />
                        Chỉnh sửa
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => deleteTask(task.id)}
                      >
                        <Trash2Icon className="mr-2 h-4 w-4" />
                        Xóa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
