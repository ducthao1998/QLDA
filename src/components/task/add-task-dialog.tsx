"use client"
import { useEffect, useState } from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "../ui/button"
import { PlusIcon } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Label } from "../ui/label"
import { Textarea } from "../ui/textarea"
import { Input } from "../ui/input"
import type { Task, TaskStatus, User } from "@/app/types/table-types"
import { calculateTaskDependencies } from "@/algorithm/task-dependencies"

export function AddTaskDialog({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([])
  const [newTask, setNewTask] = useState<Partial<Task>>({
    project_id: projectId,
    name: "",
    description: "",
    status: "todo",
    due_date: format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd"),
    priority: 3,
    assigned_to: null,
    estimate_low: 1,
    estimate_high: 2,
    risk_level: 1,
    complexity: 1,
    weight: 0.5,
    max_rejections: 3,
    current_rej: 0
  })

  // 1) Fetch list of users to assign
  useEffect(() => {
    if (isOpen) {
      fetch("/api/user")
        .then((res) => res.json())
        .then((data) => setUsers(data.users))
        .catch(() => toast.error("Không tải được danh sách người dùng"))
    }
  }, [isOpen])

  // Fetch tasks for dependencies selection
  useEffect(() => {
    if (isOpen) {
      fetch(`/api/projects/${projectId}/tasks`)
        .then((res) => res.json())
        .then((data) => setTasks(data.tasks || []))
        .catch(() => toast.error("Không tải được danh sách công việc"))
    }
  }, [isOpen, projectId])

  // 2) Reset form khi đóng
  function reset() {
    setNewTask({
      project_id: projectId,
      name: "",
      description: "",
      status: "todo",
      due_date: format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd"),
      priority: 3,
      assigned_to: null,
      estimate_low: 1,
      estimate_high: 2,
      risk_level: 1,
      complexity: 1,
      weight: 0.5,
      max_rejections: 3,
      current_rej: 0
    })
  }

  async function handleSubmit() {
    try {
      setIsSubmitting(true)

      // Validate required fields
      if (!newTask.name || !newTask.description || !newTask.status || !newTask.due_date) {
        toast.error("Vui lòng điền đầy đủ thông tin bắt buộc")
        return
      }

      // Calculate task dependencies
      const dependencies = selectedDependencies.map(depId => ({
        task_id: newTask.id,
        depends_on_id: depId
      }))

      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newTask,
          dependencies
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Có lỗi xảy ra")
      }

      toast.success("Tạo công việc thành công")
      setIsOpen(false)
      reset()
      onCreated()
    } catch (error) {
      console.error("Lỗi:", error)
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon className="mr-2 h-4 w-4" />
          Thêm công việc
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Thêm công việc mới</DialogTitle>
          <DialogDescription>
            Thêm một công việc mới vào dự án. Các trường có dấu <span className="text-red-500">*</span> là bắt buộc.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name" className="flex items-center gap-1">
              Tên công việc <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={newTask.name}
              onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
              placeholder="Nhập tên công việc"
            />
            <p className="text-sm text-muted-foreground">Tên công việc phải ngắn gọn và mô tả rõ ràng</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description" className="flex items-center gap-1">
              Mô tả <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              value={newTask.description || ""}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              placeholder="Nhập mô tả chi tiết công việc"
            />
            <p className="text-sm text-muted-foreground">Mô tả chi tiết về công việc cần thực hiện</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="status" className="flex items-center gap-1">
                Trạng thái <span className="text-red-500">*</span>
              </Label>
              <Select
                value={newTask.status}
                onValueChange={(value) => setNewTask({ ...newTask, status: value as Task["status"] })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Chưa bắt đầu</SelectItem>
                  <SelectItem value="in_progress">Đang thực hiện</SelectItem>
                  <SelectItem value="done">Hoàn thành</SelectItem>
                  <SelectItem value="cancelled">Đã hủy</SelectItem>
                  <SelectItem value="archived">Lưu trữ</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">Trạng thái hiện tại của công việc</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="due_date" className="flex items-center gap-1">
                Hạn hoàn thành <span className="text-red-500">*</span>
              </Label>
              <Input
                id="due_date"
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">Ngày dự kiến hoàn thành công việc</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="priority" className="flex items-center gap-1">
                Mức ưu tiên <span className="text-red-500">*</span>
              </Label>
              <Select
                value={newTask.priority?.toString()}
                onValueChange={(value) => setNewTask({ ...newTask, priority: Number.parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn mức ưu tiên" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Cao nhất</SelectItem>
                  <SelectItem value="2">2 - Cao</SelectItem>
                  <SelectItem value="3">3 - Trung bình</SelectItem>
                  <SelectItem value="4">4 - Thấp</SelectItem>
                  <SelectItem value="5">5 - Thấp nhất</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">Mức độ ưu tiên của công việc (1 là cao nhất)</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="assigned_to">Người thực hiện</Label>
              <Select
                value={newTask.assigned_to || "unassigned"}
                onValueChange={(value) => setNewTask({ ...newTask, assigned_to: value === "unassigned" ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn người thực hiện" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Chưa giao</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">Người được giao thực hiện công việc</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="estimate_low">Ước tính tối thiểu (giờ)</Label>
              <Input
                id="estimate_low"
                type="number"
                min="1"
                value={newTask.estimate_low}
                onChange={(e) => setNewTask({ ...newTask, estimate_low: Number.parseInt(e.target.value) })}
              />
              <p className="text-sm text-muted-foreground">Số giờ tối thiểu cần để hoàn thành công việc</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="estimate_high">Ước tính tối đa (giờ)</Label>
              <Input
                id="estimate_high"
                type="number"
                min="1"
                value={newTask.estimate_high}
                onChange={(e) => setNewTask({ ...newTask, estimate_high: Number.parseInt(e.target.value) })}
              />
              <p className="text-sm text-muted-foreground">Số giờ tối đa cần để hoàn thành công việc</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="risk_level">Mức độ rủi ro (1-5)</Label>
              <Select
                value={newTask.risk_level?.toString()}
                onValueChange={(value) => setNewTask({ ...newTask, risk_level: Number.parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn mức độ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Thấp nhất</SelectItem>
                  <SelectItem value="2">2 - Thấp</SelectItem>
                  <SelectItem value="3">3 - Trung bình</SelectItem>
                  <SelectItem value="4">4 - Cao</SelectItem>
                  <SelectItem value="5">5 - Cao nhất</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">Mức độ rủi ro của công việc (1 là thấp nhất)</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="complexity">Độ phức tạp (1-5)</Label>
              <Select
                value={newTask.complexity?.toString()}
                onValueChange={(value) => setNewTask({ ...newTask, complexity: Number.parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn mức độ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Đơn giản</SelectItem>
                  <SelectItem value="2">2 - Dễ</SelectItem>
                  <SelectItem value="3">3 - Trung bình</SelectItem>
                  <SelectItem value="4">4 - Phức tạp</SelectItem>
                  <SelectItem value="5">5 - Rất phức tạp</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">Độ phức tạp của công việc (1 là đơn giản nhất)</p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dependencies">Công việc phụ thuộc</Label>
            <Select
              value={selectedDependencies}
              onValueChange={(value) => setSelectedDependencies(value)}
              multiple
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn công việc phụ thuộc" />
              </SelectTrigger>
              <SelectContent>
                {tasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Chọn các công việc cần hoàn thành trước khi bắt đầu công việc này
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Đang tạo..." : "Tạo công việc"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
