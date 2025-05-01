import { EstimatedTimeResult } from "@/app/types/task"

interface EstimatedTimeParams {
  min_duration_hours?: number
  max_duration_hours?: number
  max_retries?: number
  dependencies?: any[]
}

export function calculateEstimatedTime(params: EstimatedTimeParams): EstimatedTimeResult {
  const { min_duration_hours = 0, max_duration_hours = 0, max_retries = 0, dependencies = [] } = params
  console.log("min_duration_hours", min_duration_hours)
  console.log("max_duration_hours", max_duration_hours)
  console.log("max_retries", max_retries)
  console.log("dependencies", dependencies)
  // Base estimate is weighted average of min and max
  const baseEstimate = min_duration_hours * 0.4 + max_duration_hours * 0.6

  // Add time for retries
  const retryFactor = 1 + max_retries * 0.1

  // Add time for dependencies
  const dependencyFactor = 1 + dependencies.length * 0.05

  // Calculate final estimate
  const estimatedTime = baseEstimate * retryFactor * dependencyFactor

  // Calculate confidence (0-1)
  // Lower confidence if there's a big gap between min and max
  const durationRange = max_duration_hours - min_duration_hours
  const rangeFactor = min_duration_hours > 0 ? Math.min(1, 1 - durationRange / (min_duration_hours * 2)) : 0.5

  // Lower confidence if there are many dependencies
  const dependencyConfidence = Math.max(0.5, 1 - dependencies.length * 0.05)

  // Final confidence
  const confidence = Math.max(0.3, rangeFactor * 0.7 + dependencyConfidence * 0.3)

  return {
    estimatedTime,
    confidence,
  }
}
