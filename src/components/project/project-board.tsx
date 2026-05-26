"use client"

import { useState, useEffect } from "react"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CalendarIcon, PlusIcon, SearchIcon, MoreHorizontalIcon, AlertCircleIcon, Bot, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import type { Project, Task, User, TaskRaci } from "@/app/types/table-types"
import type { UserPermissions } from "@/lib/permissions"
import { CreateTaskModal } from "./create-task-modal"
import { TaskDetailModal } from "./task-detail-modal"
import { AutoAssignRaciModal } from "./auto-assign-raci-modal"

interface ProjectBoardProps {
  projectId: string
  initialProject: Project
  userPermissions: UserPermissions
  currentUser: User
}

interface TaskWithDetails extends Task {
  responsible_user?: {
    full_name: string
    position: string
    org_unit: string
  }
}

const statusColumns = [
  { id: "todo", title: "Chưa bắt đầu", color: "bg-gray-100" },
  { id: "in_progress", title: "Đang thực hiện", color: "bg-blue-100" },
  { id: "review", title: "Đang xem xét", color: "bg-yellow-100" },
  { id: "done", title: "Hoàn thành", color: "bg-green-100" },
]

export function ProjectBoard({
  projectId,
  initialProject,
  userPermissions,
  currentUser,
}: ProjectBoardProps) {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAssignee, setSelectedAssignee] = useState<string>("all")
  const [selectedTask, setSelectedTask] = useState<TaskWithDetails | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAutoAssignModal, setShowAutoAssignModal] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const clearAssignments = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/raci/clear`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Không thể gỡ phân công')
      const data = await res.json()
      toast.success(data.message || 'Đã gỡ phân công')
      fetchTasks()
    } catch (e: any) {
      toast.error(e.message || 'Không thể gỡ phân công')
    } finally {
      setConfirmClear(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [projectId])

  const fetchTasks = async () => {
    try {
      setLoading(true)

      // Fetch tasks only (no phases needed)
      const tasksRes = await fetch(`/api/projects/${projectId}/tasks`)

      if (!tasksRes.ok) {
        throw new Error("Failed to fetch data")
      }

      const tasksData = await tasksRes.json()

      // Fetch RACI data cho từng task để lấy người responsible
      const tasksWithDetails = await Promise.all(
        (tasksData.data || []).map(async (task: Task) => {
          try {
            const raciRes = await fetch(`/api/tasks/${task.id}/raci`)
            if (raciRes.ok) {
              const raciData = await raciRes.json()
              const responsibleUser = raciData.raci?.find((r: TaskRaci) => r.role === "R")

              return {
                ...task,
                responsible_user: responsibleUser?.users,
              }
            }
            return {
              ...task,
              responsible_user: null,
            }
          } catch (error) {
            console.error(`Error fetching RACI for task ${task.id}:`, error)
            return {
              ...task,
              responsible_user: null,
            }
          }
        }),
      )

      setTasks(tasksWithDetails)
    } catch (error) {
      console.error("Error fetching tasks:", error)
      toast.error("Không thể tải danh sách công việc")
    } finally {
      setLoading(false)
    }
  }

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return

    const { source, destination, draggableId } = result

    if (source.droppableId === destination.droppableId) return

    const newStatus = destination.droppableId
    const taskId = draggableId

    // Optimistic update
    setTasks((prev) =>
      prev.map((task) => (task.id.toString() === taskId ? { ...task, status: newStatus as any } : task)),
    )

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to update task status")
      }

      toast.success("Cập nhật trạng thái thành công")
    } catch (error) {
      // Revert optimistic update
      fetchTasks()
      toast.error("Không thể cập nhật trạng thái")
    }
  }

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.responsible_user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesAssignee =
      selectedAssignee === "all" ||
      (selectedAssignee === "me" && task.responsible_user?.full_name === currentUser.full_name) ||
      task.responsible_user?.full_name === selectedAssignee

    return matchesSearch && matchesAssignee
  })

  const getTasksByStatus = (status: string) => {
    return filteredTasks.filter((task) => task.status === status)
  }

  // Remove overdue check since we no longer have end_date
  const isOverdue = (task: TaskWithDetails) => {
    return false
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{initialProject.name}</h1>
          <p className="text-muted-foreground">{initialProject.description}</p>
        </div>

        <div className="flex items-center gap-2">
          {userPermissions.canAssignTasks && (
            <>
              <Button variant="outline" onClick={() => setShowAutoAssignModal(true)}>
                <Bot className="h-4 w-4 mr-2" />
                Phân công tự động
              </Button>
              <Button variant="destructive" onClick={() => setConfirmClear(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Gỡ phân công toàn dự án
              </Button>
              <Button onClick={() => setShowCreateModal(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                Tạo công việc
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:space-y-0 md:space-x-4">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm công việc..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Người thực hiện" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="me">Công việc của tôi</SelectItem>
            {Array.from(new Set(tasks.map((t) => t.responsible_user?.full_name).filter(Boolean))).map((name) => (
              <SelectItem key={name} value={name!}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statusColumns.map((column) => (
            <div key={column.id} className="space-y-4">
              <div className={`p-4 rounded-lg ${column.color}`}>
                <h3 className="font-semibold text-sm">
                  {column.title} ({getTasksByStatus(column.id).length})
                </h3>
              </div>

              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-3 min-h-[200px] p-2 rounded-lg transition-colors ${
                      snapshot.isDraggingOver ? "bg-muted/50" : ""
                    }`}
                  >
                    {getTasksByStatus(column.id).map((task, index) => (
                      <Draggable key={task.id.toString()} draggableId={task.id.toString()} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`cursor-pointer hover:shadow-md transition-shadow ${
                              snapshot.isDragging ? "shadow-lg" : ""
                            } ${isOverdue(task) ? "border-red-200 bg-red-50" : ""}`}
                            onClick={() => setSelectedTask(task)}
                          >
                            <CardContent className="p-4 space-y-3">
                              {/* Task Title */}
                              <div className="flex items-start justify-between">
                                <h4 className="font-medium text-sm line-clamp-2">{task.name}</h4>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                      <MoreHorizontalIcon className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setSelectedTask(task)}>
                                      Xem chi tiết
                                    </DropdownMenuItem>
                                    {userPermissions.canAssignTasks && <DropdownMenuItem>Chỉnh sửa</DropdownMenuItem>}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              {/* Assignee */}
                              <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs">
                                    {task.responsible_user?.full_name?.charAt(0) || "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-muted-foreground">
                                  {task.responsible_user?.full_name || "Chưa gán"}
                                </span>
                              </div>

                              {/* Duration */}
                              {task.duration_days && (
                                <div className="text-xs text-muted-foreground">
                                  Thời gian: {task.duration_days} ngày
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={fetchTasks}
          userPermissions={userPermissions}
        />
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <CreateTaskModal
          projectId={projectId}
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchTasks}
        />
      )}

      <AutoAssignRaciModal
        open={showAutoAssignModal}
        onClose={() => setShowAutoAssignModal(false)}
        projectId={projectId}
        tasks={tasks as any}
        onSuccess={fetchTasks}
      />

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận gỡ phân công</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này sẽ gỡ toàn bộ phân công R/A/C/I của tất cả công việc trong dự án. Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={clearAssignments}>Tiếp tục</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
