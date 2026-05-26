export interface GanttChartProps {
  projectId: string
  onOptimize?: (results: any) => void
  showOptimizationResults?: boolean
}

export interface Task {
  id: string
  name: string
  duration_days: number
  status: string
  progress: number
  assigned_to?: string
  assigned_user_name?: string
  dependencies: string[]
  is_overdue: boolean
  is_critical_path?: boolean
  calculated_start_date?: string
  calculated_end_date?: string
  level?: number
  has_dependencies?: boolean
}

export interface OptimizationResult {
  algorithm_used: string
  original_makespan: number
  optimized_makespan: number
  improvement_percentage: number
  resource_utilization: number
  critical_path: string[]
  optimized_schedule: Task[]
  duration_analysis?: {
    total_task_duration: number
    original_parallel_duration: number
    optimized_parallel_duration: number
    duration_reduction: number
    parallel_tasks_count: number
  }
  critical_path_details?: {
    criticalPath: string[]
    criticalPathDuration: number
    totalDuration: number
    explanation: string
    taskDetails: Array<{
      taskId: string
      taskName: string
      duration: number
      slack: number
      isCritical: boolean
      reason: string
    }>
  }
}

export type ViewModeType = "day" | "week" | "month"


