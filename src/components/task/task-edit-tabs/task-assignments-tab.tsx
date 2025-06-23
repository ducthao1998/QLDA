'use client'

import { useState, useEffect, useMemo } from 'react'
import type { Task, User as AllUser, RaciRole, TaskRaci } from '@/app/types/table-types'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, UserCheck, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'

// Kiểu dữ liệu cho người dùng được đề xuất
interface RecommendedUser {
  user_id: string
  full_name: string
  completed_tasks_count: number
  workload: number
}

// Kiểu dữ liệu cho việc phân công RACI
type RaciAssignment = {
  user_id: string
  role: RaciRole
}

interface TaskAssignmentsTabProps {
  task: Task
  onUpdate: (updatedTask: Partial<Task>) => Promise<void>
}

export function TaskAssignmentsTab({ task, onUpdate }: TaskAssignmentsTabProps) {
  const [recommendedUsers, setRecommendedUsers] = useState<RecommendedUser[]>([])
  const [allUsers, setAllUsers] = useState<AllUser[]>([])
  const [raci, setRaci] = useState<RaciAssignment[]>([])
  const [initialRaci, setInitialRaci] = useState<RaciAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Fetch tất cả dữ liệu cần thiết
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [recRes, usersRes, raciRes] = await Promise.all([
          fetch(`/api/projects/${task.project_id}/tasks/${task.id}/recommended-users`),
          fetch('/api/users'),
          fetch(`/api/tasks/${task.id}/raci`),
        ])

        const recData = await recRes.json()
        const usersData = await usersRes.json()
        const raciData = await raciRes.json()
        
        if (recRes.ok) setRecommendedUsers(recData)
        if (usersRes.ok) setAllUsers(usersData.data || [])
        if (raciRes.ok) {
            const currentRaci = raciData.map((r: TaskRaci) => ({ user_id: r.user_id, role: r.role }))
            setRaci(currentRaci)
            setInitialRaci(currentRaci) // Lưu trạng thái ban đầu để so sánh
        }

      } catch (error) {
        toast.error('Không thể tải dữ liệu phân công.')
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [task.id, task.project_id])

  // Xử lý khi thay đổi vai trò RACI
  const handleRaciChange = (userId: string, role: RaciRole) => {
    setRaci(prevRaci => {
      const newRaci = [...prevRaci]
      const existingAssignmentIndex = newRaci.findIndex(a => a.user_id === userId)

      if (role === 'R') {
        // Chỉ có một người được làm 'R'
        // Xóa vai trò 'R' cũ nếu có
        const oldRIndex = newRaci.findIndex(a => a.role === 'R')
        if (oldRIndex > -1) {
            newRaci.splice(oldRIndex, 1)
        }
      }

      if (existingAssignmentIndex > -1) {
        // Nếu user đã có vai trò
        if (newRaci[existingAssignmentIndex].role === role) {
          // Bỏ chọn nếu click lại vai trò cũ
          newRaci.splice(existingAssignmentIndex, 1)
        } else {
          // Chuyển vai trò
          newRaci[existingAssignmentIndex].role = role
        }
      } else {
        // Thêm vai trò mới
        newRaci.push({ user_id: userId, role })
      }
      return newRaci
    })
  }
  
  // Lưu thay đổi
  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
        // Tìm người chịu trách nhiệm chính (R)
        const responsibleUser = raci.find(r => r.role === 'R');
        
        // Cập nhật trường assigned_to của task
        await onUpdate({ assigned_to: responsibleUser?.user_id || null });

        // Cập nhật các bản ghi trong task_raci
        // Đây là logic đơn giản, thực tế cần so sánh initialRaci và raci để biết cái nào cần ADD, UPDATE, DELETE
        // Tạm thời xóa hết và thêm lại cho đơn giản
        await fetch(`/api/tasks/${task.id}/raci?deleteAll=true`, { method: 'DELETE' });

        if (raci.length > 0) {
            const res = await fetch(`/api/tasks/${task.id}/raci`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(raci),
            });
            if (!res.ok) throw new Error("Cập nhật RACI thất bại");
        }
        
        toast.success('Đã cập nhật phân công thành công!');
        setInitialRaci(raci) // Cập nhật trạng thái ban đầu
    } catch (error) {
        toast.error('Lưu thất bại.');
        console.error(error);
    } finally {
        setIsSaving(false);
    }
  }

  // Memoize để kiểm tra xem có thay đổi không
  const hasChanges = useMemo(() => {
    return JSON.stringify(raci.sort((a,b) => a.user_id.localeCompare(b.user_id))) !== JSON.stringify(initialRaci.sort((a,b) => a.user_id.localeCompare(b.user_id)));
  }, [raci, initialRaci])


  if (loading) {
    return <Skeleton className="h-48 w-full" />
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Phân công Trách nhiệm (RACI)</h3>
        <p className="text-sm text-muted-foreground">
          Chọn vai trò cho từng thành viên. (R: Thực hiện, A: Chịu trách nhiệm, C: Tư vấn, I: Theo dõi)
        </p>
      </div>

      <div className="space-y-4">
        {allUsers.map(user => {
          const recommendation = recommendedUsers.find(rec => rec.user_id === user.id)
          const assignment = raci.find(a => a.user_id === user.id)
          return (
            <div key={user.id} className={`p-3 border rounded-md flex items-center justify-between transition-all ${recommendation ? 'border-primary/50 bg-primary/5' : ''}`}>
              <div className="flex items-center gap-3">
                <span className="font-medium">{user.full_name}</span>
                {recommendation && (
                  <HoverCard>
                    <HoverCardTrigger>
                      <Badge variant="secondary" className="cursor-help">
                        <UserCheck className="h-3 w-3 mr-1.5" />
                        Gợi ý
                      </Badge>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <div className="flex justify-between space-x-4">
                          <div className="space-y-1">
                              <h4 className="text-sm font-semibold">{user.full_name}</h4>
                              <p className="text-sm">
                                  Đây là gợi ý phù hợp cho công việc này.
                              </p>
                              <div className="flex items-center pt-2">
                                  <span className="text-xs text-muted-foreground">
                                      Kinh nghiệm: {recommendation.completed_tasks_count} việc, Đang bận: {recommendation.workload}/2 việc
                                  </span>
                              </div>
                          </div>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                )}
              </div>
              <div className="flex items-center gap-2">
                {(['R', 'A', 'C', 'I'] as RaciRole[]).map(role => (
                  <Button
                    key={role}
                    variant={assignment?.role === role ? 'default' : 'outline'}
                    size="sm"
                    className="w-10"
                    onClick={() => handleRaciChange(user.id, role)}
                  >
                    {role}
                  </Button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSaveChanges} disabled={isSaving || !hasChanges}>
          {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </Button>
      </div>
    </div>
  )
}
