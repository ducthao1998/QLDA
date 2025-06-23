'use client'

import { useState, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MoreHorizontalIcon,
  Trash2Icon,
  PencilIcon,
  EyeIcon,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'
import { Task as BaseTask } from '@/app/types/table-types' // Đổi tên kiểu Task gốc
import { AddTaskDialog } from './add-task-dialog'

// SỬA LỖI: Mở rộng kiểu Task gốc để bao gồm dữ liệu 'users' được join từ API.
// Điều này giải quyết lỗi TypeScript "Property 'users' does not exist on type 'Task'".
type Task = BaseTask & {
  users?: {
    full_name: string | null
  } | null
}

interface Project {
  id: string
  name: string
}

// Props interface mới, cho phép nhận projectId từ bên ngoài
interface TasksListProps {
  projectId?: string
  tasks?: Task[] // Sử dụng kiểu Task đã được mở rộng
  onTaskUpdate?: () => void // Callback để thông báo cho component cha khi có thay đổi
}

const statusColors: Record<
  string,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }
> = {
  todo: { variant: 'secondary', label: 'Chưa bắt đầu' },
  in_progress: { variant: 'default', label: 'Đang thực hiện' },
  review: { variant: 'secondary', label: 'Đang xem xét' },
  completed: { variant: 'outline', label: 'Hoàn thành' },
  blocked: { variant: 'destructive', label: 'Bị chặn' },
  archived: { variant: 'outline', label: 'Lưu trữ' },
  done: { variant: 'outline', label: 'Hoàn thành' },
}

// Sửa lại component để nhận props
export function TasksList({
  projectId,
  tasks: initialTasks,
  onTaskUpdate,
}: TasksListProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks || [])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>(projectId || '')
  const [isLoading, setIsLoading] = useState(!initialTasks)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const [isConfirmingBulkDelete, setIsConfirmingBulkDelete] = useState(false)

  // Cờ để xác định xem component có đang ở trang chi tiết dự án hay không
  const isProjectSpecificView = !!projectId

  // Tải danh sách dự án nếu không ở trang chi tiết
  useEffect(() => {
    if (!isProjectSpecificView) {
      loadProjects()
    }
  }, [isProjectSpecificView])

  // Tải công việc khi project được chọn (chỉ khi không ở trang chi tiết)
  useEffect(() => {
    if (selectedProject && !isProjectSpecificView) {
      loadTasks(selectedProject)
    }
  }, [selectedProject, isProjectSpecificView])

  // Cập nhật state nếu initialTasks thay đổi
  useEffect(() => {
    if (initialTasks) {
      setTasks(initialTasks)
      setIsLoading(false)
    }
  }, [initialTasks])

  async function loadProjects() {
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('Failed to load projects')
      const data = await res.json()
      setProjects(data.data || [])
      if (data.data?.length > 0 && !selectedProject) {
        setSelectedProject(data.data[0].id)
      }
    } catch (err) {
      toast.error('Lỗi tải danh sách dự án')
    }
  }

  async function loadTasks(projectIdToLoad: string) {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectIdToLoad}/tasks`)
      if (!res.ok) throw new Error('Failed to load tasks')
      const data = await res.json()
      setTasks(data || [])
    } catch (err) {
      toast.error('Lỗi tải danh sách công việc')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTaskUpdate = () => {
    if (onTaskUpdate) {
      onTaskUpdate()
    } else if (selectedProject) {
      loadTasks(selectedProject)
    }
  }

  async function deleteTask() {
    if (!taskToDelete) return
    const projectCtx = projectId || selectedProject
    try {
      const res = await fetch(`/api/projects/${projectCtx}/tasks/${taskToDelete}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete task')
      toast.success('Xóa công việc thành công')
      handleTaskUpdate()
    } catch (err) {
      toast.error('Không thể xóa công việc')
    } finally {
      setIsConfirmingDelete(false)
      setTaskToDelete(null)
    }
  }
  
  async function bulkDeleteTasks() {
    const projectCtx = projectId || selectedProject
    const promises = selectedTasks.map(taskId =>
      fetch(`/api/projects/${projectCtx}/tasks/${taskId}`, { method: 'DELETE' })
    );

    const results = await Promise.allSettled(promises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;

    if (successCount > 0) {
        toast.success(`Đã xóa thành công ${successCount} công việc.`);
        handleTaskUpdate();
    }
    
    if (successCount < selectedTasks.length) {
        toast.error(`Không thể xóa ${selectedTasks.length - successCount} công việc.`);
    }

    setSelectedTasks([]);
    setIsConfirmingBulkDelete(false);
  }


  function toggleSelectAll() {
    setSelectedTasks(
      selectedTasks.length === tasks.length ? [] : tasks.map(task => String(task.id)),
    )
  }

  function toggleTaskSelection(taskId: string) {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId],
    )
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
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {selectedTasks.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsConfirmingBulkDelete(true)}
              className="ml-2"
            >
              <Trash2Icon className="h-4 w-4 mr-2" />
              Xóa ({selectedTasks.length})
            </Button>
          )}
        </div>

        <AddTaskDialog
          projectId={projectId || selectedProject}
          onCreated={handleTaskUpdate}
        />
      </div>

      {/* Task Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <input
                  type="checkbox"
                  checked={tasks.length > 0 && selectedTasks.length === tasks.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </TableHead>
              <TableHead>Tên công việc</TableHead>
              <TableHead>Người thực hiện</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="w-[80px]">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map(task => (
              <TableRow
                key={task.id}
                className={selectedTasks.includes(String(task.id)) ? 'bg-muted/50' : ''}
              >
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes(String(task.id))}
                    onChange={() => toggleTaskSelection(String(task.id))}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </TableCell>
                <TableCell className="font-medium">{task.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>
                        {task.users?.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs">
                      {task.users?.full_name || 'Chưa gán'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={statusColors[task.status]?.variant || 'secondary'}
                  >
                    {statusColors[task.status]?.label || task.status}
                  </Badge>
                </TableCell>
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
                      <DropdownMenuItem
                        onClick={() =>
                          (window.location.href = `/dashboard/tasks/${task.id}/edit`)
                        }
                      >
                        <PencilIcon className="mr-2 h-4 w-4" />
                        Chỉnh sửa
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
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Single Delete Confirmation Dialog */}
      <AlertDialog
        open={isConfirmingDelete}
        onOpenChange={setIsConfirmingDelete}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này không thể được hoàn tác. Công việc này sẽ bị xóa
              vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTask}>Tiếp tục</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
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
                  <AlertDialogAction onClick={bulkDeleteTasks} >Xóa tất cả</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
