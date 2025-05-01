import { createClient } from "@/lib/supabase/server"
import { Task } from "@/app/types/table-types"

interface OptimizationResult {
  priority: number
  risk_level: number
  complexity: number
  weight: number
}

export async function optimizeTask(task: Task): Promise<OptimizationResult> {
  const supabase = await createClient()
  
  // 1. Lấy thông tin dependencies
  const { data: dependencies } = await supabase
    .from("task_dependencies")
    .select("depends_on_id")
    .eq("task_id", task.id)

  // 2. Tính toán độ phức tạp dựa trên dependencies
  const complexity = calculateComplexity(dependencies?.length || 0)

  // 3. Tính toán rủi ro dựa trên thời gian và số lần thử lại
  const risk_level = calculateRiskLevel(
    task.min_duration_hours,
    task.max_duration_hours,
    task.max_retries
  )

  // 4. Tính toán trọng số dựa trên độ phức tạp và rủi ro
  const weight = calculateWeight(complexity, risk_level)

  // 5. Tính toán độ ưu tiên dựa trên tất cả các yếu tố
  const priority = calculatePriority(complexity, risk_level, weight)

  return {
    priority,
    risk_level,
    complexity,
    weight
  }
}

function calculateComplexity(dependencyCount: number): number {
  // Độ phức tạp tăng theo số lượng dependencies
  if (dependencyCount === 0) return 1
  if (dependencyCount <= 2) return 2
  if (dependencyCount <= 4) return 3
  if (dependencyCount <= 6) return 4
  return 5
}

function calculateRiskLevel(
  minHours: number,
  maxHours: number,
  maxRetries: number
): number {
  // Rủi ro tăng theo khoảng thời gian và giảm theo số lần thử lại
  const timeRange = maxHours - minHours
  const timeRisk = Math.min(5, Math.ceil(timeRange / 4))
  const retryRisk = Math.max(1, 6 - maxRetries)
  return Math.ceil((timeRisk + retryRisk) / 2)
}

function calculateWeight(complexity: number, risk_level: number): number {
  // Trọng số là trung bình của độ phức tạp và rủi ro, chuẩn hóa về khoảng 0-1
  return ((complexity + risk_level) / 10)
}

function calculatePriority(
  complexity: number,
  risk_level: number,
  weight: number
): number {
  // Độ ưu tiên là trung bình có trọng số của các yếu tố
  const priority = (complexity * 0.3 + risk_level * 0.4 + weight * 0.3) * 5
  return Math.min(5, Math.ceil(priority))
} 