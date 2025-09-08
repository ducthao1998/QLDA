'use client'

import { useState, useEffect } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { HelpCircle, TrendingUp, Users, Target, Star } from 'lucide-react'

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

  const loadExplanation = async () => {
    if (!isAutoAssigned || explanation) return // Chỉ load khi cần thiết
    
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/tasks/${taskId}/assignment-explanation?user_id=${userId}`)
      
      if (!response.ok) {
        throw new Error('Không thể tải thông tin giải thích')
      }
      
      const data = await response.json()
      setExplanation(data)
    } catch (err: any) {
      console.error('Error loading assignment explanation:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isAutoAssigned) {
    return <>{children}</>
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400'
    if (score >= 60) return 'text-blue-600 dark:text-blue-400'
    if (score >= 40) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild onMouseEnter={loadExplanation}>
          <div className="flex items-center gap-1">
            {children}
            <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-primary cursor-help" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-sm p-4 bg-background border border-border">
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

              {/* Scores */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">Điểm tổng:</span>
                  <span className={`text-xs font-bold ${getScoreColor(explanation.scores.total_score)}`}>
                    {explanation.scores.total_score}%
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kinh nghiệm:</span>
                    <span className={getScoreColor(explanation.scores.field_experience)}>
                      {explanation.scores.field_experience}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Khối lượng:</span>
                    <span className={getScoreColor(explanation.scores.workload_balance)}>
                      {explanation.scores.workload_balance}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kỹ năng:</span>
                    <span className={getScoreColor(explanation.scores.skill_coverage)}>
                      {explanation.scores.skill_coverage}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Chuyên môn:</span>
                    <span className={getScoreColor(explanation.scores.specialization)}>
                      {explanation.scores.specialization}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Workload */}
              <div className="flex items-center gap-2 text-xs">
                <Users className="h-3 w-3 text-muted-foreground" />
                <span className="text-foreground">
                  {explanation.workload.current_tasks} việc, {explanation.workload.projects_count} dự án
                </span>
                <Badge variant="outline" className="text-xs">
                  {explanation.workload.level}
                </Badge>
              </div>

              {/* Skills */}
              {explanation.skills.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Target className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">Kỹ năng yêu cầu:</span>
                  </div>
                  <div className="space-y-1">
                    {explanation.skills.map((skill) => (
                      <div key={skill.skill_id} className="flex items-center justify-between text-xs">
                        <span className="truncate text-foreground">{skill.skill_name}</span>
                        <div className="flex items-center gap-1">
                          <span className={getScoreColor(skill.experience_score * 100)}>
                            {Math.round(skill.experience_score * 100)}%
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {skill.level}
                          </Badge>
                        </div>
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

              {/* RACI Recommendations */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">Đề xuất vai trò RACI:</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(explanation.raci_recommendations).map(([role, rec]) => (
                    <div key={role} className="p-2 bg-muted/30 rounded text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-xs w-6 h-5 flex items-center justify-center">
                          {role}
                        </Badge>
                        <span className={`text-xs font-medium ${
                          rec.recommendation === 'Rất phù hợp' ? 'text-green-600' :
                          rec.recommendation === 'Phù hợp' ? 'text-blue-600' :
                          rec.recommendation === 'Có thể phù hợp' ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {rec.recommendation}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-tight">
                        {rec.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Hover để xem giải thích...
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
