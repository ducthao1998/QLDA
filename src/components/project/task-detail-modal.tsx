"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EditIcon, SaveIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import type { Task, Worklog, TaskStatus } from "@/app/types/table-types"
import type { UserPermissions } from "@/lib/permissions"

interface TaskWithDetails extends Task {
  responsible_user?: {
    full_name: string
    position: string
    org_unit: string
  }
  duration_days?: number
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
  const [workLogs, setWorkLogs] = useState<Worklog[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetchTaskDetails()
    }
  }, [open, task.id])

  const fetchTaskDetails = async () => {
    try {
      // Fetch work logs
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
          duration_days: editedTask.duration_days,
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
                          {new Date(log.log_date).toLocaleDateString('vi-VN')}
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
              <h4 className="font-medium mb-2">Người thực hiện</h4>
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

            {/* Duration */}
            <div>
              <h4 className="font-medium mb-2">Số ngày thực hiện</h4>
              {isEditing ? (
                <Input
                  type="number"
                  min="1"
                  value={editedTask.duration_days || 1}
                  onChange={(e) =>
                    setEditedTask({
                      ...editedTask,
                      duration_days: parseInt(e.target.value) || 1,
                    })
                  }
                  placeholder="Số ngày..."
                />
              ) : (
                <span className="text-sm">{(task as any).duration_days || 1} ngày</span>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
