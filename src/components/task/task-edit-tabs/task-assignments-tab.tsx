'use client'

import { useState, useEffect } from 'react'
import type { Task, User, RaciRole, TaskRaci } from '@/app/types/table-types'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info, AlertCircle, Bot, Loader2, HelpCircle } from 'lucide-react'
import { AssignmentExplanationTooltip } from '../assignment-explanation-tooltip'
import { TaskAssignmentExplanationDialog } from '../task-assignment-explanation-dialog'

export type RaciAssignment = {
  user_id: string
  role: RaciRole
}

interface TaskAssignmentsTabProps {
  task: Task
  // Callback to pass RACI changes to parent form
  onRaciChange?: (assignments: RaciAssignment[]) => void
  // Initial RACI assignments
  initialAssignments?: RaciAssignment[]
  // Project ID for auto assignment
  projectId?: string
}

const roleDescriptions = {
  R: 'Responsible - Người thực hiện chính',
  A: 'Accountable - Người chịu trách nhiệm cuối cùng',
  C: 'Consulted - Người được tham vấn',
  I: 'Informed - Người được thông báo'
}

export function TaskAssignmentsTab({ task, onRaciChange, initialAssignments = [], projectId }: TaskAssignmentsTabProps) {
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [raci, setRaci] = useState<RaciAssignment[]>(initialAssignments)
  const [loading, setLoading] = useState(true)
  const [loadingRaci, setLoadingRaci] = useState(true)
  const [hasChanges, setHasChanges] = useState(false)
  const [isAutoAssigning, setIsAutoAssigning] = useState(false)
  const [autoAssignedUsers, setAutoAssignedUsers] = useState<Set<string>>(new Set())
  const [showExplanationDialog, setShowExplanationDialog] = useState(false)
  const [unavailableUsers, setUnavailableUsers] = useState<any[]>([])
  const [requiredSkills, setRequiredSkills] = useState<string[]>([])

  // Load users on mount
  useEffect(() => {
    loadUsers()
  }, [])

  // Load RACI data when task changes
  useEffect(() => {
    if (task?.id) {
      loadRaciData()
    }
  }, [task.id])

  // Notify parent of RACI changes
  useEffect(() => {
    if (onRaciChange) {
      onRaciChange(raci)
    }
  }, [raci, onRaciChange])

  const loadUsers = async () => {
    try {
      const usersRes = await fetch('/api/user')
      if (!usersRes.ok) {
        throw new Error(`Failed to fetch users: ${usersRes.status}`)
      }
      const usersData = await usersRes.json()
      const users = usersData.users || usersData.data || []
      setAllUsers(users)
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Không thể tải danh sách người dùng.')
    } finally {
      setLoading(false)
    }
  }

  const loadRaciData = async () => {
    try {
      setLoadingRaci(true)
      const raciRes = await fetch(`/api/tasks/${task.id}/raci`)
      
      if (!raciRes.ok) {
        console.warn(`No RACI data found for task ${task.id}`)
        setRaci([])
        return
      }
      
      const raciData = await raciRes.json()
      const raciAssignments = raciData.raci || raciData.data || []
      const currentRaci = raciAssignments.map((r: TaskRaci) => ({ 
        user_id: r.user_id, 
        role: r.role 
      }))
      
      setRaci(currentRaci)
    } catch (error) {
      console.error('Error fetching RACI data:', error)
    } finally {
      setLoadingRaci(false)
    }
  }

  const handleRaciChange = (userId: string, role: RaciRole) => {
    setRaci(prevRaci => {
      let newRaci = [...prevRaci]
      const existingAssignmentIndex = newRaci.findIndex(a => a.user_id === userId)

      // Only one person can be 'R' (Responsible)
      if (role === 'R') {
        const currentRIndex = newRaci.findIndex(a => a.role === 'R')
        if (currentRIndex > -1 && newRaci[currentRIndex].user_id !== userId) {
          // Demote current R to A
          newRaci[currentRIndex].role = 'A'
        }
      }
      
      if (existingAssignmentIndex > -1) {
        if (newRaci[existingAssignmentIndex].role === role) {
          // If clicking same role, remove assignment
          newRaci.splice(existingAssignmentIndex, 1)
        } else {
          // Change role
          newRaci[existingAssignmentIndex].role = role
        }
      } else {
        // Add new assignment
        newRaci.push({ user_id: userId, role })
      }
      
      return newRaci
    })
    
    setHasChanges(true)
  }

  // Get user name by id
  const getUserName = (userId: string) => {
    const user = allUsers.find(u => u.id === userId)
    return user?.full_name || 'Unknown User'
  }

  const handleAutoAssign = async () => {
    if (!projectId || !task.id) {
      toast.error('Thiếu thông tin dự án hoặc công việc')
      return
    }

    try {
      setIsAutoAssigning(true)
      
      const response = await fetch(`/api/tasks/auto-assign-raci`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_ids: [task.id],
          project_id: projectId,
          max_concurrent_tasks: 2
        })
      })

      if (!response.ok) {
        throw new Error('Không thể tự động phân công')
      }

      const result = await response.json()
      
      if (result.success && result.assignments.length > 0) {
        const assignment = result.assignments[0]
        
        // Cập nhật RACI với kết quả auto assign
        setRaci([{
          user_id: assignment.user_id,
          role: 'R' as RaciRole
        }])
        
        // Track user được auto-assign
        setAutoAssignedUsers(new Set([assignment.user_id]))
        
        setHasChanges(true)
        
        const otherRoles = assignment.other_assignments || []
        const roleText = otherRoles.length > 0 
          ? ` (R) + ${otherRoles.map((r: any) => r.role).join(', ')}`
          : ' (R)'
        
        toast.success(
          `Đã tự động phân công cho ${assignment.user_name}${roleText}`
        )
      } else {
        // No assignments made, show explanation dialog
        if (result.unavailable_users && result.unavailable_users.length > 0) {
          setUnavailableUsers(result.unavailable_users)
          setRequiredSkills(result.required_skills || [])
          setShowExplanationDialog(true)
        } else if (result.unassigned && result.unassigned.length > 0) {
          toast.warning(`Không thể tự động phân công: ${result.unassigned[0].reason}`)
        } else {
          toast.warning('Không tìm thấy người phù hợp để phân công')
        }
      }
      
    } catch (error) {
      console.error('Error auto assigning:', error)
      toast.error('Có lỗi xảy ra khi tự động phân công')
    } finally {
      setIsAutoAssigning(false)
    }
  }

  if (loading || loadingRaci) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Phân công Trách nhiệm (RACI)</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (allUsers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Phân công Trách nhiệm (RACI)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-2" />
            <p>Không có người dùng nào trong hệ thống.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Phân công Trách nhiệm (RACI)</CardTitle>
        <CardDescription>
          Chọn vai trò cho từng cán bộ. Một công việc chỉ có một người thực hiện chính (R).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasChanges && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Có thay đổi chưa được lưu. Nhấn "Lưu tất cả thay đổi" ở cuối form để cập nhật.
            </p>
          </div>
        )}

        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Giải thích vai trò:</p>
            {projectId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoAssign}
                disabled={isAutoAssigning}
                className="gap-2"
              >
                {isAutoAssigning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang phân công...
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4" />
                    Tự động phân công
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(roleDescriptions).map(([role, desc]) => (
              <div key={role} className="flex items-center gap-2">
                <Badge variant="outline" className="w-8 justify-center">{role}</Badge>
                <span className="text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto pr-2 border rounded-lg p-2">
          {allUsers.map(user => {
            const assignment = raci.find(a => a.user_id === user.id)
            return (
              <div key={user.id} className="p-3 border rounded-md flex items-center justify-between transition-all hover:bg-muted/50">
                <div>
                  <p className="font-medium">{user.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {user.position} • {user.org_unit}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {(['R', 'A', 'C', 'I'] as RaciRole[]).map(role => (
                    <Button
                      key={role}
                      type="button"
                      variant={assignment?.role === role ? 'default' : 'outline'}
                      size="sm"
                      className="w-10"
                      onClick={() => handleRaciChange(user.id, role)}
                      title={roleDescriptions[role]}
                    >
                      {role}
                    </Button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Show current assignments summary */}
        {raci.length > 0 && (
          <div className="mt-4 p-3 bg-muted/30 rounded-lg">
            <p className="text-sm font-medium mb-2">Phân công hiện tại:</p>
            <div className="space-y-1">
              {raci.map(assignment => {
                const isAutoAssigned = autoAssignedUsers.has(assignment.user_id) && assignment.role === 'R'
                return (
                  <div key={assignment.user_id} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="w-8 justify-center">
                      {assignment.role}
                    </Badge>
                    {isAutoAssigned ? (
                      <AssignmentExplanationTooltip
                        taskId={task.id.toString()}
                        userId={assignment.user_id}
                        isAutoAssigned={true}
                      >
                        <div className="flex items-center gap-1">
                          <span>{getUserName(assignment.user_id)}</span>
                          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                            <Bot className="h-3 w-3 mr-1" />
                            Auto
                          </Badge>
                        </div>
                      </AssignmentExplanationTooltip>
                    ) : (
                      <span>{getUserName(assignment.user_id)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>

      {/* Explanation Dialog */}
      <TaskAssignmentExplanationDialog
        isOpen={showExplanationDialog}
        onClose={() => setShowExplanationDialog(false)}
        unavailableUsers={unavailableUsers}
        requiredSkills={requiredSkills}
        taskName={task.name}
      />
    </Card>
  )
}
