"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  PlusIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
  ChevronDownIcon,
  ListTodoIcon,
  Pencil,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "../ui/skeleton"
import type { UserPermissions } from "@/lib/permissions"

interface ProjectPhase {
  id: string
  name: string
  description: string
  order_no: number
  status: string
  created_at: string
  updated_at: string
}

interface ProjectPhasesProps {
  projectId: string
  phases: ProjectPhase[]
  onRefresh: () => Promise<void>
  userPermissions: UserPermissions
}

interface PhaseProgress {
  progress: number
  totalTasks: number
  completedTasks: number
}

const statusLabels: Record<string, string> = {
  planning: "Lập kế hoạch",
  in_progress: "Đang thực hiện",
  on_hold: "Tạm dừng",
  completed: "Hoàn thành",
}

export function ProjectPhases({ projectId, phases, onRefresh, userPermissions }: ProjectPhasesProps) {
  const router = useRouter()
  const [isAddingPhase, setIsAddingPhase] = useState(false)
  const [isEditingPhase, setIsEditingPhase] = useState(false)
  const [editingPhase, setEditingPhase] = useState<ProjectPhase | null>(null)
  const [phaseToDelete, setPhaseToDelete] = useState<string | null>(null)
  const [progressMap, setProgressMap] = useState<Record<string, PhaseProgress | null>>({})
  const [isLoadingProgress, setIsLoadingProgress] = useState(true)
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({})
  const [newPhase, setNewPhase] = useState({
    name: "",
    description: "",
    order_no: phases.length > 0 ? Math.max(...phases.map((p) => p.order_no)) + 1 : 1,
  })

  useEffect(() => {
    const initialOpenState: Record<string, boolean> = {}
    phases.forEach((phase, index) => {
      // Mở giai đoạn đầu tiên theo mặc định
      initialOpenState[phase.id] = index === 0
    })
    setOpenPhases(initialOpenState)
  }, [phases])

  useEffect(() => {
    const fetchAllProgress = async () => {
      if (phases.length === 0) {
        setIsLoadingProgress(false)
        return
      }
      setIsLoadingProgress(true)
      const progressPromises = phases.map((phase) =>
        fetch(`/api/projects/${projectId}/phases/${phase.id}/progress`).then((res) => (res.ok ? res.json() : null)),
      )
      const results = await Promise.all(progressPromises)
      const newProgressMap: Record<string, PhaseProgress | null> = {}
      phases.forEach((phase, index) => {
        newProgressMap[phase.id] = results[index]
      })
      setProgressMap(newProgressMap)
      setIsLoadingProgress(false)
    }

    fetchAllProgress()
  }, [projectId, phases])

  const handleAddPhase = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/phases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPhase),
      })
      if (!response.ok) throw new Error("Failed to add phase")
      toast.success("Thêm giai đoạn thành công")
      setIsAddingPhase(false)
      setNewPhase({ name: "", description: "", order_no: phases.length + 2 })
      onRefresh()
    } catch (error) {
      toast.error("Lỗi", { description: "Không thể thêm giai đoạn mới" })
    }
  }

  const handleEditPhase = async () => {
    if (!editingPhase) return
    try {
      const response = await fetch(`/api/projects/${projectId}/phases/${editingPhase.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editingPhase.name,
          description: editingPhase.description,
          order_no: editingPhase.order_no,
        }),
      })
      if (!response.ok) throw new Error("Failed to update phase")
      toast.success("Cập nhật giai đoạn thành công")
      setIsEditingPhase(false)
      setEditingPhase(null)
      onRefresh()
    } catch (error) {
      toast.error("Lỗi", { description: "Không thể cập nhật giai đoạn" })
    }
  }

  const handleDeletePhase = async () => {
    if (!phaseToDelete) return
    try {
      const response = await fetch(`/api/projects/${projectId}/phases/${phaseToDelete}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete phase")
      toast.success("Xóa giai đoạn thành công")
      onRefresh()
    } catch (error) {
      toast.error("Lỗi", { description: "Không thể xóa giai đoạn" })
    } finally {
      setPhaseToDelete(null)
    }
  }

  const handleEditClick = (phase: ProjectPhase) => {
    setEditingPhase(phase)
    setIsEditingPhase(true)
  }

  const navigateToTasks = (phaseId: string) => {
    router.push(`/dashboard/tasks?projectId=${projectId}&phaseId=${phaseId}`)
  }

  const togglePhase = (phaseId: string) => {
    setOpenPhases((prev) => ({
      ...prev,
      [phaseId]: !prev[phaseId],
    }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Các giai đoạn dự án</h2>
        {userPermissions.canManagePhases && (
          <Dialog open={isAddingPhase} onOpenChange={setIsAddingPhase}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusIcon className="mr-2 h-4 w-4" />
                Thêm giai đoạn
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Thêm giai đoạn mới</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tên giai đoạn</Label>
                  <Input
                    id="name"
                    value={newPhase.name}
                    onChange={(e) => setNewPhase({ ...newPhase, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Mô tả</Label>
                  <Textarea
                    id="description"
                    value={newPhase.description}
                    onChange={(e) => setNewPhase({ ...newPhase, description: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="order">Thứ tự</Label>
                  <Input
                    id="order"
                    type="number"
                    min="1"
                    value={newPhase.order_no}
                    onChange={(e) =>
                      setNewPhase({
                        ...newPhase,
                        order_no: Number.parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddingPhase(false)}>
                  Hủy
                </Button>
                <Button onClick={handleAddPhase}>Thêm</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {phases.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed rounded-lg bg-muted/50">
          <h3 className="text-lg font-medium">Chưa có giai đoạn nào</h3>
          <p className="text-sm text-muted-foreground mt-2">Hãy thêm giai đoạn để bắt đầu quản lý dự án.</p>
        </div>
      ) : (
        <div className="border rounded-md divide-y">
          {phases.map((phase) => {
            const progressData = progressMap[phase.id]
            const isOpen = openPhases[phase.id]
            return (
              <Collapsible key={phase.id} open={isOpen} onOpenChange={() => togglePhase(phase.id)} className="w-full">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center w-full text-left px-4 py-3 bg-background hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted mr-4 flex-shrink-0">
                      <span className="text-sm font-medium">{phase.order_no}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{phase.name}</h3>
                        <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                          {statusLabels[phase.status] || phase.status}
                        </span>
                      </div>
                      {isLoadingProgress ? (
                        <Skeleton className="h-4 w-24 mt-1" />
                      ) : progressData ? (
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <div className="flex items-center">
                            <ListTodoIcon className="mr-1 h-3 w-3" />
                            <span>
                              {progressData.completedTasks}/{progressData.totalTasks} việc
                            </span>
                          </div>
                          <div className="flex items-center">
                            <span>{progressData.progress}%</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontalIcon className="h-4 w-4" />
                            <span className="sr-only">Tùy chọn</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {userPermissions.canManagePhases && (
                            <DropdownMenuItem onClick={() => handleEditClick(phase)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Chỉnh sửa
                            </DropdownMenuItem>
                          )}
                          {userPermissions.canManagePhases && (
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="text-destructive"
                              onClick={() => setPhaseToDelete(phase.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Xóa
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <ChevronDownIcon
                        className={`h-5 w-5 text-muted-foreground transition-transform ${
                          isOpen ? "transform rotate-180" : ""
                        }`}
                      />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 py-4 pl-16 bg-muted/20 border-t">
                    <p className="text-sm text-muted-foreground mb-4">
                      {phase.description || "Không có mô tả chi tiết."}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs bg-transparent"
                      onClick={() => navigateToTasks(phase.id)}
                    >
                      Xem danh sách công việc
                      <ChevronRightIcon className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )
          })}
        </div>
      )}

      {/* Edit Phase Dialog */}
      <Dialog open={isEditingPhase} onOpenChange={setIsEditingPhase}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa giai đoạn</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Tên giai đoạn</Label>
              <Input
                id="edit-name"
                value={editingPhase?.name || ""}
                onChange={(e) => setEditingPhase((prev) => (prev ? { ...prev, name: e.target.value } : null))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Mô tả</Label>
              <Textarea
                id="edit-description"
                value={editingPhase?.description || ""}
                onChange={(e) => setEditingPhase((prev) => (prev ? { ...prev, description: e.target.value } : null))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-order">Thứ tự</Label>
              <Input
                id="edit-order"
                type="number"
                min="1"
                value={editingPhase?.order_no || 1}
                onChange={(e) =>
                  setEditingPhase((prev) => (prev ? { ...prev, order_no: Number.parseInt(e.target.value) } : null))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingPhase(false)}>
              Hủy
            </Button>
            <Button onClick={handleEditPhase}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!phaseToDelete} onOpenChange={() => setPhaseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa giai đoạn</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa giai đoạn này? Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePhase}>Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default ProjectPhases
