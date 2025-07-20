"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircleIcon, ArrowLeftIcon, UserCheck, Loader2, AlertTriangle } from "lucide-react"
import { Form } from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TaskDetailsTab } from "./edit/task-detail-tabs"
import { TaskAssignmentsTab } from "./task-edit-tabs/task-assignments-tab"
import type { Task, TaskStatus, User, ProjectPhase, Skill, RaciRole } from "@/app/types/table-types"

const taskFormSchema = z.object({
  name: z.string().min(3, { message: "Tên công việc phải có ít nhất 3 ký tự" }),
  note: z.string().optional(),
  status: z.string(),
  start_date: z.string().min(1, { message: "Vui lòng chọn ngày bắt đầu" }),
  end_date: z.string().min(1, { message: "Vui lòng chọn ngày kết thúc" }),
  phase_id: z.string().min(1, { message: "Vui lòng chọn giai đoạn" }),
  assigned_to: z.string().optional(),
  unit_in_charge: z.string().optional(),
  legal_basis: z.string().optional(),
  max_retries: z.number().min(0).optional(),
})

export type TaskFormValues = z.infer<typeof taskFormSchema>

interface TaskEditFormProps {
  initialData: Task
  projectId: string
}

// Updated interface to match API response
interface UserRecommendation {
  user_id: string
  full_name: string
  completed_tasks_count: number
  workload: number
}

// Interface for dependency validation
interface DependencyValidationResult {
  isValid: boolean
  circularPath?: string[]
  error?: string
}

export function TaskEditForm({ initialData, projectId }: TaskEditFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [phases, setPhases] = useState<ProjectPhase[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [selectedSkills, setSelectedSkills] = useState<number[]>([])
  const [availableTasks, setAvailableTasks] = useState<Task[]>([])
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([])
  const [originalDependencies, setOriginalDependencies] = useState<string[]>([])
  const [isOverdue, setIsOverdue] = useState(false)
  const [activeTab, setActiveTab] = useState("details")
  const [projectData, setProjectData] = useState<{ start_date: string; end_date: string } | null>(null)
  const [userRecommendations, setUserRecommendations] = useState<UserRecommendation[]>([])
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)

  // Dependency validation states
  const [dependencyValidation, setDependencyValidation] = useState<DependencyValidationResult>({ isValid: true })
  const [isValidatingDependencies, setIsValidatingDependencies] = useState(false)

  // Separate state for RACI to avoid conflicts
  const [raciAssignments, setRaciAssignments] = useState<{ user_id: string; role: RaciRole }[]>([])
  const [initialRaciAssignments, setInitialRaciAssignments] = useState<{ user_id: string; role: RaciRole }[]>([])
  const [hasRaciChanges, setHasRaciChanges] = useState(false)

  // Form setup - REMOVE assigned_to from schema
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      name: initialData.name,
      note: initialData.note || "",
      status: initialData.status,
      start_date: initialData.start_date ? format(new Date(initialData.start_date), "yyyy-MM-dd") : "",
      end_date: initialData.end_date ? format(new Date(initialData.end_date), "yyyy-MM-dd") : "",
      phase_id: initialData.phase_id,
      unit_in_charge: initialData.unit_in_charge || "",
      legal_basis: initialData.legal_basis || "",
      max_retries: initialData.max_retries || 0,
    },
  })

  // Load data on mount
  useEffect(() => {
    loadUsers()
    loadPhases()
    loadSkills()
    loadAvailableTasks()
    loadTaskDependencies()
    loadProjectData()
    loadUserRecommendations() // Load recommendations immediately
    loadRaciAssignments() // Load RACI data
  }, [initialData.id])

  // Check overdue status when dates or status change
  useEffect(() => {
    checkIfOverdue()
  }, [initialData.end_date, initialData.status])

  // Validate dependencies when they change
  useEffect(() => {
    if (selectedDependencies.length > 0) {
      validateDependencies()
    } else {
      setDependencyValidation({ isValid: true })
    }
  }, [selectedDependencies, availableTasks])

  // Check if task is overdue - FIXED VERSION with clear logic
  const checkIfOverdue = () => {
    if (!initialData.end_date) {
      setIsOverdue(false)
      return
    }

    try {
      const endDate = new Date(initialData.end_date)
      const now = new Date()

      // Task is overdue if:
      // 1. End date has passed
      // 2. Task is not completed (done) or archived
      const isTaskOverdue = endDate < now && initialData.status !== "done" && initialData.status !== "archived"

      setIsOverdue(isTaskOverdue)

      // Debug log
      console.log("Overdue check:", {
        endDate: format(endDate, "dd/MM/yyyy"),
        now: format(now, "dd/MM/yyyy"),
        status: initialData.status,
        isOverdue: isTaskOverdue,
      })
    } catch (error) {
      console.error("Error checking if task is overdue:", error)
      setIsOverdue(false)
    }
  }

  // Validate dependencies for circular references
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

      if (!response.ok) {
        throw new Error("Failed to validate dependencies")
      }

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

  // Load RACI assignments
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

  // Load user recommendations - Fixed to use correct API
  async function loadUserRecommendations() {
    try {
      setIsLoadingRecommendations(true)

      const res = await fetch(`/api/projects/${projectId}/tasks/${initialData.id}/recommended-users`)
      if (!res.ok) {
        console.error("Failed to load recommendations:", res.status)
        return
      }

      const data = await res.json()
      console.log("Recommendations data:", data) // Debug log

      // Handle both possible response structures
      const recommendations = data.data || data.recommendations || []
      setUserRecommendations(recommendations)
    } catch (err) {
      console.error("Error loading user recommendations:", err)
    } finally {
      setIsLoadingRecommendations(false)
    }
  }

  // Load users
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

  // Load phases
  async function loadPhases() {
    try {
      const res = await fetch(`/api/projects/${projectId}/phases`)
      if (!res.ok) throw new Error("Failed to load phases")
      const data = await res.json()
      // Handle different response structures
      setPhases(data.phases || data.data || [])
    } catch (err) {
      toast.error("Không thể tải danh sách giai đoạn")
    }
  }

  // Load skills
  async function loadSkills() {
    try {
      const res = await fetch("/api/skills")
      if (!res.ok) throw new Error("Failed to load skills")
      const data = await res.json()
      setSkills(data.skills || data.data || [])

      // Load existing task skills
      await loadTaskSkills()
    } catch (err) {
      toast.error("Không thể tải danh sách kỹ năng")
    }
  }

  // Load existing task skills
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

  // Load available tasks for dependencies
  async function loadAvailableTasks() {
    try {
      console.log("Loading available tasks for project:", projectId) // Debug log
      const res = await fetch(`/api/projects/${projectId}/tasks`)
      console.log("Available tasks response status:", res.status) // Debug log

      if (!res.ok) {
        const errorText = await res.text()
        console.error("Failed to load tasks, status:", res.status, "error:", errorText)
        throw new Error(`Failed to load tasks: ${res.status}`)
      }

      const data = await res.json()
      console.log("Raw tasks data:", data) // Debug log

      // API returns tasks directly as array, not wrapped in object
      const tasks = Array.isArray(data) ? data : data.tasks || data.data || []
      console.log("All tasks:", tasks) // Debug log
      console.log("Current task ID:", initialData.id, typeof initialData.id) // Debug log

      const filteredTasks = tasks.filter((task: Task) => {
        // Convert both IDs to strings for comparison
        const taskIdStr = task.id.toString()
        const currentTaskIdStr = initialData.id.toString()
        return taskIdStr !== currentTaskIdStr
      })

      console.log("Filtered tasks:", filteredTasks) // Debug log
      setAvailableTasks(filteredTasks)
    } catch (err) {
      console.error("Error loading available tasks:", err)
      toast.error("Không thể tải danh sách công việc")
      setAvailableTasks([]) // Set empty array on error
    }
  }

  // Load task dependencies
  async function loadTaskDependencies() {
    try {
      console.log("Loading dependencies for task:", initialData.id) // Debug log
      const res = await fetch(`/api/tasks/${initialData.id}/dependencies`)
      console.log("Dependencies response status:", res.status) // Debug log

      if (res.ok) {
        const data = await res.json()
        console.log("Dependencies data:", data) // Debug log
        const deps = data.dependencies || data.data || []
        console.log("Raw dependencies array:", deps) // Debug log

        const depIds = deps
          .map((dep: any) => {
            // Handle both possible field names and ensure string conversion
            const depId = dep.depends_on_id || dep.dependency_task?.id || dep.id
            console.log("Processing dependency:", dep, "-> depId:", depId) // Debug log
            return depId?.toString()
          })
          .filter(Boolean)

        console.log("Loaded dependency IDs:", depIds) // Debug log
        setSelectedDependencies(depIds)
        setOriginalDependencies(depIds) // Store original for comparison
      } else {
        console.error("Failed to load dependencies, status:", res.status)
        const errorText = await res.text()
        console.error("Error response:", errorText)
        setSelectedDependencies([]) // Set empty array on error
        setOriginalDependencies([])
      }
    } catch (err) {
      console.error("Error loading dependencies:", err)
      setSelectedDependencies([]) // Set empty array on error
      setOriginalDependencies([])
    }
  }

  // Load project data for date validation
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

  // Handle dependency selection with validation
  const handleDependencyChange = async (taskId: number) => {
    const taskIdStr = taskId.toString()
    let newDependencies: string[]

    if (selectedDependencies.includes(taskIdStr)) {
      newDependencies = selectedDependencies.filter((id) => id !== taskIdStr)
    } else {
      newDependencies = [...selectedDependencies, taskIdStr]
    }

    // Temporarily set the new dependencies
    setSelectedDependencies(newDependencies)

    // If adding a dependency, validate it immediately
    if (!selectedDependencies.includes(taskIdStr) && newDependencies.length > 0) {
      setIsValidatingDependencies(true)

      try {
        const response = await fetch(`/api/tasks/${initialData.id}/validate-dependencies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependencies: newDependencies }),
        })

        if (!response.ok) {
          throw new Error("Failed to validate dependencies")
        }

        const result = await response.json()

        if (!result.isValid) {
          // Revert the change if invalid
          setSelectedDependencies(selectedDependencies)
          toast.error(result.error || "Phụ thuộc này sẽ tạo ra vòng lặp")
          setDependencyValidation(result)
        } else {
          setDependencyValidation({ isValid: true })
        }
      } catch (error) {
        console.error("Error validating dependency:", error)
        // Revert the change on error
        setSelectedDependencies(selectedDependencies)
        toast.error("Không thể kiểm tra phụ thuộc. Vui lòng thử lại.")
      } finally {
        setIsValidatingDependencies(false)
      }
    }
  }

  // Handle status change
  const handleStatusChange = (newStatus: TaskStatus) => {
    console.log("Status change:", newStatus) // Debug log
    form.setValue("status", newStatus)
    form.trigger("status") // Trigger validation
  }

  // Callback for RACI updates
  const handleRaciUpdate = (assignments: { user_id: string; role: RaciRole }[]) => {
    setRaciAssignments(assignments)

    // Check if there are actual changes
    const hasChanges =
      JSON.stringify(assignments.sort((a, b) => a.user_id.localeCompare(b.user_id))) !==
      JSON.stringify(initialRaciAssignments.sort((a, b) => a.user_id.localeCompare(b.user_id)))
    setHasRaciChanges(hasChanges)
  }

  // Combined form submission
  async function onSubmit(values: TaskFormValues) {
    // Check if dependencies are valid before submitting
    if (!dependencyValidation.isValid) {
      toast.error("Vui lòng sửa các vấn đề về phụ thuộc trước khi lưu")
      setActiveTab("dependencies")
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

  // Update task dependencies
  async function updateTaskDependencies() {
    try {
      console.log("Updating dependencies for task:", initialData.id)
      console.log("Selected dependencies:", selectedDependencies)

      // Delete all existing dependencies
      const deleteRes = await fetch(`/api/tasks/${initialData.id}/dependencies`, {
        method: "DELETE",
      })

      if (!deleteRes.ok) {
        const errorText = await deleteRes.text()
        console.error("Failed to delete dependencies:", deleteRes.status, errorText)
        throw new Error(`Failed to delete dependencies: ${deleteRes.status}`)
      }

      console.log("Successfully deleted existing dependencies")

      // Add selected dependencies
      if (selectedDependencies.length > 0) {
        console.log("Adding new dependencies:", selectedDependencies)

        const results = await Promise.all(
          selectedDependencies.map(async (dependsOnId) => {
            const res = await fetch(`/api/tasks/${initialData.id}/dependencies`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                task_id: initialData.id,
                depends_on_id: dependsOnId,
              }),
            })

            if (!res.ok) {
              const errorText = await res.text()
              console.error(`Failed to add dependency ${dependsOnId}:`, res.status, errorText)
              throw new Error(`Failed to add dependency ${dependsOnId}: ${res.status}`)
            }

            return res
          }),
        )

        console.log("Successfully added all dependencies:", results.length)
      } else {
        console.log("No dependencies to add")
      }
    } catch (err) {
      console.error("Error updating task dependencies:", err)
      throw err // Re-throw to be caught by onSubmit
    }
  }

  // Update task RACI
  async function updateTaskRaci() {
    try {
      // Delete all existing RACI
      await fetch(`/api/tasks/${initialData.id}/raci`, {
        method: "DELETE",
      })

      // Add new RACI assignments
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

  // Update task skills
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
              Quá hạn {initialData.end_date ? `(${format(new Date(initialData.end_date), "dd/MM/yyyy")})` : ""}
            </Badge>
          )}
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
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full md:w-auto">
              <TabsTrigger value="details">Chi tiết</TabsTrigger>
              <TabsTrigger value="assignments">Phân công & RACI</TabsTrigger>
              <TabsTrigger value="recommendations">Đề xuất người thực hiện</TabsTrigger>
              <TabsTrigger value="dependencies" className="relative">
                Phụ thuộc
                {!dependencyValidation.isValid && <AlertTriangle className="h-3 w-3 text-red-500 ml-1" />}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              <>
              <TaskDetailsTab
                form={form}
                phases={phases}
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
                    <Card className="mt-4">
                <CardHeader>
                  <CardTitle>Công việc phụ thuộc</CardTitle>
                  <CardDescription>
                    Chọn các công việc mà công việc này phụ thuộc vào. Công việc này chỉ có thể bắt đầu khi các công
                    việc phụ thuộc hoàn thành.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Dependency validation alert */}
                  {!dependencyValidation.isValid && (
                    <Alert variant="destructive" className="mb-4">
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

                  {/* Debug info */}
                  <div className="mb-4 p-2 bg-gray-100 rounded text-xs">
                    <p>Debug: Available tasks count: {availableTasks?.length || 0}</p>
                    <p>Current task ID: {initialData.id}</p>
                    <p>Selected dependencies: {selectedDependencies.join(", ")}</p>
                    <p>Validation status: {dependencyValidation.isValid ? "Valid" : "Invalid"}</p>
                  </div>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {availableTasks && availableTasks.length > 0 ? (
                      availableTasks.map((task) => {
                        const isSelected = selectedDependencies.includes(task.id.toString())
                        const isValidating = isValidatingDependencies && isSelected

                        return (
                          <div
                            key={task.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{task.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {task.status === "todo" && "Chưa bắt đầu"}
                                {task.status === "in_progress" && "Đang thực hiện"}
                                {task.status === "done" && "Hoàn thành"}
                                {task.status === "review" && "Đang xem xét"}
                                {task.status === "blocked" && "Bị chặn"}
                                {task.status === "archived" && "Lưu trữ"}
                              </Badge>
                            </div>
                            <Button
                              type="button"
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleDependencyChange(task.id)}
                              disabled={isValidating}
                            >
                              {isValidating ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  Kiểm tra...
                                </>
                              ) : isSelected ? (
                                "Đã chọn"
                              ) : (
                                "Chọn"
                              )}
                            </Button>
                          </div>
                        )
                      })
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground">
                          {availableTasks === null ? "Đang tải..." : "Chưa có công việc nào khác trong dự án"}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              </>
            </TabsContent>

            <TabsContent value="assignments">
              <TaskAssignmentsTab
                task={initialData}
                onRaciChange={handleRaciUpdate}
                initialAssignments={initialRaciAssignments}
              />
            </TabsContent>

            <TabsContent value="recommendations">
              <Card>
                <CardHeader>
                  <CardTitle>Đề xuất người thực hiện</CardTitle>
                  <CardDescription>
                    Dựa trên kinh nghiệm với kỹ năng yêu cầu và khối lượng công việc hiện tại (tối đa 2 việc đồng thời).
                    Click vào người để gán làm người thực hiện chính (R) trong RACI.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingRecommendations ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>Đang tải đề xuất...</span>
                    </div>
                  ) : userRecommendations.length > 0 ? (
                    <div className="space-y-3">
                      {userRecommendations.map((rec, index) => {
                        // Check if this user is already assigned as R in RACI
                        const isCurrentResponsible = raciAssignments.some(
                          (a) => a.user_id === rec.user_id && a.role === "R",
                        )

                        return (
                          <div
                            key={rec.user_id}
                            className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                              isCurrentResponsible ? "border-primary bg-primary/5" : "hover:bg-gray-50"
                            }`}
                            onClick={() => {
                              // Add or update user as Responsible in RACI
                              const newAssignments = [...raciAssignments]

                              // Remove any existing R role
                              const existingRIndex = newAssignments.findIndex((a) => a.role === "R")
                              if (existingRIndex >= 0) {
                                newAssignments[existingRIndex].role = "A" // Demote to Accountable
                              }

                              // Check if user already has a role
                              const userIndex = newAssignments.findIndex((a) => a.user_id === rec.user_id)
                              if (userIndex >= 0) {
                                newAssignments[userIndex].role = "R"
                              } else {
                                newAssignments.push({ user_id: rec.user_id, role: "R" })
                              }

                              handleRaciUpdate(newAssignments)
                              toast.success(`Đã chọn ${rec.full_name} làm người thực hiện chính (R)`)

                              // Switch to assignments tab to show the change
                              setActiveTab("assignments")
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`rounded-full p-2 ${index === 0 ? "bg-green-100" : "bg-gray-100"}`}>
                                  <UserCheck
                                    className={`h-4 w-4 ${index === 0 ? "text-green-600" : "text-gray-600"}`}
                                  />
                                </div>
                                <div>
                                  <p className="font-medium">{rec.full_name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {index === 0 ? "Được đề xuất cao nhất" : "Phù hợp với công việc"}
                                  </p>
                                  {isCurrentResponsible && (
                                    <Badge variant="default" className="mt-1">
                                      Đang là người thực hiện chính
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold">{rec.completed_tasks_count} công việc</p>
                                <p className="text-xs text-muted-foreground">Đang làm: {rec.workload} việc</p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <UserCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>Không tìm thấy người phù hợp</p>
                      <p className="text-sm mt-1">
                        Tất cả mọi người đang bận hoặc chưa có kinh nghiệm với loại công việc này
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dependencies">
        
            </TabsContent>
          </Tabs>

          {/* Single submit button for entire form */}
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
