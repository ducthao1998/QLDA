"use client"

import { useState, useEffect, useMemo } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  MoreHorizontalIcon,
  Trash2Icon,
  PencilIcon,
  EyeIcon,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import type { Task as BaseTask } from "@/app/types/table-types"
import { AddTaskDialog } from "./add-task-dialog"
import { format, isValid, parseISO } from "date-fns"
import { vi } from "date-fns/locale"

type Task = BaseTask & {
  responsible_user?: {
    full_name: string | null
    position?: string
    org_unit?: string
  } | null
}

interface Project {
  id: string
  name: string
}

interface TasksListProps {
  projectId?: string
  tasks?: Task[]
  onTaskUpdate?: () => void
}

type SortField = "name" | "status" | "start_date" | "end_date" | "assignee"
type SortDirection = "asc" | "desc"

const statusColors: Record<
  string,
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string; color: string }
> = {
  todo: { variant: "secondary", label: "Chưa bắt đầu", color: "bg-gray-100 text-gray-800" },
  in_progress: { variant: "default", label: "Đang thực hiện", color: "bg-blue-100 text-blue-800" },
  review: { variant: "secondary", label: "Đang xem xét", color: "bg-yellow-100 text-yellow-800" },
  blocked: { variant: "destructive", label: "Bị chặn", color: "bg-red-100 text-red-800" },
  archived: { variant: "outline", label: "Lưu trữ", color: "bg-gray-100 text-gray-600" },
  done: { variant: "outline", label: "Hoàn thành", color: "bg-green-100 text-green-800" },
}

const ITEMS_PER_PAGE = 10

export function OptimizedTasksList({ projectId, tasks: initialTasks, onTaskUpdate }: TasksListProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks || [])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>(projectId || "")
  const [isLoading, setIsLoading] = useState(!initialTasks)
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const [isConfirmingBulkDelete, setIsConfirmingBulkDelete] = useState(false)

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showIncomplete, setShowIncomplete] = useState(false)
  const [showUnassigned, setShowUnassigned] = useState(false)

  // Sorting states
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)

  const isProjectSpecificView = !!projectId

  useEffect(() => {
    if (!isProjectSpecificView) {
      loadProjects()
    }
  }, [isProjectSpecificView])

  useEffect(() => {
    if (selectedProject && !isProjectSpecificView) {
      loadTasksAndPhases(selectedProject)
    }
  }, [selectedProject, isProjectSpecificView])

  useEffect(() => {
    if (initialTasks && projectId) {
      processInitialTasks(initialTasks, projectId)
    }
  }, [initialTasks, projectId])

  async function loadProjects() {
    try {
      const res = await fetch("/api/projects")
      if (!res.ok) throw new Error("Failed to load projects")
      const data = await res.json()
      setProjects(data.data || [])
      if (data.data?.length > 0 && !selectedProject) {
        setSelectedProject(data.data[0].id)
      }
    } catch (err) {
      toast.error("Lỗi tải danh sách dự án")
    }
  }


  async function processInitialTasks(tasks: Task[], projectIdToLoad: string) {
    setIsLoading(true)
    try {
      // Process tasks with RACI data
      const tasksWithAssignees = await Promise.all(
        tasks.map(async (task: any) => {
          try {
            const raciRes = await fetch(`/api/tasks/${task.id}/raci`)
            if (raciRes.ok) {
              const raciData = await raciRes.json()
              const responsibleUser = raciData.raci?.find((r: any) => r.role === "R")

              return {
                ...task,
                responsible_user: responsibleUser?.users || null,
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

      setTasks(tasksWithAssignees)
    } catch (err) {
      toast.error("Lỗi xử lý dữ liệu công việc")
    } finally {
      setIsLoading(false)
    }
  }

  async function loadTasksAndPhases(projectIdToLoad: string) {
    setIsLoading(true)
    try {
      // Fetch tasks
      const tasksRes = await fetch(`/api/projects/${projectIdToLoad}/tasks`)

      if (!tasksRes.ok) {
        throw new Error("Failed to load data")
      }

      const tasksData = await tasksRes.json()

      // Fetch RACI data for each task to get responsible users
      const tasksWithAssignees = await Promise.all(
        (tasksData.data || []).map(async (task: any) => {
          try {
            const raciRes = await fetch(`/api/tasks/${task.id}/raci`)
            if (raciRes.ok) {
              const raciData = await raciRes.json()
              const responsibleUser = raciData.raci?.find((r: any) => r.role === "R")

              return {
                ...task,
                responsible_user: responsibleUser?.users || null,
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

      setTasks(tasksWithAssignees)
    } catch (err) {
      toast.error("Lỗi tải danh sách công việc")
    } finally {
      setIsLoading(false)
    }
  }

  const handleTaskUpdate = () => {
    if (onTaskUpdate) {
      onTaskUpdate()
    } else if (selectedProject) {
      loadTasksAndPhases(selectedProject)
    }
  }

  // Helper functions
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    try {
      const date = parseISO(dateString)
      return isValid(date) ? format(date, "dd/MM/yyyy", { locale: vi }) : null
    } catch {
      return null
    }
  }

  // const isTaskIncomplete = (task: Task) => {
  //   return !task.start_date || !task.end_date
  // }

  // const isTaskOverdue = (task: Task) => {
  //   if (!task.end_date || task.status === "done") return false
  //   return new Date(task.end_date) < new Date()
  // }

  const isTaskUnassigned = (task: Task) => {
    return !task.responsible_user?.full_name
  }


  // Filtered and sorted tasks
  const filteredAndSortedTasks = useMemo(() => {
    const filtered = tasks.filter((task) => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        if (
          !task.name.toLowerCase().includes(searchLower) &&
          !task.responsible_user?.full_name?.toLowerCase().includes(searchLower)
        ) {
          return false
        }
      }

      // Status filter
      if (statusFilter !== "all" && task.status !== statusFilter) {
        return false
      }


      // Incomplete filter
      // if (showIncomplete && !isTaskIncomplete(task)) {
      //   return false
      // }

      // Unassigned filter
      if (showUnassigned && !isTaskUnassigned(task)) {
        return false
      }

      return true
    })

    // Sort tasks
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case "name":
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case "status":
          aValue = a.status
          bValue = b.status
          break
        // case "start_date":
        //   aValue = a.start_date ? new Date(a.start_date) : new Date(0)
        //   bValue = b.start_date ? new Date(b.start_date) : new Date(0)
        //   break
        // case "end_date":
        //   aValue = a.end_date ? new Date(a.end_date) : new Date(0)
        //   bValue = b.end_date ? new Date(b.end_date) : new Date(0)
        //   break
        case "assignee":
          aValue = a.responsible_user?.full_name?.toLowerCase() || "zzz"
          bValue = b.responsible_user?.full_name?.toLowerCase() || "zzz"
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
    })

    return filtered
  }, [tasks, searchTerm, statusFilter, showIncomplete, showUnassigned, sortField, sortDirection])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedTasks.length / ITEMS_PER_PAGE)
  const paginatedTasks = filteredAndSortedTasks.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />
    return sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  async function deleteTask() {
    if (!taskToDelete) return
    const projectCtx = projectId || selectedProject
    try {
      const res = await fetch(`/api/projects/${projectCtx}/tasks/${taskToDelete}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete task")
      toast.success("Xóa công việc thành công")
      handleTaskUpdate()
    } catch (err) {
      toast.error("Không thể xóa công việc")
    } finally {
      setIsConfirmingDelete(false)
      setTaskToDelete(null)
    }
  }

  async function bulkDeleteTasks() {
    const projectCtx = projectId || selectedProject
    const promises = selectedTasks.map((taskId) =>
      fetch(`/api/projects/${projectCtx}/tasks/${taskId}`, { method: "DELETE" }),
    )
    const results = await Promise.allSettled(promises)
    const successCount = results.filter((r) => r.status === "fulfilled" && r.value.ok).length

    if (successCount > 0) {
      toast.success(`Đã xóa thành công ${successCount} công việc.`)
      handleTaskUpdate()
    }

    if (successCount < selectedTasks.length) {
      toast.error(`Không thể xóa ${selectedTasks.length - successCount} công việc.`)
    }
    setSelectedTasks([])
    setIsConfirmingBulkDelete(false)
  }

  function toggleSelectAll() {
    setSelectedTasks(
      selectedTasks.length === paginatedTasks.length ? [] : paginatedTasks.map((task) => String(task.id)),
    )
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTasks((prev) => (prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]))
  }

  if (isLoading && !isProjectSpecificView) {
    return <div>Đang tải công việc...</div>
  }

  return (
    <div className="space-y-4">
      {/* Header with Project Selector and Add Task button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isProjectSpecificView && (
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
          )}
          {selectedTasks.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setIsConfirmingBulkDelete(true)} className="ml-2">
              <Trash2Icon className="h-4 w-4 mr-2" />
              Xóa ({selectedTasks.length})
            </Button>
          )}
        </div>
        <AddTaskDialog projectId={projectId || selectedProject} onCreated={handleTaskUpdate} />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm công việc hoặc người thực hiện..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              {Object.entries(statusColors).map(([key, value]) => (
                <SelectItem key={key} value={key}>
                  {value.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>


          <Button
            variant={showIncomplete ? "default" : "outline"}
            size="sm"
            onClick={() => setShowIncomplete(!showIncomplete)}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Chưa hoàn thiện
          </Button>

          <Button
            variant={showUnassigned ? "default" : "outline"}
            size="sm"
            onClick={() => setShowUnassigned(!showUnassigned)}
          >
            <Users className="h-4 w-4 mr-2" />
            Chưa gán người
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="font-medium text-blue-900">Tổng công việc</div>
          <div className="text-2xl font-bold text-blue-600">{filteredAndSortedTasks.length}</div>
        </div>
        {/* <div className="bg-yellow-50 p-3 rounded-lg">
          <div className="font-medium text-yellow-900">Chưa hoàn thiện</div>
          <div className="text-2xl font-bold text-yellow-600">
            {filteredAndSortedTasks.filter(isTaskIncomplete).length}
          </div>
        </div> */}
        <div className="bg-red-50 p-3 rounded-lg">
          <div className="font-medium text-red-900">Chưa gán người</div>
          <div className="text-2xl font-bold text-red-600">
            {filteredAndSortedTasks.filter(isTaskUnassigned).length}
          </div>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="font-medium text-green-900">Hoàn thành</div>
          <div className="text-2xl font-bold text-green-600">
            {filteredAndSortedTasks.filter((task) => task.status === "done").length}
          </div>
        </div>
      </div>

      {/* Task Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <input
                  type="checkbox"
                  checked={paginatedTasks.length > 0 && selectedTasks.length === paginatedTasks.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("name")}
                  className="h-auto p-0 font-semibold"
                >
                  Tên công việc
                  {getSortIcon("name")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("assignee")}
                  className="h-auto p-0 font-semibold"
                >
                  Người thực hiện
                  {getSortIcon("assignee")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("status")}
                  className="h-auto p-0 font-semibold"
                >
                  Trạng thái
                  {getSortIcon("status")}
                </Button>
              </TableHead>
              {/* <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("start_date")}
                  className="h-auto p-0 font-semibold"
                >
                  Ngày bắt đầu
                  {getSortIcon("start_date")}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("end_date")}
                  className="h-auto p-0 font-semibold"
                >
                  Ngày kết thúc
                  {getSortIcon("end_date")}
                </Button>
              </TableHead> */}
              <TableHead className="w-[80px]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedTasks.map((task) => {
              // const incomplete = isTaskIncomplete(task)
              // const overdue = isTaskOverdue(task)
              const unassigned = isTaskUnassigned(task)

              return (
                <TableRow
                  key={task.id}
                  className={`
                    ${selectedTasks.includes(String(task.id)) ? "bg-muted/50" : ""}
                
                    ${unassigned ? "bg-orange-50 border-l-4 border-l-orange-400" : ""}
                  `}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedTasks.includes(String(task.id))}
                      onChange={() => toggleTaskSelection(String(task.id))}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {task.name}
                      {/* {incomplete && (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      )}
                      {overdue && <Calendar className="h-4 w-4 text-red-600" />} */}
                      {unassigned && <Users className="h-4 w-4 text-orange-600" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback>{task.responsible_user?.full_name?.charAt(0) || "?"}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs">
                        {task.responsible_user?.full_name || <span className="text-red-600 font-medium">Chưa gán</span>}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[task.status]?.color || "bg-gray-100 text-gray-800"}>
                      {statusColors[task.status]?.label || task.status}
                    </Badge>
                  </TableCell>
                  {/* <TableCell>
                    {formatDate(task.start_date) || <span className="text-red-600 text-sm font-medium">Chưa có</span>}
                  </TableCell>
                  <TableCell>
                    {formatDate(task.end_date) || <span className="text-red-600 text-sm font-medium">Chưa có</span>}
                  </TableCell> */}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
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
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/tasks/${task.id}/edit`}>
                            <PencilIcon className="mr-2 h-4 w-4" />
                            Chỉnh sửa
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => {
                            setTaskToDelete(String(task.id))
                            setIsConfirmingDelete(true)
                          }}
                        >
                          <Trash2Icon className="mr-2 h-4 w-4" />
                          Xóa
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Hiển thị {(currentPage - 1) * ITEMS_PER_PAGE + 1} đến{" "}
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedTasks.length)} trong tổng số{" "}
            {filteredAndSortedTasks.length} công việc
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Trước
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                .map((page, index, array) => (
                  <div key={page} className="flex items-center">
                    {index > 0 && array[index - 1] !== page - 1 && (
                      <span className="px-2 text-muted-foreground">...</span>
                    )}
                    <Button
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  </div>
                ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Sau
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialogs */}
      <AlertDialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể được hoàn tác. Công việc này sẽ bị xóa vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTask}>Tiếp tục</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isConfirmingBulkDelete} onOpenChange={setIsConfirmingBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa hàng loạt</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa {selectedTasks.length} công việc đã chọn? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={bulkDeleteTasks}>Xóa tất cả</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
