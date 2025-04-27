export interface RiskPredictionInput {
  taskId: string;
  complexity: number; // 1-5
  riskLevel: number; // 1-5
  status: string;
  dueDate: string;
}

export interface RiskPredictionOutput {
  riskLevel: number;
  riskFactors: string[];
}

export async function calculateRiskPrediction(input: RiskPredictionInput): Promise<RiskPredictionOutput> {
  const riskFactors: string[] = [];
  let riskLevel = input.riskLevel;

  // Phân tích độ phức tạp
  if (input.complexity >= 4) {
    riskFactors.push("Độ phức tạp cao");
    riskLevel += 1;
  }

  // Phân tích trạng thái
  if (input.status === "blocked") {
    riskFactors.push("Task đang bị chặn");
    riskLevel += 2;
  }

  // Phân tích thời hạn
  const dueDate = new Date(input.dueDate);
  const now = new Date();
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilDue < 3) {
    riskFactors.push("Thời hạn sắp đến");
    riskLevel += 1;
  }

  // Giới hạn risk level trong khoảng 1-5
  riskLevel = Math.min(Math.max(riskLevel, 1), 5);

  return {
    riskLevel,
    riskFactors
  };
} 