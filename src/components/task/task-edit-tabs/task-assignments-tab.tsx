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
  const [userRaciHistory, setUserRaciHistory] = useState<Map<string, any>>(new Map())

  // Load users on mount
  useEffect(() => {
    loadUsers()
  }, [])

  // Load RACI history when users are loaded
  useEffect(() => {
    if (allUsers.length > 0) {
      loadRaciHistory()
    }
  }, [allUsers])

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

  const loadRaciHistory = async () => {
    try {
      const userIds = allUsers.map(u => u.id).filter(Boolean)
      if (userIds.length === 0) return
      const response = await fetch(`/api/user/raci-history?user_ids=${encodeURIComponent(userIds.join(','))}`)
      if (!response.ok) return
      const { histories } = await response.json()
      const historyMap = new Map<string, any>()
      for (const uid of Object.keys(histories || {})) {
        historyMap.set(uid, histories[uid])
      }
      setUserRaciHistory(historyMap)
    } catch (error) {
      console.error('Error loading RACI history:', error)
    }
  }

  const handleRaciChange = (userId: string, role: RaciRole) => {
    setRaci(prevRaci => {
      if (role === 'R') {
        const arr = prevRaci.filter(a => a.role !== 'R')
        const idx = arr.findIndex(a => a.user_id === userId)
        if (idx > -1) arr[idx] = { user_id: userId, role: 'R' }
        else arr.push({ user_id: userId, role: 'R' })
        return arr
      }
      if (role === 'A') {
        const arr = prevRaci.filter(a => a.role !== 'A')
        const idx = arr.findIndex(a => a.user_id === userId)
        if (idx > -1) arr[idx] = { user_id: userId, role: 'A' }
        else arr.push({ user_id: userId, role: 'A' })
        return arr
      }
      // C/I toggle
      const idx = prevRaci.findIndex(a => a.user_id === userId)
      if (idx > -1) {
        if (prevRaci[idx].role === role) return prevRaci.filter((_, i) => i !== idx)
        const arr = [...prevRaci]
        arr[idx] = { user_id: userId, role }
        return arr
      }
      return [...prevRaci, { user_id: userId, role }]
    })
    setHasChanges(true)
  }

  // Get user name by id
  const getUserName = (userId: string) => {
    const user = allUsers.find(u => u.id === userId) as any
    return user?.full_name ?? user?.name ?? 'Unknown User'
  }

  // Get role recommendations based on history
  const getRoleRecommendations = (userId: string) => {
    const history = userRaciHistory.get(userId)
    if (!history) return null

    const recommendations = {
      A: { count: 0, reason: 'Chưa từng đảm nhận vai trò A' },
      C: { count: 0, reason: 'Chưa từng đảm nhận vai trò C' },
      I: { count: 0, reason: 'Chưa từng đảm nhận vai trò I' }
    }

    // Count role history
    if (history.raci_history) {
      history.raci_history.forEach((raci: any) => {
        if (raci.role === 'A') {
          recommendations.A.count++
          recommendations.A.reason = `Đã từng đảm nhận ${recommendations.A.count} lần vai trò A`
        } else if (raci.role === 'C') {
          recommendations.C.count++
          recommendations.C.reason = `Đã từng đảm nhận ${recommendations.C.count} lần vai trò C`
        } else if (raci.role === 'I') {
          recommendations.I.count++
          recommendations.I.reason = `Đã từng đảm nhận ${recommendations.I.count} lần vai trò I`
        }
      })
    }

    return recommendations
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
      console.log('Auto assign result:', result)
      
      if (result.success && result.assignments && result.assignments.length > 0) {
        const assignment = result.assignments[0]

        const newRaciAssignments: RaciAssignment[] = []
        if (assignment.R) newRaciAssignments.push({ user_id: assignment.R.user_id, role: 'R' })
        if (assignment.A) newRaciAssignments.push({ user_id: assignment.A.user_id, role: 'A' })
        for (const uid of assignment.C || []) newRaciAssignments.push({ user_id: uid, role: 'C' })
        for (const uid of assignment.I || []) newRaciAssignments.push({ user_id: uid, role: 'I' })

        setRaci(newRaciAssignments)

        const autoAssignedUserIds = new Set<string>([
          ...(assignment.R ? [assignment.R.user_id] : []),
          ...(assignment.A ? [assignment.A.user_id] : []),
          ...((assignment.C || [])),
          ...((assignment.I || []))
        ])
        setAutoAssignedUsers(autoAssignedUserIds)
        setHasChanges(true)

        const rText = assignment.R
          ? `R: ${getUserName(assignment.R.user_id)} — Độ phù hợp ${Math.round((assignment.R.confidence_score || 0) * 100)}% | Kinh nghiệm ${Math.round((assignment.R.experience_score || 0) * 100)}%`
          : 'R: (chưa có)'
        const aText = assignment.A
          ? `A: ${getUserName(assignment.A.user_id)} — Điểm giám sát ${Math.round((assignment.A.accountable_score || 0) * 100)}%`
          : 'A: (chưa có)'

        toast.success(`✅ ${rText}\n${aText}`, { duration: 6000 })
      } else {
        // No assignments made - check if there are any assignments at all
        if (!result.assignments || result.assignments.length === 0) {
          // Truly no assignments, show explanation dialog
          if (result.unavailable_users && result.unavailable_users.length > 0) {
            setUnavailableUsers(result.unavailable_users)
            setRequiredSkills(result.required_skills || [])
            setShowExplanationDialog(true)
          } else if (result.unassigned && result.unassigned.length > 0) {
            toast.warning(`⚠️ Không thể tự động phân công: ${result.unassigned[0].reason}`)
          } else {
            toast.warning('⚠️ Không tìm thấy người phù hợp để phân công (độ tin cậy < 35%)')
          }
        } else {
          // There are assignments but success is false? This shouldn't happen
          toast.error('⚠️ Có lỗi trong quá trình phân công tự động')
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
    <TooltipProvider>
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

        <div className="space-y-2 max-h-96 overflow-y-auto pr-2 border rounded-lg p-2">
          {allUsers.map(user => {
            const assignment = raci.find(a => a.user_id === user.id)
            const isAutoAssigned = autoAssignedUsers.has(user.id) && assignment
            
            return (
              <div key={user.id} className={`p-3 border rounded-md transition-all hover:bg-muted/50 ${
                assignment ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <AssignmentExplanationTooltip
                      taskId={task.id.toString()}
                      userId={user.id}
                      isAutoAssigned={!!isAutoAssigned}
                    >
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{user.full_name}</p>
                        {isAutoAssigned && (
                          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                            <Bot className="h-3 w-3 mr-1" />
                            Auto
                          </Badge>
                        )}
                      </div>
                    </AssignmentExplanationTooltip>
                    <p className="text-sm text-muted-foreground">
                      {user.position} • {user.org_unit}
                    </p>
                  </div>
                  
                  {/* RACI Buttons - chỉ hiển thị khi chưa có assignment hoặc đang edit */}
                  <div className="flex items-center gap-1">
                    {assignment ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="w-8 justify-center">
                          {assignment.role}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRaciChange(user.id, assignment.role)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Thay đổi
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          {(['R', 'A', 'C', 'I'] as RaciRole[]).map(role => (
                            <Button
                              key={role}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="w-8 h-8 p-0"
                              onClick={() => handleRaciChange(user.id, role)}
                              title={roleDescriptions[role]}
                            >
                              {role}
                            </Button>
                          ))}
                        </div>
                        {/* Role Recommendations */}
                        {(() => {
                          const recommendations = getRoleRecommendations(user.id)
                          if (!recommendations) return null
                          
                          return (
                            <div className="flex gap-1 text-xs">
                              {(['A', 'C', 'I'] as const).map(role => (
                                <Tooltip key={role}>
                                  <TooltipTrigger asChild>
                                    <Badge 
                                      variant={recommendations[role].count > 0 ? "secondary" : "outline"}
                                      className="text-xs cursor-help"
                                    >
                                      {role}: {recommendations[role].count}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{recommendations[role].reason}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Quick Actions */}
        {raci.length > 0 && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Đã phân công {raci.length} vai trò
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRaci([])}
                className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50"
              >
                Xóa tất cả
              </Button>
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
    </TooltipProvider>
  )
}
