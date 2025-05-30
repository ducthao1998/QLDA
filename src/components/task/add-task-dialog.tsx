"use client"
import { useEffect, useState } from "react"
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
import { Button } from "@/components/ui/button"
import { PlusIcon } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Separator } from "@/components/ui/separator"
import type { Task, TaskStatus, User, ProjectPhase, Skill, RaciRole } from "@/app/types/table-types"
import { format } from "date-fns"

interface RecommendedUser {
  id: string
  full_name: string
  position?: string
  org_unit?: string
  email?: string
  skill_level?: number
}

interface TaskRaciInput {
  user_id: string
  role: RaciRole
}

interface UserSkill {
  user_id: string
  skill_id: number
  level: number
  skill?: {
    name: string
  }
}

export function AddTaskDialog({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [phases, setPhases] = useState<ProjectPhase[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [recommendedUsers, setRecommendedUsers] = useState<RecommendedUser[]>([])
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [raciUsers, setRaciUsers] = useState<TaskRaciInput[]>([])
  const [userSkills, setUserSkills] = useState<UserSkill[]>([])
  const [maxRetries, setMaxRetries] = useState<number>(0)
  const [availableTasks, setAvailableTasks] = useState<Task[]>([])
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([])
  const [projectData, setProjectData] = useState<{ start_date: string; end_date: string } | null>(null)
  const [isAutoAssigning, setIsAutoAssigning] = useState(false)
  const [newTask, setNewTask] = useState<Partial<Task>>({
    project_id: projectId,
    name: "",
    status: "todo",
    start_date: "",
    end_date: "",
    unit_in_charge: "",
    legal_basis: "",
    note: "",
    assigned_to: "",
    phase_id: "",
  })

  useEffect(() => {
    if (isOpen) {
      // Fetch users
      fetch("/api/user")
        .then((res) => res.json())
        .then((data) => setUsers(data.users))
        .catch(() => toast.error("Không tải được danh sách người dùng"))

      // Fetch project data
      fetch(`/api/projects/${projectId}`)
        .then((res) => res.json())
        .then((data) =>
          setProjectData({
            start_date: data.project.start_date,
            end_date: data.project.end_date,
          }),
        )
        .catch(() => toast.error("Không tải được thông tin dự án"))

      // Fetch project phases
      fetch(`/api/projects/${projectId}/phases`)
        .then((res) => res.json())
        .then((data) => setPhases(data.phases))
        .catch(() => toast.error("Không tải được danh sách giai đoạn"))

      // Fetch skills
      fetch("/api/skills")
        .then((res) => res.json())
        .then((data) => setSkills(data.skills))
        .catch(() => toast.error("Không tải được danh sách lĩnh vực"))

      // Fetch all user skills
      fetch("/api/user-skills")
        .then((res) => res.json())
        .then((data) => {
          setUserSkills(data.userSkills || [])
        })
        .catch(() => toast.error("Không tải được danh sách kỹ năng người dùng"))

      // Fetch available tasks for dependencies
      fetch(`/api/projects/${projectId}/tasks`)
        .then((res) => res.json())
        .then((data) => setAvailableTasks(data.tasks || []))
        .catch(() => toast.error("Không tải được danh sách công việc"))
    }
  }, [isOpen, projectId])

  // Effect for skill selection and auto-assignment
  useEffect(() => {
    if (selectedSkills.length > 0 && !isAutoAssigning) {
      setIsAutoAssigning(true)

      // Clear previous RACI assignments when changing skills
      setRaciUsers([])
      setNewTask((prev) => ({ ...prev, assigned_to: "" }))

      // Fetch recommended users for the first selected skill
      fetch(`/api/projects/${projectId}/tasks/recommended-users?skill_id=${selectedSkills[0]}`)
        .then((res) => res.json())
        .then((data) => {
          console.log("Recommended users data:", data)
          const recommendedData = data.users || []
          setRecommendedUsers(recommendedData)

          // Auto-assign RACI roles immediately after setting recommended users
          if (recommendedData.length > 0) {
            autoAssignRaciRoles(recommendedData)
          }
        })
        .catch((error) => {
          console.error("Error fetching recommended users:", error)
          setRecommendedUsers([])
        })
        .finally(() => {
          setIsAutoAssigning(false)
        })
    } else if (selectedSkills.length === 0) {
      // Clear recommendations and RACI when no skills selected
      setRecommendedUsers([])
      setRaciUsers([])
      setNewTask((prev) => ({ ...prev, assigned_to: "" }))
    }
  }, [selectedSkills, projectId])

  // Function to auto-assign RACI roles
  const autoAssignRaciRoles = (recommendedData: RecommendedUser[]) => {
    if (recommendedData.length === 0) {
      console.log("No recommended users to assign")
      return
    }

    console.log("Auto-assigning RACI roles with data:", recommendedData)

    const newRaciAssignments: TaskRaciInput[] = []

    // Find the top user (highest skill level) for R role
    const topUser = recommendedData[0]
    if (topUser && topUser.id) {
      console.log("Assigning R role to top user:", topUser.full_name)
      newRaciAssignments.push({ user_id: topUser.id, role: "R" })

      // Update assigned_to in task
      setNewTask((prev) => ({ ...prev, assigned_to: topUser.id }))
    }

    // Find a manager for A role (different from R if possible)
    const potentialA = recommendedData.find(
      (u) =>
        u.id !== topUser?.id &&
        (u.position?.toLowerCase().includes("chỉ huy") ||
          u.position?.toLowerCase().includes("quản lý") ||
          u.position?.toLowerCase().includes("trưởng") ||
          u.position?.toLowerCase().includes("phó")),
    )

    if (potentialA && potentialA.id) {
      console.log("Assigning A role to manager:", potentialA.full_name)
      newRaciAssignments.push({ user_id: potentialA.id, role: "A" })
    } else if (recommendedData.length > 1 && topUser) {
      // If no manager found, assign A to second best user
      const secondUser = recommendedData[1]
      if (secondUser && secondUser.id) {
        console.log("Assigning A role to second user:", secondUser.full_name)
        newRaciAssignments.push({ user_id: secondUser.id, role: "A" })
      }
    } else if (topUser) {
      // If only one user, they get both R and A (will be handled by allowing multiple roles per user)
      console.log("Only one user available, assigning A role to same user:", topUser.full_name)
      newRaciAssignments.push({ user_id: topUser.id, role: "A" })
    }

    // Assign C role to other relevant users
    const consultUsers = recommendedData.slice(0, 3).filter((u) => !newRaciAssignments.some((r) => r.user_id === u.id))

    consultUsers.forEach((user) => {
      if (user.id) {
        newRaciAssignments.push({ user_id: user.id, role: "C" })
      }
    })

    // Update RACI assignments
    setRaciUsers(newRaciAssignments)

    // Show success message
    toast.success(`Đã tự động phân công ${newRaciAssignments.length} người dựa trên lĩnh vực được chọn`)
  }

  const handleSkillChange = (value: string) => {
    setSelectedSkills((prev) => {
      const newSkills = prev.includes(value) ? prev.filter((id) => id !== value) : [...prev, value]

      console.log("Skills changed:", newSkills)
      return newSkills
    })
  }

  const handleRaciChange = (userId: string, role: RaciRole) => {
    console.log("Manual RACI change:", userId, role)

    setRaciUsers((prev) => {
      const existing = prev.find((u) => u.user_id === userId)

      if (role === "R") {
        if (existing?.role === "R") {
          // If removing R, clear assigned_to
          setNewTask((prev) => ({ ...prev, assigned_to: "" }))
          return prev.filter((u) => u.user_id !== userId)
        }
        // If setting R, update assigned_to and remove R from others
        setNewTask((prev) => ({ ...prev, assigned_to: userId }))
        return [{ user_id: userId, role: "R" }, ...prev.filter((u) => u.role !== "R" && u.user_id !== userId)]
      }

      if (existing) {
        if (existing.role === role) {
          return prev.filter((u) => u.user_id !== userId)
        }
        return prev.map((u) => (u.user_id === userId ? { ...u, role } : u))
      }

      return [...prev, { user_id: userId, role }]
    })
  }

  const handleDependencyChange = (taskId: string) => {
    setSelectedDependencies((prev) => {
      if (prev.includes(taskId)) {
        return prev.filter((id) => id !== taskId)
      }
      return [...prev, taskId]
    })
  }

  // Get user skills for a specific user
  const getUserSkills = (userId: string) => {
    return userSkills.filter((skill) => skill.user_id === userId)
  }

  // Validate task dates against project dates
  const validateTaskDates = (startDate: string, endDate: string) => {
    if (!projectData) return { isValid: true, message: "" }

    const taskStart = new Date(startDate)
    const taskEnd = new Date(endDate)
    const projectStart = new Date(projectData.start_date)
    const projectEnd = new Date(projectData.end_date)

    if (taskStart < projectStart) {
      return {
        isValid: false,
        message: `Ngày bắt đầu công việc không được trước ngày bắt đầu dự án (${format(projectStart, "dd/MM/yyyy")})`,
      }
    }

    if (taskEnd > projectEnd) {
      return {
        isValid: false,
        message: `Ngày kết thúc công việc không được sau ngày kết thúc dự án (${format(projectEnd, "dd/MM/yyyy")})`,
      }
    }

    if (taskStart > taskEnd) {
      return {
        isValid: false,
        message: "Ngày bắt đầu không được sau ngày kết thúc",
      }
    }

    return { isValid: true, message: "" }
  }

  // Render skill level as stars
  const renderSkillLevel = (level: number) => {
    return Array(5)
      .fill(0)
      .map((_, i) => (
        <span key={i} className={`text-xs ${i < level ? "text-yellow-500" : "text-gray-300"}`}>
          ★
        </span>
      ))
  }

  async function handleSubmit() {
    try {
      setIsSubmitting(true)

      // Validate required fields
      if (!newTask.name || !newTask.status || !newTask.start_date || !newTask.end_date || !newTask.phase_id) {
        toast.error("Vui lòng điền đầy đủ thông tin bắt buộc")
        return
      }

      // Validate RACI roles
      const hasR = raciUsers.some((u) => u.role === "R")
      const hasA = raciUsers.some((u) => u.role === "A")

      if (!hasR || !hasA) {
        toast.error("Vui lòng chọn người thực hiện (R) và người chịu trách nhiệm (A)")
        return
      }

      // Validate task dates
      const validationResult = validateTaskDates(newTask.start_date, newTask.end_date)
      if (!validationResult.isValid) {
        toast.error(validationResult.message)
        return
      }

      // Create task
      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTask.name,
          note: newTask.note || "",
          status: newTask.status,
          start_date: newTask.start_date,
          end_date: newTask.end_date,
          phase_id: newTask.phase_id,
          assigned_to: newTask.assigned_to || null,
          max_retries: maxRetries,
          dependencies: selectedDependencies,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Có lỗi xảy ra")
      }

      const { task } = await response.json()

      // Create task skills if any selected
      if (selectedSkills.length > 0) {
        await fetch(`/api/tasks/${task.id}/skills`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            skill_ids: selectedSkills.map((id) => Number.parseInt(id))
          }),
        })
      }

      // Create task_raci records
      if (raciUsers.length > 0) {
        await Promise.all(
          raciUsers.map((raci) =>
            fetch(`/api/tasks/${task.id}/raci`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(raci),
            }),
          ),
        )
      }

      // Create initial task history record
      await fetch(`/api/tasks/${task.id}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: task.id,
          action: "task_created",
          from_val: null,
          to_val: newTask.status,
        }),
      })

      toast.success("Tạo công việc thành công")
      setIsOpen(false)
      reset()
      onCreated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Có lỗi xảy ra")
    } finally {
      setIsSubmitting(false)
    }
  }

  function reset() {
    setNewTask({
      project_id: projectId,
      name: "",
      status: "todo",
      start_date: "",
      end_date: "",
      unit_in_charge: "",
      legal_basis: "",
      note: "",
      assigned_to: "",
      phase_id: "",
    })
    setSelectedSkills([])
    setRaciUsers([])
    setMaxRetries(0)
    setSelectedDependencies([])
    setRecommendedUsers([])
    setIsAutoAssigning(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon className="h-4 w-4 mr-2" />
          Thêm công việc
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Thêm công việc mới</DialogTitle>
          <DialogDescription>Nhập thông tin công việc mới. Các trường có dấu * là bắt buộc.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Thông tin cơ bản */}
          <div className="grid gap-2">
            <Label htmlFor="name">Tên công việc *</Label>
            <Input
              id="name"
              value={newTask.name}
              onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
              placeholder="Nhập tên công việc"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phase_id">Giai đoạn dự án *</Label>
            <Select
              value={newTask.phase_id}
              onValueChange={(value) => setNewTask((prev) => ({ ...prev, phase_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn giai đoạn" />
              </SelectTrigger>
              <SelectContent>
                {phases?.map((phase) => (
                  <SelectItem key={phase.id} value={phase.id}>
                    {phase.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status">Trạng thái *</Label>
            <Select
              value={newTask.status}
              onValueChange={(value) => setNewTask((prev) => ({ ...prev, status: value as TaskStatus }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">Chưa bắt đầu</SelectItem>
                <SelectItem value="in_progress">Đang thực hiện</SelectItem>
                <SelectItem value="done">Hoàn thành</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="start_date">Ngày bắt đầu *</Label>
              <Input
                id="start_date"
                type="datetime-local"
                value={newTask.start_date || ""}
                min={projectData?.start_date ? new Date(projectData.start_date).toISOString().slice(0, 16) : undefined}
                max={projectData?.end_date ? new Date(projectData.end_date).toISOString().slice(0, 16) : undefined}
                onChange={(e) => setNewTask((prev) => ({ ...prev, start_date: e.target.value }))}
              />
              {projectData && (
                <p className="text-xs text-muted-foreground">
                  Từ {format(new Date(projectData.start_date), "dd/MM/yyyy")} đến{" "}
                  {format(new Date(projectData.end_date), "dd/MM/yyyy")}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end_date">Ngày kết thúc *</Label>
              <Input
                id="end_date"
                type="datetime-local"
                value={newTask.end_date || ""}
                min={projectData?.start_date ? new Date(projectData.start_date).toISOString().slice(0, 16) : undefined}
                max={projectData?.end_date ? new Date(projectData.end_date).toISOString().slice(0, 16) : undefined}
                onChange={(e) => setNewTask((prev) => ({ ...prev, end_date: e.target.value }))}
              />
              {projectData && (
                <p className="text-xs text-muted-foreground">
                  Từ {format(new Date(projectData.start_date), "dd/MM/yyyy")} đến{" "}
                  {format(new Date(projectData.end_date), "dd/MM/yyyy")}
                </p>
              )}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="max_retries">Số lần cho phép trình sai</Label>
            <Input
              id="max_retries"
              type="number"
              min="0"
              value={maxRetries}
              onChange={(e) => setMaxRetries(Number(e.target.value))}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">Số lần tối đa được phép trình lại khi không đạt yêu cầu</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="unit_in_charge">Đơn vị thực hiện</Label>
            <Input
              id="unit_in_charge"
              value={newTask.unit_in_charge || ""}
              onChange={(e) => setNewTask((prev) => ({ ...prev, unit_in_charge: e.target.value }))}
              placeholder="Nhập đơn vị thực hiện"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="legal_basis">Căn cứ thực hiện</Label>
            <Input
              id="legal_basis"
              value={newTask.legal_basis || ""}
              onChange={(e) => setNewTask((prev) => ({ ...prev, legal_basis: e.target.value }))}
              placeholder="Nhập căn cứ thực hiện"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="note">Ghi chú</Label>
            <Textarea
              id="note"
              value={newTask.note || ""}
              onChange={(e) => setNewTask((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Nhập ghi chú"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="skills">Lĩnh vực liên quan</Label>
            <div className="flex flex-wrap gap-2">
              {skills?.map((skill) => (
                <Badge
                  key={skill.id}
                  variant={selectedSkills.includes(skill.id.toString()) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => handleSkillChange(skill.id.toString())}
                >
                  {skill.name}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Chọn lĩnh vực để gợi ý người thực hiện phù hợp. RACI sẽ được tự động phân công.
            </p>
            {isAutoAssigning && <p className="text-sm text-blue-600">Đang tự động phân công dựa trên lĩnh vực...</p>}
          </div>

          {/* Phụ thuộc công việc */}
          <div className="grid gap-2">
            <Label htmlFor="dependencies">Công việc phụ thuộc</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {availableTasks?.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{task.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {task.status === "todo" && "Chưa bắt đầu"}
                      {task.status === "in_progress" && "Đang thực hiện"}
                      {task.status === "done" && "Hoàn thành"}
                      {task.status === "review" && "Đang xem xét"}
                      {task.status === "blocked" && "Bị chặn"}
                    </Badge>
                  </div>
                  <Badge
                    variant={selectedDependencies.includes(task.id.toString()) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => handleDependencyChange(task.id.toString())}
                  >
                    {selectedDependencies.includes(task.id.toString()) ? "Đã chọn" : "Chọn"}
                  </Badge>
                </div>
              ))}
              {(!availableTasks || availableTasks.length === 0) && (
                <p className="text-sm text-muted-foreground">Chưa có công việc nào trong dự án</p>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Chọn các công việc mà công việc này phụ thuộc vào. Công việc này chỉ có thể bắt đầu khi các công việc phụ
              thuộc hoàn thành.
            </p>
          </div>

          <Separator className="my-4" />

          {/* Phân công RACI */}
          <div className="grid gap-2">
            <Label>Phân công trách nhiệm (RACI) *</Label>
            {recommendedUsers.length > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800 font-medium mb-2">
                  Đã tự động phân công dựa trên lĩnh vực được chọn:
                </p>
                <div className="space-y-1">
                  {raciUsers.map((raci) => {
                    const user = users.find((u) => u.id === raci.user_id)
                    return (
                      <p key={`${raci.user_id}-${raci.role}`} className="text-sm text-blue-700">
                        • {user?.full_name} -{" "}
                        {raci.role === "R"
                          ? "Người thực hiện"
                          : raci.role === "A"
                            ? "Người chịu trách nhiệm"
                            : raci.role === "C"
                              ? "Người tư vấn"
                              : "Người được thông báo"}
                      </p>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="space-y-4">
              {users?.map((user) => {
                const userRaci = raciUsers.find((u) => u.user_id === user.id)
                const isRecommended = recommendedUsers.some((ru) => ru.id === user.id)
                const userSkillsData = getUserSkills(user.id)

                return (
                  <div key={user.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{user.full_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {user.position}
                      </Badge>
                      {isRecommended && selectedSkills.length > 0 && (
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <Badge variant="secondary" className="text-xs cursor-help">
                              Phù hợp với lĩnh vực
                            </Badge>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80">
                            <div className="space-y-2">
                              <h4 className="font-medium">Kỹ năng của {user.full_name}</h4>
                              {userSkillsData.length > 0 ? (
                                <div className="grid gap-2">
                                  {userSkillsData.map((skill) => {
                                    const skillName =
                                      skills.find((s) => s.id === skill.skill_id)?.name || `Kỹ năng #${skill.skill_id}`
                                    const isSelected = selectedSkills.includes(skill.skill_id.toString())

                                    return (
                                      <div key={skill.skill_id} className="flex justify-between items-center">
                                        <span className={isSelected ? "font-bold" : ""}>
                                          {skillName} {isSelected && "✓"}
                                        </span>
                                        <div className="flex">{renderSkillLevel(skill.level)}</div>
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">Không có dữ liệu kỹ năng</p>
                              )}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {(["R", "A", "C", "I"] as RaciRole[]).map((role) => (
                        <Badge
                          key={role}
                          variant={userRaci?.role === role ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => handleRaciChange(user.id, role)}
                        >
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-sm text-muted-foreground">
              R: Người thực hiện, A: Người chịu trách nhiệm, C: Người tư vấn, I: Người được thông báo
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="text-red-500">*</span> Bắt buộc phải có R và A
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
