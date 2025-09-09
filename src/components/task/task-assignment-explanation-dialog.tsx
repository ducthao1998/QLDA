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
  reason_text?: string
  experience_score?: number
  skill_experience?: Array<{
    skill_id: number
    skill_name?: string
    completed_tasks: number
  }>
  role_recommendations?: {
    R: { completed_tasks: number; reason: string }
    A: { completed_tasks: number; reason: string }
    C: { completed_tasks: number; reason: string }
    I: { completed_tasks: number; reason: string }
  }
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
          {requiredSkills && requiredSkills.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Kỹ năng yêu cầu:</strong> {requiredSkills.join(', ')}
              </AlertDescription>
            </Alert>
          )}

          {/* Unavailable Users */}
          <div className="space-y-3">
            {unavailableUsers && unavailableUsers.length > 0 ? (
              unavailableUsers
                // Chỉ hiển thị những người thực sự có liên quan và đáng chú ý
                .filter(user => {
                  // Nếu thực sự đang bận (overloaded) - kiểm tra workload thực tế
                  if (user.reason === 'overloaded' && user.current_workload >= user.max_concurrent_tasks) {
                    return true
                  }
                  
                  // Nếu có skill experience >= 3 (có kinh nghiệm đáng kể nhưng không được chọn)
                  if (user.skill_experience && 
                      user.skill_experience.some(exp => exp.completed_tasks >= 3)) {
                    return true
                  }
                  
                  // Không hiển thị những người không bận và ít kinh nghiệm
                  return false
                })
                .map((user) => (
                <Card key={user.user_id} className="border-l-4 border-l-orange-400">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.full_name || 'User'}`} />
                          <AvatarFallback>
                            {user.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base">{user.full_name || 'Unknown User'}</CardTitle>
                          <CardDescription className="text-sm">
                            {user.position && `${user.position} • `}{user.org_unit}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="mb-1">
                          {user.current_workload || 0}/{user.max_concurrent_tasks || 2} công việc
                        </Badge>
                        <div className="text-sm text-muted-foreground">
                          {user.reason_text || getReasonText(user.reason)}
                        </div>
                        {user.skill_experience && user.skill_experience.length > 0 && (
                          <div className="text-xs text-blue-600 mt-1">
                            Đã hoàn thành: {user.skill_experience.reduce((sum, exp) => sum + exp.completed_tasks, 0)} công việc liên quan
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    {/* Current Tasks */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">
                        Công việc hiện tại ({user.current_tasks?.length || 0}):
                      </h4>
                      <div className="space-y-2">
                        {user.current_tasks && user.current_tasks.map((task) => (
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

                    {/* Skill Experience Information */}
                    {user.skill_experience && user.skill_experience.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <h4 className="text-sm font-medium text-muted-foreground">
                          Kinh nghiệm với kỹ năng yêu cầu:
                        </h4>
                        <div className="space-y-1">
                          {user.skill_experience.map((exp, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                              <span className="text-sm">{exp.skill_name || `Kỹ năng ${exp.skill_id}`}</span>
                              <span className={`text-sm font-medium ${
                                exp.completed_tasks >= 5 ? 'text-green-600' : 
                                exp.completed_tasks >= 1 ? 'text-yellow-600' : 'text-gray-600'
                              }`}>
                                {exp.completed_tasks > 0 ? `${exp.completed_tasks} công việc` : 'Chưa có kinh nghiệm'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Không có thành viên nào có kinh nghiệm với kỹ năng yêu cầu. Có thể cần đào tạo hoặc tuyển thêm người có kỹ năng phù hợp.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Suggestions */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Gợi ý:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>• Tăng giới hạn công việc đồng thời cho những người có kinh nghiệm</li>
                <li>• Hoàn thành một số công việc đang chờ để giải phóng người có kinh nghiệm</li>
                <li>• Phân công thủ công cho người có ít kinh nghiệm nhưng rảnh rỗi</li>
                <li>• Đào tạo thêm kỹ năng cho các thành viên khác</li>
                <li>• Tuyển thêm người có kỹ năng phù hợp</li>
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
