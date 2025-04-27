export interface TaskWeightInput {
  complexity: number; // 1-5
  risk: number; // 1-5
}

export interface TaskWeightOutput {
  weight: number;
  complexityWeight: number;
  riskWeight: number;
}

export const calculateTaskWeight = (input: TaskWeightInput): TaskWeightOutput => {
  // Trọng số cho từng yếu tố
  const complexityWeight = 0.6; // Tăng trọng số cho độ phức tạp
  const riskWeight = 0.4; // Giảm trọng số cho rủi ro

  // Tính toán trọng số tổng thể
  const weight = 
    (input.complexity * complexityWeight) +
    (input.risk * riskWeight);

  return {
    weight,
    complexityWeight: input.complexity * complexityWeight,
    riskWeight: input.risk * riskWeight
  };
}; 