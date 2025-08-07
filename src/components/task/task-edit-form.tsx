"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeftIcon, UserCheck, Loader2, AlertTriangle, Info, Link, Users, Target, Bot } from "lucide-react"
import { Form } from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TaskDetailsTab } from "./edit/task-detail-tabs"
import { TaskAssignmentsTab } from "./task-edit-tabs/task-assignments-tab"
import { DependencyTreeVisualization } from "./dependency-tree-visualization"

import type { Task, TaskStatus, User, Skill, RaciRole } from "@/app/types/table-types"

const taskFormSchema = z.object({
  name: z.string().min(3, { message: "Tên công việc phải có ít nhất 3 ký tự" }),
  note: z.string().optional(),
  status: z.string(),
  duration_days: z.number().min(1).optional(),
})

export type TaskFormValues = z.infer<typeof taskFormSchema>

interface TaskEditFormProps {
  initialData: Task
  projectId: string
}

interface UserRecommendation {
  user_id: string
  full_name: string
  completed_tasks_count: number
  workload: number
}

interface DependencyValidationResult {
  isValid: boolean
  circularPath?: string[]
  error?: string
}

export function TaskEditForm({ initialData, projectId }: TaskEditFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [selectedSkills, setSelectedSkills] = useState<number[]>([])
  const [availableTasks, setAvailableTasks] = useState<Task[]>([])
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([])
  const [originalDependencies, setOriginalDependencies] = useState<string[]>([])
  const [projectData, setProjectData] = useState<{ start_date: string; end_date: string } | null>(null)
  const [isAutoAssigning, setIsAutoAssigning] = useState(false)
  const [dependencySearch, setDependencySearch] = useState("")

  // Dependency validation states
  const [dependencyValidation, setDependencyValidation] = useState<DependencyValidationResult>({ isValid: true })
  const [isValidatingDependencies, setIsValidatingDependencies] = useState(false)

  // RACI states
  const [raciAssignments, setRaciAssignments] = useState<{ user_id: string; role: RaciRole }[]>([])
  const [initialRaciAssignments, setInitialRaciAssignments] = useState<{ user_id: string; role: RaciRole }[]>([])
  const [hasRaciChanges, setHasRaciChanges] = useState(false)

  // Form setup
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      name: initialData.name,
      note: initialData.note || "",
      status: initialData.status,
      duration_days: initialData.duration_days || 1,
    },
  })

  // Load data on mount
  useEffect(() => {
    loadUsers()
    loadSkills()
    loadAvailableTasks()
    loadTaskDependencies()
    loadProjectData()
    loadRaciAssignments()
  }, [initialData.id])

  // Validate dependencies when they change
  useEffect(() => {
    if (selectedDependencies.length > 0) {
      validateDependencies()
    } else {
      setDependencyValidation({ isValid: true })
    }
  }, [selectedDependencies, availableTasks])

  // All the load functions (unchanged from previous version)
  async function loadUsers() {
    try {
      const res = await fetch("/api/user")
      if (!res.ok) throw new Error("Failed to load users")
      const data = await res.json()
      setUsers(data.users || [])
    } catch (err) {
      toast.error("Không thể tải danh sách người dùng")
    }
  }

  async function loadSkills() {
    try {
      const res = await fetch("/api/skills")
      if (!res.ok) throw new Error("Failed to load skills")
      const data = await res.json()
      setSkills(data.skills || data.data || [])
      await loadTaskSkills()
    } catch (err) {
      toast.error("Không thể tải danh sách kỹ năng")
    }
  }

  async function loadTaskSkills() {
    try {
      const res = await fetch(`/api/tasks/${initialData.id}/skills`)
      if (res.ok) {
        const data = await res.json()
        const taskSkills = data.skills || data.data || []
        const skillIds = taskSkills.map((skill: any) => skill.skill_id || skill.id)
        setSelectedSkills(skillIds)
      }
    } catch (err) {
      console.error("Error loading task skills:", err)
    }
  }

  async function loadAvailableTasks() {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`)
      if (!res.ok) throw new Error(`Failed to load tasks: ${res.status}`)
      const data = await res.json()
      const tasks = Array.isArray(data) ? data : data.tasks || data.data || []
      const filteredTasks = tasks.filter((task: Task) => task.id !== initialData.id)
      setAvailableTasks(filteredTasks)
    } catch (err) {
      console.error("Error loading available tasks:", err)
      toast.error("Không thể tải danh sách công việc")
      setAvailableTasks([])
    }
  }

  async function loadTaskDependencies() {
    try {
      const res = await fetch(`/api/tasks/${initialData.id}/dependencies`)
      if (res.ok) {
        const data = await res.json()
        const deps = data.dependencies || data.data || []
        const depIds = deps
          .map((dep: any) => {
            const depId = dep.depends_on_id || dep.dependency_task?.id || dep.id
            return String(depId)
          })
          .filter((id: string) => id && id !== 'undefined' && id !== 'null')
        setSelectedDependencies(depIds)
        setOriginalDependencies(depIds)
      } else {
        setSelectedDependencies([])
        setOriginalDependencies([])
      }
    } catch (err) {
      console.error("Error loading dependencies:", err)
      setSelectedDependencies([])
      setOriginalDependencies([])
    }
  }

  async function loadProjectData() {
    try {
      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) throw new Error("Failed to load project")
      const data = await res.json()
      const project = data.project || data.data || data
      setProjectData({
        start_date: project.start_date,
        end_date: project.end_date,
      })
    } catch (err) {
      toast.error("Không thể tải thông tin dự án")
    }
  }


  async function loadRaciAssignments() {
    try {
      const res = await fetch(`/api/tasks/${initialData.id}/raci`)
      if (res.ok) {
        const data = await res.json()
        const assignments = (data.raci || []).map((r: any) => ({
          user_id: r.user_id,
          role: r.role,
        }))
        setRaciAssignments(assignments)
        setInitialRaciAssignments(assignments)
      }
    } catch (err) {
      console.error("Error loading RACI:", err)
    }
  }

  const validateDependencies = async () => {
    if (selectedDependencies.length === 0) {
      setDependencyValidation({ isValid: true })
      return
    }

    setIsValidatingDependencies(true)
    try {
      const response = await fetch(`/api/tasks/${initialData.id}/validate-dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dependencies: selectedDependencies }),
      })

      if (!response.ok) throw new Error("Failed to validate dependencies")
      const result = await response.json()
      setDependencyValidation(result)
    } catch (error) {
      console.error("Error validating dependencies:", error)
      setDependencyValidation({
        isValid: false,
        error: "Không thể kiểm tra phụ thuộc. Vui lòng thử lại.",
      })
    } finally {
      setIsValidatingDependencies(false)
    }
  }

  const handleDependencyToggle = async (taskId: number) => {
    const taskIdStr = taskId.toString()
    let newDependencies: string[]
    if (selectedDependencies.includes(taskIdStr)) {
      newDependencies = selectedDependencies.filter((id) => id !== taskIdStr)
    } else {
      newDependencies = [...selectedDependencies, taskIdStr]
    }

    setSelectedDependencies(newDependencies)

    if (!selectedDependencies.includes(taskIdStr) && newDependencies.length > 0) {
      setIsValidatingDependencies(true)
      try {
        const response = await fetch(`/api/tasks/${initialData.id}/validate-dependencies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependencies: newDependencies }),
        })

        if (!response.ok) throw new Error("Failed to validate dependencies")
        const result = await response.json()

        if (!result.isValid) {
          setSelectedDependencies(selectedDependencies)
          toast.error(result.error || "Phụ thuộc này sẽ tạo ra vòng lặp")
          setDependencyValidation(result)
        } else {
          setDependencyValidation({ isValid: true })
        }
      } catch (error) {
        console.error("Error validating dependency:", error)
        setSelectedDependencies(selectedDependencies)
        toast.error("Không thể kiểm tra phụ thuộc. Vui lòng thử lại.")
      } finally {
        setIsValidatingDependencies(false)
      }
    }
  }

  const handleStatusChange = (newStatus: TaskStatus) => {
    form.setValue("status", newStatus)
    form.trigger("status")
  }

  const handleRaciUpdate = (assignments: { user_id: string; role: RaciRole }[]) => {
    setRaciAssignments(assignments)
    const hasChanges =
      JSON.stringify(assignments.sort((a, b) => a.user_id.localeCompare(b.user_id))) !==
      JSON.stringify(initialRaciAssignments.sort((a, b) => a.user_id.localeCompare(b.user_id)))
    setHasRaciChanges(hasChanges)
  }

  async function onSubmit(values: TaskFormValues) {
    if (!dependencyValidation.isValid) {
      toast.error("Vui lòng sửa các vấn đề về phụ thuộc trước khi lưu")
      return
    }

    try {
      setIsSubmitting(true)

      // Update task basic info
      const response = await fetch(`/api/projects/${projectId}/tasks/${initialData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Có lỗi xảy ra")
      }

      // Update dependencies if changed
      const dependenciesChanged =
        JSON.stringify(selectedDependencies.sort()) !== JSON.stringify(originalDependencies.sort())

      if (dependenciesChanged) {
        await updateTaskDependencies()
      }

      // Update RACI if changed
      if (hasRaciChanges) {
        await updateTaskRaci()
      }

      // Update task skills
      await updateTaskSkills()

      toast.success("Cập nhật công việc thành công")
      router.push(`/dashboard/tasks/${initialData.id}`)
      router.refresh()
    } catch (error) {
      console.error("Lỗi:", error)
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function updateTaskDependencies() {
    try {
      const deleteRes = await fetch(`/api/tasks/${initialData.id}/dependencies`, {
        method: "DELETE",
      })
      if (!deleteRes.ok) throw new Error(`Failed to delete dependencies: ${deleteRes.status}`)

      if (selectedDependencies.length > 0) {
        await Promise.all(
          selectedDependencies.map(async (dependsOnId) => {
            const res = await fetch(`/api/tasks/${initialData.id}/dependencies`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                task_id: initialData.id,
                depends_on_id: dependsOnId,
              }),
            })
            if (!res.ok) throw new Error(`Failed to add dependency ${dependsOnId}: ${res.status}`)
            return res
          }),
        )
      }
    } catch (err) {
      console.error("Error updating task dependencies:", err)
      throw err
    }
  }

  async function updateTaskRaci() {
    try {
      await fetch(`/api/tasks/${initialData.id}/raci`, { method: "DELETE" })
      if (raciAssignments.length > 0) {
        const promises = raciAssignments.map((assignment) =>
          fetch(`/api/tasks/${initialData.id}/raci`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: assignment.user_id,
              role: assignment.role,
            }),
          }),
        )
        await Promise.all(promises)
      }
    } catch (err) {
      console.error("Error updating task RACI:", err)
    }
  }

  async function updateTaskSkills() {
    try {
      const res = await fetch(`/api/tasks/${initialData.id}/skills`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skills: selectedSkills }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || "Có lỗi xảy ra khi cập nhật kỹ năng")
      }
    } catch (err) {
      console.error("Error updating task skills:", err)
      toast.error("Có lỗi xảy ra khi cập nhật kỹ năng")
    }
  }

  const filteredAvailableTasks = availableTasks.filter(task =>
    !dependencySearch || task.name.toLowerCase().includes(dependencySearch.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()} className="gap-2">
          <ArrowLeftIcon className="h-4 w-4" />
          Quay lại
        </Button>
        <div className="flex items-center gap-2">
          <Select value={form.watch("status")} onValueChange={(value) => handleStatusChange(value as TaskStatus)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">Chưa bắt đầu</SelectItem>
              <SelectItem value="in_progress">Đang thực hiện</SelectItem>
              <SelectItem value="review">Đang xem xét</SelectItem>
              <SelectItem value="done">Hoàn thành</SelectItem>
              <SelectItem value="blocked">Bị chặn</SelectItem>
              <SelectItem value="archived">Lưu trữ</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Task Details */}
          <TaskDetailsTab
            form={form}
            users={users}
            skills={skills}
            selectedSkills={selectedSkills}
            onSkillChange={(skillId) => {
              if (selectedSkills.includes(skillId)) {
                setSelectedSkills(selectedSkills.filter((id) => id !== skillId))
              } else {
                setSelectedSkills([...selectedSkills, skillId])
              }
            }}
            projectData={projectData}
          />


          {/* RACI Assignments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Phân công trách nhiệm (RACI)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TaskAssignmentsTab
                task={initialData}
                onRaciChange={handleRaciUpdate}
                initialAssignments={initialRaciAssignments}
                projectId={projectId}
              />
            </CardContent>
          </Card>

        

          {/* Dependencies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Công việc phụ thuộc
                {!dependencyValidation.isValid && <AlertTriangle className="h-4 w-4 text-red-500 ml-2" />}
              </CardTitle>
              <CardDescription>
                Chọn các công việc mà công việc này phụ thuộc vào. Công việc này chỉ có thể bắt đầu khi các công việc phụ thuộc hoàn thành.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Dependency validation alert */}
                {!dependencyValidation.isValid && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Phụ thuộc không hợp lệ:</strong> {dependencyValidation.error}
                      {dependencyValidation.circularPath && (
                        <div className="mt-2">
                          <strong>Vòng lặp phụ thuộc:</strong> {dependencyValidation.circularPath.join(" → ")}
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Current dependencies display */}
                {selectedDependencies.length > 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 mb-2">
                      <Info className="h-4 w-4 inline mr-1" />
                      Đang phụ thuộc vào {selectedDependencies.length} công việc:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {selectedDependencies.map(depId => {
                        const depTask = availableTasks.find(t => t.id.toString() === depId)
                        return depTask ? (
                          <Badge key={depId} variant="secondary" className="text-xs">
                            {depTask.name}
                          </Badge>
                        ) : null
                      })}
                    </div>
                  </div>
                )}

                {/* Search input */}
                <input
                  type="text"
                  placeholder="Tìm kiếm công việc..."
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring"
                  value={dependencySearch}
                  onChange={e => setDependencySearch(e.target.value)}
                />

                {/* Available tasks list */}
                {filteredAvailableTasks.length > 0 ? (
                  <div style={{ maxHeight: 400, overflowY: 'auto' }} className="space-y-2">
                    {filteredAvailableTasks.map((task) => {
                      const isSelected = selectedDependencies.includes(task.id.toString())
                      const isValidating = isValidatingDependencies && isSelected

                      return (
                        <div
                          key={task.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{task.name}</div>
                            <div className="text-sm text-muted-foreground">
                              Trạng thái: 
                              <Badge variant="outline" className="ml-1 text-xs">
                                {task.status === "todo" && "Chưa bắt đầu"}
                                {task.status === "in_progress" && "Đang thực hiện"}
                                {task.status === "done" && "Hoàn thành"}
                                {task.status === "review" && "Đang xem xét"}
                                {task.status === "blocked" && "Bị chặn"}
                                {task.status === "archived" && "Lưu trữ"}
                              </Badge>
                              {task.duration_days && (
                                <span className="ml-2">• {task.duration_days} ngày</span>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleDependencyToggle(task.id)}
                            disabled={isValidating}
                          >
                            {isValidating ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                Kiểm tra...
                              </>
                            ) : isSelected ? (
                              "✓ Đã chọn"
                            ) : (
                              "Chọn"
                            )}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 border rounded-lg bg-muted/20">
                    <p className="text-sm text-muted-foreground">
                      {dependencySearch ? 
                        "Không tìm thấy công việc nào phù hợp với từ khóa tìm kiếm" : 
                        availableTasks.length === 0 ?
                          "Chưa có công việc nào khác trong dự án để tạo phụ thuộc" :
                          "Nhập từ khóa để tìm kiếm công việc"
                      }
                    </p>
                  </div>
                )}

                {/* Help text */}
                <div className="text-sm text-muted-foreground bg-gray-50 p-3 rounded">
                  <p className="font-medium mb-1">💡 Hướng dẫn:</p>
                  <ul className="space-y-1 text-xs">
                    <li>• Chọn các công việc mà công việc này <strong>phụ thuộc vào</strong></li>
                    <li>• Công việc này chỉ có thể bắt đầu khi <strong>tất cả</strong> công việc phụ thuộc hoàn thành</li>
                    <li>• Hệ thống sẽ tự động kiểm tra để tránh phụ thuộc vòng tròn</li>
                    <li>• Nếu có lỗi, hãy bỏ chọn công việc gây xung đột</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit button */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting || !dependencyValidation.isValid}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang lưu...
                </>
              ) : (
                "Lưu tất cả thay đổi"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
