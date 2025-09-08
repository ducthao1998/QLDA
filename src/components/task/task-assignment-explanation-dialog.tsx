"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Play, 
  Pause, 
  Archive,
  Info,
  X,
  Bot
} from "lucide-react"

interface UnavailableUser {
  user_id: string
  full_name: string
  position?: string
  org_unit?: string
  current_workload: number
  max_concurrent_tasks: number
  current_tasks: Array<{
    task_id: string
    task_name: string
    project_name: string
    status: string
    duration_days?: number
  }>
  workload_percentage: number
  reason: 'overloaded' | 'no_skills' | 'unavailable'
  experience_score?: number
}

interface TaskAssignmentExplanationDialogProps {
  isOpen: boolean
  onClose: () => void
  unavailableUsers: UnavailableUser[]
  requiredSkills: string[]
  taskName: string
}

export function TaskAssignmentExplanationDialog({
  isOpen,
  onClose,
  unavailableUsers,
  requiredSkills,
  taskName
}: TaskAssignmentExplanationDialogProps) {
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'done':
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'in_progress':
        return <Play className="h-4 w-4 text-blue-500" />
      case 'review':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'blocked':
        return <Pause className="h-4 w-4 text-red-500" />
      case 'archived':
        return <Archive className="h-4 w-4 text-gray-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      'todo': { label: 'Chưa bắt đầu', variant: 'outline' },
      'in_progress': { label: 'Đang thực hiện', variant: 'default' },
      'review': { label: 'Đang xem xét', variant: 'secondary' },
      'done': { label: 'Hoàn thành', variant: 'default' },
      'completed': { label: 'Hoàn thành', variant: 'default' },
      'blocked': { label: 'Bị chặn', variant: 'destructive' },
      'archived': { label: 'Lưu trữ', variant: 'outline' }
    }
    
    const statusInfo = statusMap[status.toLowerCase()] || { label: status, variant: 'outline' as const }
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
  }

  const getReasonText = (reason: string) => {
    switch (reason) {
      case 'overloaded':
        return 'Đã đạt giới hạn công việc đồng thời'
      case 'no_skills':
        return 'Không có kỹ năng phù hợp'
      case 'unavailable':
        return 'Không khả dụng'
      default:
        return 'Không xác định'
    }
  }

  const getReasonColor = (reason: string) => {
    switch (reason) {
      case 'overloaded':
        return 'text-orange-600'
      case 'no_skills':
        return 'text-blue-600'
      case 'unavailable':
        return 'text-gray-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[90vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Không thể tự động gán người cho: "{taskName}"
          </DialogTitle>
          <DialogDescription>
            Thuật toán không tìm thấy người phù hợp để gán cho công việc này. Dưới đây là lý do tại sao các thành viên không khả dụng:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          {/* Required Skills Info */}
          {requiredSkills.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Kỹ năng yêu cầu:</strong> {requiredSkills.join(', ')}
              </AlertDescription>
            </Alert>
          )}

          {/* Unavailable Users */}
          <div className="space-y-3">
            {unavailableUsers.map((user) => (
              <Card key={user.user_id} className="border-l-4 border-l-orange-400">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.full_name}`} />
                        <AvatarFallback>
                          {user.full_name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">{user.full_name}</CardTitle>
                        <CardDescription className="text-sm">
                          {user.position && `${user.position} • `}{user.org_unit}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="mb-1">
                        {user.current_workload}/{user.max_concurrent_tasks} công việc
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        {getReasonText(user.reason)}
                      </div>
                      {user.experience_score && (
                        <div className="text-xs text-blue-600 mt-1">
                          Điểm kinh nghiệm: {Math.round(user.experience_score * 100)}%
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Workload Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Mức độ bận rộn</span>
                      <span className={user.workload_percentage > 80 ? "text-red-600 font-medium" : 
                                     user.workload_percentage > 60 ? "text-orange-600 font-medium" : ""}>
                        {user.workload_percentage}%
                      </span>
                    </div>
                    <Progress 
                      value={user.workload_percentage} 
                      className={user.workload_percentage > 80 ? "bg-red-100" : ""}
                    />
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {/* Current Tasks */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Công việc hiện tại ({user.current_tasks.length}):
                    </h4>
                    <div className="space-y-2">
                      {user.current_tasks.map((task) => (
                        <div key={task.task_id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {getStatusIcon(task.status)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{task.task_name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {task.project_name}
                                {task.duration_days && ` • ${task.duration_days} ngày`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {getStatusBadge(task.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Suggestions */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Gợi ý:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>• Tăng giới hạn công việc đồng thời cho một số thành viên</li>
                <li>• Hoàn thành một số công việc đang chờ để giải phóng người</li>
                <li>• Thêm kỹ năng cho các thành viên chưa có đủ kỹ năng</li>
                <li>• Phân công thủ công dựa trên khả năng hiện tại</li>
                <li>• Xem xét gán người có kinh nghiệm thấp hơn nhưng rảnh rỗi</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>

        <div className="flex justify-end pt-4 border-t mt-4 flex-shrink-0">
          <Button onClick={onClose} variant="outline">
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
