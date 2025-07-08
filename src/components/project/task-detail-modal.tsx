"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarIcon, ClockIcon, EditIcon, SaveIcon, XIcon, BuildingIcon } from "lucide-react"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { toast } from "sonner"
import type { Task, ProjectPhase, Comment, Worklog, TaskStatus } from "@/app/types/table-types"
import type { UserPermissions } from "@/lib/permissions"

interface TaskWithDetails extends Task {
  project_phases?: ProjectPhase
  responsible_user?: {
    full_name: string
    position: string
    org_unit: string
  }
}

interface TaskDetailModalProps {
  task: TaskWithDetails
  open: boolean
  onClose: () => void
  onUpdate: () => void
  userPermissions: UserPermissions
}

const statusOptions = [
  { value: "todo", label: "Chưa bắt đầu" },
  { value: "in_progress", label: "Đang thực hiện" },
  { value: "blocked", label: "Bị chặn" },
  { value: "review", label: "Đang xem xét" },
  { value: "done", label: "Hoàn thành" },
  { value: "archived", label: "Lưu trữ" },
]

export function TaskDetailModal({ task, open, onClose, onUpdate, userPermissions }: TaskDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedTask, setEditedTask] = useState(task)
  const [comment, setComment] = useState("")
  const [comments, setComments] = useState<Comment[]>([])
  const [workLogs, setWorkLogs] = useState<Worklog[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchTaskDetails()
    }
  }, [open, task.id])

  const fetchTaskDetails = async () => {
    try {
      // Fetch work logs (comments API không có sẵn theo danh sách API)
      const workLogsRes = await fetch(`/api/tasks/${task.id}/worklogs`).catch(() => ({ ok: false }))

      if (workLogsRes.ok && workLogsRes instanceof Response) {
        const workLogsData = await workLogsRes.json()
        setWorkLogs(workLogsData.worklogs || [])
      }
    } catch (error) {
      console.error("Error fetching task details:", error)
    }
  }

  const handleSave = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: editedTask.status,
          name: editedTask.name,
          note: editedTask.note,
          unit_in_charge: editedTask.unit_in_charge,
          legal_basis: editedTask.legal_basis,
          max_retries: editedTask.max_retries,
          start_date: editedTask.start_date,
          end_date: editedTask.end_date,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update task")
      }

      toast.success("Cập nhật công việc thành công")
      setIsEditing(false)
      onUpdate()
    } catch (error) {
      toast.error("Không thể cập nhật công việc")
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case "todo":
        return "bg-gray-100 text-gray-800"
      case "in_progress":
        return "bg-blue-100 text-blue-800"
      case "blocked":
        return "bg-red-100 text-red-800"
      case "review":
        return "bg-yellow-100 text-yellow-800"
      case "done":
        return "bg-green-100 text-green-800"
      case "archived":
        return "bg-gray-200 text-gray-600"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">
              {isEditing ? (
                <Input
                  value={editedTask.name}
                  onChange={(e) => setEditedTask({ ...editedTask, name: e.target.value })}
                  className="text-xl font-semibold"
                />
              ) : (
                task.name
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {userPermissions.canAssignTasks && (
                <>
                  {isEditing ? (
                    <>
                      <Button size="sm" onClick={handleSave} disabled={loading}>
                        <SaveIcon className="h-4 w-4 mr-2" />
                        Lưu
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                        <XIcon className="h-4 w-4 mr-2" />
                        Hủy
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                      <EditIcon className="h-4 w-4 mr-2" />
                      Chỉnh sửa
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div>
              <h3 className="font-semibold mb-2">Ghi chú</h3>
              {isEditing ? (
                <Textarea
                  value={editedTask.note || ""}
                  onChange={(e) => setEditedTask({ ...editedTask, note: e.target.value })}
                  placeholder="Thêm ghi chú..."
                  rows={4}
                />
              ) : (
                <p className="text-muted-foreground">{task.note || "Chưa có ghi chú"}</p>
              )}
            </div>

            {/* Legal Basis */}
            <div>
              <h3 className="font-semibold mb-2">Căn cứ pháp lý</h3>
              {isEditing ? (
                <Textarea
                  value={editedTask.legal_basis || ""}
                  onChange={(e) => setEditedTask({ ...editedTask, legal_basis: e.target.value })}
                  placeholder="Căn cứ pháp lý..."
                  rows={3}
                />
              ) : (
                <p className="text-muted-foreground">{task.legal_basis || "Chưa có căn cứ pháp lý"}</p>
              )}
            </div>

            {/* Work Logs */}
            {workLogs.length > 0 && (
              <div>
                <h3 className="font-semibold mb-4">Nhật ký công việc ({workLogs.length})</h3>
                <div className="space-y-3">
                  {workLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{log.spent_hours} giờ</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.log_date), "dd/MM/yyyy", { locale: vi })}
                        </span>
                      </div>
                      {log.note && <p className="text-sm text-muted-foreground">{log.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <div>
              <h4 className="font-medium mb-2">Trạng thái</h4>
              {isEditing ? (
                <Select
                  value={editedTask.status}
                  onValueChange={(value) => setEditedTask({ ...editedTask, status: value as TaskStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge className={getStatusColor(task.status)}>
                  {statusOptions.find((s) => s.value === task.status)?.label || task.status}
                </Badge>
              )}
            </div>

            {/* Assignee */}
            <div>
              <h4 className="font-medium mb-2">Người thực hiện (R)</h4>
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{task.responsible_user?.full_name?.charAt(0) || "?"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{task.responsible_user?.full_name || "Chưa gán"}</p>
                  <p className="text-xs text-muted-foreground">{task.responsible_user?.position}</p>
                </div>
              </div>
            </div>

            {/* Phase */}
            {task.project_phases && (
              <div>
                <h4 className="font-medium mb-2">Giai đoạn</h4>
                <Badge variant="outline">{task.project_phases.name}</Badge>
              </div>
            )}

            {/* Unit in charge */}
            <div>
              <h4 className="font-medium mb-2">Đơn vị phụ trách</h4>
              {isEditing ? (
                <Input
                  value={editedTask.unit_in_charge || ""}
                  onChange={(e) => setEditedTask({ ...editedTask, unit_in_charge: e.target.value })}
                  placeholder="Đơn vị phụ trách..."
                />
              ) : (
                <div className="flex items-center gap-2">
                  <BuildingIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{task.unit_in_charge || "Chưa xác định"}</span>
                </div>
              )}
            </div>

            {/* Max Retries */}
            <div>
              <h4 className="font-medium mb-2">Số lần thử lại tối đa</h4>
              {isEditing ? (
                <Input
                  type="number"
                  value={editedTask.max_retries || ""}
                  onChange={(e) =>
                    setEditedTask({
                      ...editedTask,
                      max_retries: e.target.value ? Number.parseInt(e.target.value) : undefined,
                    })
                  }
                  placeholder="Số lần thử lại..."
                />
              ) : (
                <span className="text-sm">{task.max_retries || "Không giới hạn"}</span>
              )}
            </div>

            {/* Dates */}
            <div>
              <h4 className="font-medium mb-2">Thời gian</h4>
              {isEditing ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Ngày bắt đầu</label>
                    <Input
                      type="date"
                      value={editedTask.start_date}
                      onChange={(e) => setEditedTask({ ...editedTask, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Ngày kết thúc</label>
                    <Input
                      type="date"
                      value={editedTask.end_date}
                      onChange={(e) => setEditedTask({ ...editedTask, end_date: e.target.value })}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  {task.start_date && (
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span>Bắt đầu: {format(new Date(task.start_date), "dd/MM/yyyy", { locale: vi })}</span>
                    </div>
                  )}
                  {task.end_date && (
                    <div className="flex items-center gap-2">
                      <ClockIcon className="h-4 w-4 text-muted-foreground" />
                      <span>Kết thúc: {format(new Date(task.end_date), "dd/MM/yyyy", { locale: vi })}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
