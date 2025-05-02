import type { Task as BaseTask, RaciRole } from "./table-types"

// Extended Task type with additional properties used in the UI
export interface Task extends BaseTask {
  // Base properties from table-types

  // Extended properties for UI
  min_duration_hours?: number
  max_duration_hours?: number
  max_retries?: number
  dependencies?: Array<string | { task_id?: string; depends_on_id?: string }>
  description?: string
  due_date?: string | null
  skills?: Array<{ id: number; name: string }>
  task_raci?: Array<{
    id: number
    role: RaciRole
    users?: {
      full_name?: string
      position?: string
      org_unit?: string
    }
  }>
  phases?: {
    name: string
  }
}

// Risk prediction result type
export interface RiskPredictionResult {
  riskLevel: number
  riskScore: number
  riskFactors: string[]
  recommendations: string[]
}

// Task weight calculation result type
export interface TaskWeightResult {
  complexity: number
  timeWeight: number
  retryWeight: number
  dependencyWeight: number
  skillComplexity: number
}

// Estimated time calculation result type
export interface EstimatedTimeResult {
  estimatedTime: number
  displayTime: number
  timeUnit: "hour" | "day" | "week" | "month" | "year"
  confidence: number
  details: {
    weeks: number
    days: number
    hours: number
  }
}
