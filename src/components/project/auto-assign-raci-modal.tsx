"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Bot, 
  Users, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Target, 
  Brain,
  Settings,
  Play,
  Eye
} from "lucide-react"
import { toast } from "sonner"
import type { Task, User } from "@/app/types/table-types"

interface AutoAssignRaciModalProps {
  open: boolean
  onClose: () => void
  projectId: string
  tasks: Task[]
  onSuccess: () => void
}

interface AssignmentResult {
  task_id: string
  task_name: string
  user_id: string
  user_name: string
  confidence_score: number
  experience_score: number
}

interface UnassignedTask {
  task_id: string
  task_name: string
  reason: string
}

export function AutoAssignRaciModal({
  open,
  onClose,
  projectId,
  tasks,
  onSuccess
}: AutoAssignRaciModalProps) {
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [maxConcurrentTasks, setMaxConcurrentTasks] = useState(2)
  const [isLoading, setIsLoading] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [assignments, setAssignments] = useState<AssignmentResult[]>([])
  const [unassigned, setUnassigned] = useState<UnassignedTask[]>([])
  const [debugInfo, setDebugInfo] = useState<any>(null)

  // Filter tasks that don't have RACI assignments yet
  const unassignedTasks = tasks.filter(task => 
    task.status !== 'done' && task.status !== 'archived'
  )

  useEffect(() => {
    if (open) {
      // Reset state when modal opens
      setSelectedTasks([])
      setAssignments([])
      setUnassigned([])
      setDebugInfo(null)
      setIsPreviewMode(false)
    }
  }, [open])

  const handleTaskToggle = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    )
  }

  const handleSelectAll = () => {
    if (selectedTasks.length === unassignedTasks.length) {
      setSelectedTasks([])
    } else {
      setSelectedTasks(unassignedTasks.map(task => task.id.toString()))
    }
  }

  const handlePreview = async () => {
    if (selectedTasks.length === 0) {
      toast.error("Vui lòng chọn ít nhất một công việc")
      return
    }

    setIsLoading(true)
    setIsPreviewMode(true)

    try {
      const response = await fetch(
        `/api/projects/${projectId}/auto-assign-raci?task_ids=${selectedTasks.join(',')}`,
        {
          method: 'GET'
        }
      )

      if (!response.ok) {
        throw new Error('Failed to get preview')
      }

      const data = await response.json()
      
      // For now, use the same logic as POST since GET is not fully implemented
      // In a real implementation, you'd have the preview logic in the GET endpoint
      toast.info("Preview chưa được implement đầy đủ. Sử dụng chế độ thực thi.")
      
    } catch (error: any) {
      console.error('Preview error:', error)
      toast.error('Không thể tạo preview: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAutoAssign = async () => {
    if (selectedTasks.length === 0) {
      toast.error("Vui lòng chọn ít nhất một công việc")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/projects/${projectId}/auto-assign-raci`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          task_ids: selectedTasks,
          max_concurrent_tasks: maxConcurrentTasks
        })
      })

      if (!response.ok) {
        throw new Error('Failed to auto-assign RACI')
      }

      const data = await response.json()
      
      setAssignments(data.assignments || [])
      setUnassigned(data.unassigned || [])
      setDebugInfo(data.debug)

      if (data.success) {
        toast.success(data.message)
        onSuccess()
      } else {
        toast.error(data.error || 'Có lỗi xảy ra')
      }

    } catch (error: any) {
      console.error('Auto-assign error:', error)
      toast.error('Không thể tự động phân công: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'todo': return 'bg-gray-100 text-gray-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'review': return 'bg-yellow-100 text-yellow-800'
      case 'blocked': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'todo': return 'Chưa bắt đầu'
      case 'in_progress': return 'Đang thực hiện'
      case 'review': return 'Đang xem xét'
      case 'blocked': return 'Bị chặn'
      default: return status
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Tự động phân công RACI
          </DialogTitle>
          <DialogDescription>
            Sử dụng thuật toán Experience Matrix và Hungarian Assignment để tự động phân công người thực hiện (R) cho các công việc.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Algorithm Info */}
          <Alert>
            <Brain className="h-4 w-4" />
            <AlertDescription>
              <strong>Thuật toán được sử dụng:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>• <strong>Experience Matrix:</strong> Tính toán kinh nghiệm dựa trên lịch sử làm việc và chất lượng</li>
                <li>• <strong>Hungarian Assignment:</strong> Phân công tối ưu với ràng buộc tối đa {maxConcurrentTasks} việc/người</li>
                <li>• <strong>Ưu tiên:</strong> Kinh nghiệm (40%) → Khối lượng công việc (30%) → Phù hợp kỹ năng (20%) → Sẵn sàng (10%)</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-4 w-4" />
                Cài đặt
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="maxTasks">Tối đa công việc đồng thời:</Label>
                  <Input
                    id="maxTasks"
                    type="number"
                    min="1"
                    max="5"
                    value={maxConcurrentTasks}
                    onChange={(e) => setMaxConcurrentTasks(parseInt(e.target.value) || 2)}
                    className="w-20"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Chọn công việc cần phân công ({selectedTasks.length}/{unassignedTasks.length})
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedTasks.length === unassignedTasks.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </Button>
              </CardTitle>
              <CardDescription>
                Chỉ hiển thị các công việc chưa hoàn thành và chưa được lưu trữ
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unassignedTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Tất cả công việc đã được phân công hoặc hoàn thành</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {unassignedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <Checkbox
                        id={task.id.toString()}
                        checked={selectedTasks.includes(task.id.toString())}
                        onCheckedChange={() => handleTaskToggle(task.id.toString())}
                      />
                      <div className="flex-1">
                        <Label htmlFor={task.id.toString()} className="font-medium cursor-pointer">
                          {task.name}
                        </Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="secondary" 
                            className={getStatusBadgeColor(task.status)}
                          >
                            {getStatusText(task.status)}
                          </Badge>
                          {task.duration_days && (
                            <span className="text-xs text-muted-foreground">
                              {task.duration_days} ngày
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {(assignments.length > 0 || unassigned.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  Kết quả phân công
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Successful assignments */}
                {assignments.length > 0 && (
                  <div>
                    <h4 className="font-medium text-green-700 mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Đã phân công ({assignments.length})
                    </h4>
                    <div className="space-y-2">
                      {assignments.map((assignment) => (
                        <div key={assignment.task_id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div>
                            <p className="font-medium">{assignment.task_name}</p>
                            <p className="text-sm text-muted-foreground">
                              → {assignment.user_name}
                            </p>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            <div>Độ tin cậy: {(assignment.confidence_score * 100).toFixed(1)}%</div>
                            <div>Kinh nghiệm: {(assignment.experience_score * 100).toFixed(1)}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unassigned tasks */}
                {unassigned.length > 0 && (
                  <div>
                    <h4 className="font-medium text-orange-700 mb-3 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Chưa phân công được ({unassigned.length})
                    </h4>
                    <div className="space-y-2">
                      {unassigned.map((task) => (
                        <div key={task.task_id} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <p className="font-medium">{task.task_name}</p>
                          <p className="text-sm text-muted-foreground">{task.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Debug info */}
                {debugInfo && (
                  <div className="text-xs text-muted-foreground bg-gray-50 p-3 rounded">
                    <strong>Thông tin debug:</strong>
                    <ul className="mt-1 space-y-1">
                      <li>• Tổng số công việc: {debugInfo.total_tasks}</li>
                      <li>• Tổng số thành viên: {debugInfo.total_users}</li>
                      <li>• Thành viên có thể nhận việc: {debugInfo.available_users}</li>
                      <li>• Thuật toán: {debugInfo.algorithm_used}</li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Đóng
            </Button>
            
            {selectedTasks.length > 0 && assignments.length === 0 && (
              <>
                <Button
                  variant="outline"
                  onClick={handlePreview}
                  disabled={isLoading}
                >
                  {isLoading && isPreviewMode ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="mr-2 h-4 w-4" />
                  )}
                  Xem trước
                </Button>
                
                <Button
                  onClick={handleAutoAssign}
                  disabled={isLoading}
                >
                  {isLoading && !isPreviewMode ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Thực hiện phân công
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
