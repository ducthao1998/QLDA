'use client'

import { useState, useEffect } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { HelpCircle, TrendingUp, Users, Target, Star } from 'lucide-react'
import Link from 'next/link'

interface AssignmentExplanation {
  user: {
    id: string
    name: string
    position: string
    org_unit: string
  }
  task: {
    id: string
    name: string
  }
  scores: {
    total_score: number
    field_experience: number
    workload_balance: number
    skill_coverage: number
    specialization: number
  }
  workload: {
    current_tasks: number
    projects_count: number
    level: string
  }
  skills: Array<{
    skill_id: number
    skill_name: string
    experience_score: number
    level: string
  }>
  reasons: string[]
  raci_recommendations: {
    R: { score: number; recommendation: string; explanation: string }
    A: { score: number; recommendation: string; explanation: string }
    C: { score: number; recommendation: string; explanation: string }
    I: { score: number; recommendation: string; explanation: string }
  }
  recommendation: string
}

interface AssignmentExplanationTooltipProps {
  taskId: string
  userId: string
  children: React.ReactNode
  isAutoAssigned?: boolean
}

export function AssignmentExplanationTooltip({ 
  taskId, 
  userId, 
  children, 
  isAutoAssigned = false 
}: AssignmentExplanationTooltipProps) {
  const [explanation, setExplanation] = useState<AssignmentExplanation | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workloadSummary, setWorkloadSummary] = useState<{active_in_progress: number; completed_with_required_skills: number} | null>(null)
  const [raciCounts, setRaciCounts] = useState<{ R: number; A: number } | null>(null)
  const [recentRA, setRecentRA] = useState<Array<{ role: 'R' | 'A'; task_id: string; task_name: string }>>([])
  const [completedRaciCounts, setCompletedRaciCounts] = useState<{ R: number; A: number } | null>(null)

  const loadExplanation = async () => {
    if (loading) return
    
    try {
      setLoading(true)
      setError(null)
      
      if (isAutoAssigned && !explanation) {
        const response = await fetch(`/api/tasks/${taskId}/assignment-explanation?user_id=${userId}`)
        if (!response.ok) throw new Error('Không thể tải thông tin giải thích')
        const data = await response.json()
        setExplanation(data)
      }

      // Load workload summary (counts) using server API
      if (isAutoAssigned) {
        try {
          const wsRes = await fetch(`/api/user/${userId}/workload-summary?task_id=${taskId}`)
          if (wsRes.ok) {
            const ws = await wsRes.json()
            setWorkloadSummary(ws)
          }
        } catch {}
      }

      // Load R/A history counts and short list
      try {
        const hRes = await fetch(`/api/user/${userId}/raci-history`)
        if (hRes.ok) {
          const h = await hRes.json()
          const counts = h?.role_counts || { R: 0, A: 0, C: 0, I: 0 }
          setRaciCounts({ R: counts.R || 0, A: counts.A || 0 })
          const historyAll: any[] = h?.raci_history || []
          // Count completed tasks by role (R/A) from history
          try {
            if (h?.completed_role_counts) {
              setCompletedRaciCounts({ R: h.completed_role_counts.R || 0, A: h.completed_role_counts.A || 0 })
            } else {
              const doneSet = new Set(["done", "completed", "hoan_thanh"]) // fallback
              const completedR = historyAll.filter((r: any) => String(r.role) === 'R' && doneSet.has(String(r.status || '').toLowerCase())).length
              const completedA = historyAll.filter((r: any) => String(r.role) === 'A' && doneSet.has(String(r.status || '').toLowerCase())).length
              setCompletedRaciCounts({ R: completedR, A: completedA })
            }
          } catch {}

          const hist: Array<{ role: 'R' | 'A'; task_id: string; task_name: string }> = historyAll
            .filter((r: any) => r.role === 'R' || r.role === 'A')
            .slice(0, 2)
            .map((r: any) => ({ role: r.role, task_id: r.task_id, task_name: r.task_name }))
          setRecentRA(hist)
        }
      } catch {}
    } catch (err: any) {
      console.error('Error loading assignment explanation:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Luôn hiển thị tooltip (kể cả không auto-assign),
  // nội dung sẽ tối giản nếu chưa có explanation

  const toLevel = (score: number) => {
    if (score >= 80) return 'Cao'
    if (score >= 60) return 'Vừa'
    return 'Thấp'
  }

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'Rất phù hợp': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'Phù hợp': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'Có thể phù hợp': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      default: return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild onMouseEnter={loadExplanation}>
        <div className="flex items-center gap-1">
          {children}
          <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-primary cursor-help" />
        </div>
      </TooltipTrigger>
        <TooltipContent side="top" align="center" sideOffset={8} avoidCollisions collisionPadding={16} className="max-w-md md:max-w-lg p-4 bg-background border border-border shadow-lg rounded-lg text-left break-words max-h-[60vh] overflow-auto">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : error ? (
            <div className="text-red-600 dark:text-red-400 text-sm">
              <p>❌ {error}</p>
            </div>
          ) : explanation ? (
            <div className="space-y-3">
              {(() => {
                // unify active workload source
                const currentActive = (workloadSummary?.active_in_progress ?? explanation.workload?.current_tasks ?? 0)
                ;(explanation as any).__currentActive = currentActive
                return null
              })()}
              {/* Header */}
              <div>
                <p className="font-semibold text-sm text-foreground">{explanation.user.name}</p>
                <p className="text-xs text-muted-foreground">{explanation.user.position}</p>
                <Badge 
                  variant="secondary" 
                  className={`text-xs mt-1 ${getRecommendationColor(explanation.recommendation)}`}
                >
                  {explanation.recommendation}
                </Badge>
              </div>

              {/* Summary */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3 w-3 text-muted-foreground" />
                  <span className="text-foreground">Đánh giá tổng quan: <span className="font-medium">{explanation.recommendation}</span></span>
                </div>
                {completedRaciCounts && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Đã hoàn thành:</span>
                    <span className="text-foreground"><span className="font-medium">{(completedRaciCounts.R + completedRaciCounts.A)}</span> việc</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Kinh nghiệm:</span>
                    <span className="text-foreground">{/* hidden granular level */}Đã từng thực hiện</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Khối lượng hiện tại:</span>
                    <span className="text-foreground">{(explanation as any).__currentActive > 0 ? 'Đang bận' : 'Đang rảnh'}</span>
                  </div>
                  {/* Hide other granular metrics */}
                </div>
              </div>

              {/* Recent R/A assignments (concise, with links) */}
              {recentRA.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">Gần đây:</span>
                  </div>
                  <div className="space-y-0.5">
                    {recentRA.map((it, idx) => (
                      <div key={`${it.role}-${it.task_id}-${idx}`} className="text-xs truncate">
                        <Badge variant="outline" className="mr-1 text-[10px] px-1 py-0">{it.role}</Badge>
                        <Link href={`/dashboard/tasks/${it.task_id}/edit`} className="underline text-foreground hover:text-primary truncate align-middle">
                          {it.task_name || it.task_id}
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Current status with counts required */}
              <div className="flex items-center gap-2 text-xs">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="text-foreground">
                  Đang thực hiện: <span className="font-medium">{(explanation as any).__currentActive}</span> việc
                </span>
              </div>

              {/* Skills done (list of related skills) */}
              {explanation.skills.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Target className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">Những việc đã làm:</span>
                  </div>
                  <div className="space-y-1">
                    {explanation.skills.map((skill) => (
                      <div key={skill.skill_id} className="flex items-center justify-between text-xs">
                        <span className="truncate text-foreground">{skill.skill_name}</span>
                        <Badge variant="outline" className="text-xs">{skill.level}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reasons */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Star className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">Lý do chọn:</span>
                </div>
                <div className="space-y-1">
                  {explanation.reasons.map((reason, index) => (
                    <p key={index} className="text-xs text-muted-foreground">
                      {reason}
                    </p>
                  ))}
                </div>
              </div>

              {/* Remove reasons and RACI recommendations per requirement */}
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {raciCounts && (
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-medium">Kinh nghiệm vai trò</span>
                  <span className="text-foreground">R: <span className="font-medium">{raciCounts.R}</span></span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-foreground">A: <span className="font-medium">{raciCounts.A}</span></span>
                </div>
              )}
              {recentRA.length > 0 ? (
                <div>
                  <span className="text-muted-foreground">Gần đây:</span>
                  <div className="space-y-0.5 mt-1">
                    {recentRA.map((it, idx) => (
                      <div key={`${it.role}-${it.task_id}-${idx}`} className="text-xs truncate">
                        <Badge variant="outline" className="mr-1 text-[10px] px-1 py-0">{it.role}</Badge>
                        <Link href={`/dashboard/tasks/${it.task_id}/edit`} className="underline text-foreground hover:text-primary truncate align-middle">
                          {it.task_name || it.task_id}
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Di chuột để tải kinh nghiệm R/A...</p>
              )}
            </div>
          )}
        </TooltipContent>
    </Tooltip>
  )
}
