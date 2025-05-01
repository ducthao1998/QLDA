"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import {
  PlusIcon,
  ChevronRightIcon,
  ClockIcon,
  MoreHorizontalIcon,
  ChevronDownIcon,
  ListTodoIcon,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

interface ProjectPhase {
  id: string
  project_id: string
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
  onRefresh: () => void
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
  archived: "Lưu trữ",
  cancelled: "Đã hủy",
}

export function ProjectPhases({ projectId, phases, onRefresh }: ProjectPhasesProps) {
  const router = useRouter()
  const [isAddingPhase, setIsAddingPhase] = useState(false)
  const [isEditingPhase, setIsEditingPhase] = useState(false)
  const [editingPhase, setEditingPhase] = useState<ProjectPhase | null>(null)
  const [phaseProgress, setPhaseProgress] = useState<Record<string, PhaseProgress>>({})
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>({})
  const [newPhase, setNewPhase] = useState({
    name: "",
    description: "",
    order_no: phases.length > 0 ? Math.max(...phases.map((p) => p.order_no)) + 1 : 1,
  })

  // Initialize all phases as closed
  useEffect(() => {
    const initialOpenState: Record<string, boolean> = {}
    phases.forEach((phase) => {
      initialOpenState[phase.id] = false
    })
    setOpenPhases(initialOpenState)
  }, [phases])

  useEffect(() => {
    const fetchProgress = async () => {
      const progressMap: Record<string, PhaseProgress> = {}
      for (const phase of phases) {
        try {
          const response = await fetch(`/api/projects/${projectId}/phases/${phase.id}/progress`)
          if (response.ok) {
            const data = await response.json()
            progressMap[phase.id] = data
          }
        } catch (error) {
          console.error(`Error fetching progress for phase ${phase.id}:`, error)
        }
      }
      setPhaseProgress(progressMap)
    }

    fetchProgress()
  }, [projectId, phases])

  const handleAddPhase = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/phases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newPhase),
      })

      if (!response.ok) {
        throw new Error("Failed to add phase")
      }

      toast.success("Thêm giai đoạn thành công")
      setIsAddingPhase(false)
      setNewPhase({ name: "", description: "", order_no: phases.length + 1 })
      onRefresh()
    } catch (error) {
      console.error("Error adding phase:", error)
      toast.error("Lỗi", {
        description: "Không thể thêm giai đoạn mới",
      })
    }
  }

  const handleEditPhase = async () => {
    if (!editingPhase) return

    try {
      const response = await fetch(`/api/projects/${projectId}/phases/${editingPhase.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editingPhase.name,
          description: editingPhase.description,
          order_no: editingPhase.order_no,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update phase")
      }

      toast.success("Cập nhật giai đoạn thành công")
      setIsEditingPhase(false)
      setEditingPhase(null)
      onRefresh()
    } catch (error) {
      console.error("Error updating phase:", error)
      toast.error("Lỗi", {
        description: "Không thể cập nhật giai đoạn",
      })
    }
  }

  const handleDeletePhase = async (phaseId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/phases/${phaseId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete phase")
      }

      toast.success("Xóa giai đoạn thành công")
      onRefresh()
    } catch (error) {
      console.error("Error deleting phase:", error)
      toast.error("Lỗi", {
        description: "Không thể xóa giai đoạn",
      })
    }
  }

  const navigateToPhaseDetails = (phaseId: string) => {
    router.push(`/dashboard/projects/${projectId}/phases/${phaseId}`)
  }

  const navigateToTasks = (phaseId: string) => {
    router.push(`/dashboard/projects/${projectId}/phases/${phaseId}/tasks`)
  }

  const handleEditClick = (phase: ProjectPhase) => {
    setEditingPhase(phase)
    setIsEditingPhase(true)
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
                  onChange={(e) => setNewPhase({ ...newPhase, order_no: Number.parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsAddingPhase(false)}>
                Hủy
              </Button>
              <Button onClick={handleAddPhase}>Thêm</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {phases.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg bg-muted/10">
          <div className="text-center space-y-3">
            <h3 className="text-lg font-medium">Chưa có giai đoạn nào</h3>
            <p className="text-sm text-muted-foreground">Thêm giai đoạn đầu tiên để bắt đầu quản lý dự án</p>
            <Button variant="outline" onClick={() => setIsAddingPhase(true)}>
              <PlusIcon className="mr-2 h-4 w-4" />
              Thêm giai đoạn
            </Button>
          </div>
        </div>
      ) : (
        <div className="border rounded-md divide-y">
          {phases.map((phase, index) => {
            const progressData = phaseProgress[phase.id] || { progress: 0, totalTasks: 0, completedTasks: 0 }
            const isOpen = openPhases[phase.id]

            return (
              <Collapsible key={phase.id} open={isOpen} onOpenChange={() => togglePhase(phase.id)} className="w-full">
                <div className="flex items-center px-4 py-3 bg-background hover:bg-muted/20 transition-colors">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted mr-3 flex-shrink-0">
                    <span className="text-sm font-medium">{phase.order_no}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-0 h-auto">
                          <ChevronDownIcon
                            className={`h-4 w-4 text-muted-foreground transition-transform ${
                              isOpen ? "transform rotate-180" : ""
                            }`}
                          />
                        </Button>
                      </CollapsibleTrigger>

                      <h3 className="font-medium truncate">{phase.name}</h3>

                      <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
                        {statusLabels[phase.status] || phase.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <div className="flex items-center">
                        <ListTodoIcon className="mr-1 h-3 w-3" />
                        <span>
                          {progressData.completedTasks}/{progressData.totalTasks}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span>{progressData.progress}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigateToTasks(phase.id)
                      }}
                    >
                      <ListTodoIcon className="h-4 w-4" />
                      <span className="sr-only">Nhiệm vụ</span>
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontalIcon className="h-4 w-4" />
                          <span className="sr-only">Tùy chọn</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigateToPhaseDetails(phase.id)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Chi tiết
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditClick(phase)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Chỉnh sửa
                        </DropdownMenuItem>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Xóa
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Xóa giai đoạn</AlertDialogTitle>
                              <AlertDialogDescription>
                                Bạn có chắc chắn muốn xóa giai đoạn này? Hành động này không thể hoàn tác.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeletePhase(phase.id)}>Xóa</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <CollapsibleContent>
                  <div className="px-4 py-3 pl-16 bg-muted/5 border-t">
                    <div className="space-y-4">
                      {phase.description && <p className="text-sm text-muted-foreground">{phase.description}</p>}

                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>Tiến độ</span>
                          <span className="font-medium">{progressData.progress}%</span>
                        </div>
                        <Progress value={progressData.progress} className="h-1.5" />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-xs text-muted-foreground">
                          <ClockIcon className="mr-1 h-3 w-3" />
                          <span>Cập nhật: {format(new Date(phase.updated_at), "dd/MM/yyyy", { locale: vi })}</span>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => navigateToTasks(phase.id)}
                        >
                          Xem nhiệm vụ
                          <ChevronRightIcon className="ml-1 h-3 w-3" />
                        </Button>
                      </div>
                    </div>
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
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditingPhase(false)}>
              Hủy
            </Button>
            <Button onClick={handleEditPhase}>Lưu</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
