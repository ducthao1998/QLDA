import { RiskPredictionResult } from "@/app/types/task"

interface RiskPredictionParams {
  taskId: string
  min_duration_hours?: number
  max_duration_hours?: number
  max_retries?: number
  dependencies?: any[]
  status?: string
}

export async function calculateRiskPrediction(params: RiskPredictionParams): Promise<RiskPredictionResult> {
  const {
    taskId,
    min_duration_hours = 0,
    max_duration_hours = 0,
    max_retries = 0,
    dependencies = [],
    status = "todo",
  } = params

  // Calculate base risk score
  let riskScore = 0
  const riskFactors: string[] = []
  const recommendations: string[] = []

  // Factor 1: Duration uncertainty
  const durationRange = max_duration_hours - min_duration_hours
  const durationUncertainty = min_duration_hours > 0 ? durationRange / min_duration_hours : 0

  if (durationUncertainty > 1) {
    riskScore += 20
    riskFactors.push("Độ không chắc chắn về thời gian cao")
    recommendations.push("Phân tích kỹ hơn để ước tính thời gian chính xác hơn")
  }

  // Factor 2: Dependencies
  if (dependencies.length > 2) {
    riskScore += 15 * Math.min(dependencies.length / 2, 3)
    riskFactors.push(`Phụ thuộc vào ${dependencies.length} công việc khác`)
    recommendations.push("Giảm thiểu sự phụ thuộc hoặc theo dõi chặt chẽ các công việc phụ thuộc")
  }

  // Factor 3: Retries
  if (max_retries > 2) {
    riskScore += 10
    riskFactors.push("Có thể cần nhiều lần thử lại")
    recommendations.push("Chuẩn bị kế hoạch dự phòng cho các trường hợp thất bại")
  }

  // Factor 4: Status-based risk
  if (status === "blocked") {
    riskScore += 30
    riskFactors.push("Công việc đang bị chặn")
    recommendations.push("Giải quyết vấn đề chặn càng sớm càng tốt")
  } else if (status === "on_hold") {
    riskScore += 20
    riskFactors.push("Công việc đang tạm dừng")
    recommendations.push("Xác định thời điểm có thể tiếp tục công việc")
  }

  // Calculate risk level (1-5)
  const riskLevel = Math.min(Math.ceil(riskScore / 20), 5)

  // Add default recommendations if none were added
  if (recommendations.length === 0) {
    if (riskLevel >= 3) {
      recommendations.push("Theo dõi chặt chẽ tiến độ công việc")
    } else {
      recommendations.push("Tiếp tục theo dõi công việc theo quy trình thông thường")
    }
  }

  return {
    riskLevel,
    riskScore,
    riskFactors,
    recommendations,
  }
}
