import { TaskWeightResult } from "@/app/types/task"

interface TaskWeightParams {
  min_duration_hours?: number
  max_duration_hours?: number
  max_retries?: number
  dependencies?: any[]
  skill_complexity?: number
}

export function calculateTaskWeight(params: TaskWeightParams): TaskWeightResult {
  const {
    min_duration_hours = 0,
    max_duration_hours = 0,
    max_retries = 0,
    dependencies = [],
    skill_complexity = 1,
  } = params

  // Calculate time weight (0-1)
  const avgDuration = (min_duration_hours + max_duration_hours) / 2
  const timeWeight = Math.min(avgDuration / 40, 1) // Normalize to 0-1 (40 hours = 1 week)

  // Calculate retry weight (0-1)
  const retryWeight = Math.min(max_retries / 5, 1) // Normalize to 0-1 (5 retries = max)

  // Calculate dependency weight (0-1)
  const dependencyWeight = Math.min(dependencies.length / 5, 1) // Normalize to 0-1 (5 dependencies = max)

  // Calculate overall complexity (1-5)
  const weightSum = timeWeight * 0.4 + retryWeight * 0.2 + dependencyWeight * 0.2 + (skill_complexity / 5) * 0.2
  const complexity = Math.max(1, Math.min(Math.round(weightSum * 5), 5))

  return {
    complexity,
    timeWeight,
    retryWeight,
    dependencyWeight,
    skillComplexity: skill_complexity,
  }
}
