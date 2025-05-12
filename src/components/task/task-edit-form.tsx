"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { isAfter, parseISO } from "date-fns"
import { toast } from "sonner"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircleIcon, ArrowLeftIcon } from "lucide-react"
import { Form } from "@/components/ui/form"

import { TaskDetailsTab } from "./edit/task-detail-tabs" 
import { TaskAssignmentsTab } from "./task-edit-tabs/task-assignments-tab"
import type {
  Task,
  TaskStatus,
  User,
  ProjectPhase,
  Skill,
  RaciRole,
  TaskProgress,
  TaskHistory,
  Worklog,
} from "@/app/types/table-types"
import { TaskHistoryTab } from "./edit/task-history.tab"

const taskFormSchema = z.object({
  name: z.string().min(3, { message: "Tên công việc phải có ít nhất 3 ký tự" }),
  note: z.string().optional(),
  status: z.string(),
  start_date: z.string().min(1, { message: "Vui lòng chọn ngày bắt đầu" }),
  end_date: z.string().min(1, { message: "Vui lòng chọn ngày kết thúc" }),
  phase_id: z.string().min(1, { message: "Vui lòng chọn giai đoạn" }),
  assigned_to: z.string().optional(),
  unit_in_charge: z.string().optional(),
})

export type TaskFormValues = z.infer<typeof taskFormSchema>

interface TaskEditFormProps {
  initialData: Task
  projectId: string
}

export function TaskEditForm({ initialData, projectId }: TaskEditFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [phases, setPhases] = useState<ProjectPhase[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [selectedSkills, setSelectedSkills] = useState<number[]>([])
  const [taskSkills, setTaskSkills] = useState<number[]>([])
  const [availableTasks, setAvailableTasks] = useState<Task[]>([])
  const [raciUsers, setRaciUsers] = useState<{ id: number; user_id: string; role: RaciRole }[]>([])
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null)
  const [taskHistory, setTaskHistory] = useState<TaskHistory[]>([])
  const [worklogs, setWorklogs] = useState<Worklog[]>([])
  const [isOverdue, setIsOverdue] = useState(false)
  const [activeTab, setActiveTab] = useState("details")

  // Form setup
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      name: initialData.name,
      note: initialData.note || "",
      status: initialData.status,
      start_date: initialData.start_date ? format(new Date(initialData.start_date), "yyyy-MM-dd'T'HH:mm") : "",
      end_date: initialData.end_date ? format(new Date(initialData.end_date), "yyyy-MM-dd'T'HH:mm") : "",
      phase_id: initialData.phase_id,
      assigned_to: initialData.assigned_to || "",
      unit_in_charge: initialData.unit_in_charge || "",
    },
  })

  // Load data
  useEffect(() => {
    loadUsers()
    loadPhases()
    loadSkills()
    loadTaskSkills()
    loadAvailableTasks()
    loadRaciUsers()
    loadTaskProgress()
    loadTaskHistory()
    loadWorklogs()
    checkIfOverdue()
  }, [initialData.id])

  // Check if task is overdue
  const checkIfOverdue = () => {
    const endDate = parseISO(initialData.end_date)
    const now = new Date()
    const isTaskOverdue = isAfter(now, endDate) && initialData.status !== "done" && initialData.status !== "archived"

    setIsOverdue(isTaskOverdue)
  }

  // Load users
  async function loadUsers() {
    try {
      const res = await fetch("/api/users")
      if (!res.ok) throw new Error("Failed to load users")
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err) {
      toast.error("Lỗi", { description: "Không thể tải danh sách người dùng" })
    }
  }

  // Load phases
  async function loadPhases() {
    try {
      const res = await fetch(`/api/projects/${projectId}/phases`)
      if (!res.ok) throw new Error("Failed to load phases")
      const data = await res.json()
      setPhases(data.phases || [])
    } catch (err) {
      toast.error("Lỗi", { description: "Không thể tải danh sách giai đoạn" })
    }
  }

  // Load skills
  async function loadSkills() {
    try {
      const res = await fetch("/api/skills")
      if (!res.ok) throw new Error("Failed to load skills")
      const data = await res.json()
      setSkills(data.skills || [])
    } catch (err) {
      toast.error("Lỗi", { description: "Không thể tải danh sách kỹ năng" })
    }
  }

  // Load task skills
  async function loadTaskSkills() {
    try {
      const res = await fetch(`/api/tasks/${initialData.id}/skills`)
      if (!res.ok) throw new Error("Failed to load task skills")
      const data = await res.json()
      setTaskSkills(data.skills?.map((s: any) => s.skill_id) || [])
      setSelectedSkills(data.skills?.map((s: any) => s.skill_id) || [])
    } catch (err) {
      toast.error("Lỗi", { description: "Không thể tải danh sách kỹ năng công việc" })
    }
  }


  // Load available tasks
  async function loadAvailableTasks() {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`)
      if (!res.ok) throw new Error("Failed to load tasks")
      const data = await res.json()
      // Filter out the current task and tasks that are already dependencies
      setAvailableTasks((data.tasks || []).filter((task: Task) => task.id !== initialData.id))
    } catch (err) {
      toast.error("Lỗi", { description: "Không thể tải danh sách công việc" })
    }
  }

  // Load RACI users
  async function loadRaciUsers() {
    try {
      const res = await fetch(`/api/tasks/${initialData.id}/raci`)
      if (!res.ok) throw new Error("Failed to load RACI")
      const data = await res.json()
      setRaciUsers(data.raci || [])
      
      // If there's a Responsible (R) user, set them as assigned_to
      const responsibleUser = data.raci?.find((r: any) => r.role === "R")
      if (responsibleUser) {
        form.setValue("assigned_to", responsibleUser.user_id)
      }
    } catch (err) {
      console.error("Error loading RACI:", err)
      toast.error("Lỗi", { description: "Không thể tải danh sách RACI" })
    }
  }

  // Load task progress
  async function loadTaskProgress() {
    try {
      const res = await fetch(`/api/tasks/${initialData.id}/progress`)
      if (!res.ok) throw new Error("Failed to load task progress")
      const data = await res.json()
      setTaskProgress(data.progress || null)
    } catch (err) {
      toast.error("Lỗi", { description: "Không thể tải tiến độ công việc" })
    }
  }


  // Load task history
  async function loadTaskHistory() {
    try {
      const res = await fetch(`/api/tasks/${initialData.id}/history`)
      if (!res.ok) throw new Error("Failed to load task history")
      const data = await res.json()
      setTaskHistory(data.history || [])
    } catch (err) {
      toast.error("Lỗi", { description: "Không thể tải lịch sử công việc" })
    }
  }

  // Load worklogs
  async function loadWorklogs() {
    try {
      const res = await fetch(`/api/tasks/${initialData.id}/worklogs`)
      if (!res.ok) throw new Error("Failed to load worklogs")
      const data = await res.json()
      setWorklogs(data.worklogs || [])
    } catch (err) {
      toast.error("Lỗi", { description: "Không thể tải nhật ký công việc" })
    }
  }

  // Handle skill selection
  const handleSkillChange = (skillId: number) => {
    setSelectedSkills((prev) => {
      if (prev.includes(skillId)) {
        return prev.filter((id) => id !== skillId)
      }
      return [...prev, skillId]
    })
  }

  // Handle RACI role assignment
  const handleRaciChange = (userId: string, role: RaciRole) => {
    setRaciUsers((prev) => {
      const existingIndex = prev.findIndex((item) => item.user_id === userId)

      if (existingIndex >= 0) {
        // If user already has this role, remove it
        if (prev[existingIndex].role === role) {
          return prev.filter((_, index) => index !== existingIndex)
        }

        // Otherwise update the role
        const updated = [...prev]
        updated[existingIndex] = { ...updated[existingIndex], role }
        return updated
      }

      // Add new RACI assignment
      return [...prev, { id: Date.now(), user_id: userId, role }]
    })

    // If role is R, update assigned_to
    if (role === "R") {
      form.setValue("assigned_to", userId)
    }
  }

  // Handle status change
  const handleStatusChange = async (newStatus: TaskStatus) => {
    try {
      // Only update form value, don't call API yet
      form.setValue("status", newStatus)
    } catch (err) {
      toast.error("Lỗi", { description: "Không thể cập nhật trạng thái" })
    }
  }

  // Update task progress when marked as done
  async function updateTaskProgress(newStatus: TaskStatus) {
    try {
      const now = new Date().toISOString()
      const endDate = new Date(initialData.end_date)
      const isOverdue = new Date() > endDate

      // Create or update task_progress
      const progressData = {
        task_id: initialData.id,
        actual_finish: newStatus === "done" ? now : null,
        actual_start: taskProgress?.actual_start || initialData.start_date,
        status_snapshot: isOverdue ? "late" : "on_time",
        snapshot_at: now,
      }

      await fetch(`/api/tasks/${initialData.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(progressData),
      })

      // Calculate actual hours
      const actualEnd = new Date()
      const actualStart = taskProgress?.actual_start
        ? new Date(taskProgress.actual_start)
        : new Date(initialData.start_date.split('T')[0]) // Only take date part

      // If actual end time is before start time, set spent hours to 0
      const spentHours = actualEnd.getTime() < actualStart.getTime() 
        ? 0 
        : (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60)

      // Create worklog entry
      if (newStatus === "done" && initialData.assigned_to) {
        const worklogData = {
          task_id: initialData.id,
          user_id: initialData.assigned_to,
          spent_hours: spentHours,
          log_date: format(actualEnd, "yyyy-MM-dd"),
          note: "Tự động tạo khi hoàn thành công việc",
          is_system: true,
        }

        await fetch(`/api/tasks/${initialData.id}/worklogs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(worklogData),
        })
      }
    } catch (err) {
      console.error("Error updating task progress:", err)
    }
  }

  // Record overdue status in task_history
  async function recordOverdueStatus() {
    try {
      const historyData = {
        task_id: initialData.id,
        action: "overdue_detected",
        from_val: initialData.status,
        to_val: form.getValues().status,
      }

      await fetch(`/api/tasks/${initialData.id}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(historyData),
      })
    } catch (err) {
      console.error("Error recording overdue status:", err)
    }
  }

  // Form submission
  async function onSubmit(values: TaskFormValues) {
    try {
      setIsSubmitting(true)

      // Update task
      const response = await fetch(`/api/projects/${projectId}/tasks/${initialData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Có lỗi xảy ra")
      }

      // Update skills
      await updateTaskSkills()

      // Update dependencies

      // Update RACI
      await updateTaskRaci()

      // Record task history
      await recordTaskHistory(values)

      toast.success("Cập nhật công việc thành công")
      router.push(`/dashboard/tasks/${initialData.id}`)
      router.refresh()
    } catch (error) {
      console.error("Lỗi:", error)
      toast.error("Lỗi", {
        description: error instanceof Error ? error.message : "Có lỗi xảy ra",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Update task skills
  async function updateTaskSkills() {
    try {
      // First, delete all existing skills
      await fetch(`/api/tasks/${initialData.id}/skills`, {
        method: "DELETE",
      })

      // Then add selected skills
      if (selectedSkills.length > 0) {
        await fetch(`/api/tasks/${initialData.id}/skills`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skill_ids: selectedSkills }),
        })
      }
    } catch (err) {
      console.error("Error updating task skills:", err)
    }
  }

 

  // Update task RACI
  async function updateTaskRaci() {
    try {
      // First, delete all existing RACI
      await fetch(`/api/tasks/${initialData.id}/raci`, {
        method: "DELETE",
      })

      // Then add current RACI
      if (raciUsers.length > 0) {
        const raciPromises = raciUsers.map((raci) =>
          fetch(`/api/tasks/${initialData.id}/raci`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: raci.user_id, role: raci.role }),
          }),
        )

        await Promise.all(raciPromises)
      }
    } catch (err) {
      console.error("Error updating task RACI:", err)
    }
  }

  // Record task history
  async function recordTaskHistory(values: TaskFormValues) {
    try {
      // Record changes in status
      if (values.status !== initialData.status) {
        await fetch(`/api/tasks/${initialData.id}/history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_id: initialData.id,
            action: "status_changed",
            from_val: initialData.status,
            to_val: values.status,
          }),
        })
      }

      // Record changes in assigned user
      if (values.assigned_to !== initialData.assigned_to) {
        await fetch(`/api/tasks/${initialData.id}/history`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_id: initialData.id,
            action: "assignment_changed",
            from_val: initialData.assigned_to || "none",
            to_val: values.assigned_to || "none",
          }),
        })
      }
    } catch (err) {
      console.error("Error recording task history:", err)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()} className="gap-2">
          <ArrowLeftIcon className="h-4 w-4" />
          Quay lại
        </Button>

        <div className="flex items-center gap-2">
          {isOverdue && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircleIcon className="h-3 w-3" />
              Quá hạn
            </Badge>
          )}

          <Select value={form.getValues().status} onValueChange={(value) => handleStatusChange(value as TaskStatus)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">Chưa bắt đầu</SelectItem>
              <SelectItem value="in_progress">Đang thực hiện</SelectItem>
              <SelectItem value="done">Hoàn thành</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full md:w-auto">
          <TabsTrigger value="details">Chi tiết</TabsTrigger>
          <TabsTrigger value="assignments">Phân công</TabsTrigger>
          <TabsTrigger value="history">Lịch sử</TabsTrigger>
        </TabsList>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <TabsContent value="details">
              <TaskDetailsTab
                form={form}
                phases={phases}
                users={users}
                skills={skills}
                selectedSkills={selectedSkills}
                onSkillChange={handleSkillChange}
              />
            </TabsContent>

           

            <TabsContent value="assignments">
              <TaskAssignmentsTab users={users} raciUsers={raciUsers} onRaciChange={handleRaciChange} />
            </TabsContent>

            <TabsContent value="history">
              <TaskHistoryTab taskHistory={taskHistory} taskProgress={taskProgress} />
            </TabsContent>

          

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Hủy
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </div>
          </form>
        </Form>
      </Tabs>
    </div>
  )
}
