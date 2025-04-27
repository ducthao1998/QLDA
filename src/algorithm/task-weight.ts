export interface TaskWeightInput {
  complexity: number; // 1-5
  risk: number; // 1-5
  businessValue: number; // 1-5
}

export interface TaskWeightOutput {
  weight: number;
  complexityWeight: number;
  riskWeight: number;
  businessValueWeight: number;
}

export const calculateTaskWeight = (input: TaskWeightInput): TaskWeightOutput => {
  // Trọng số cho từng yếu tố
  const complexityWeight = 0.4;
  const riskWeight = 0.3;
  const businessValueWeight = 0.3;

  // Tính toán trọng số tổng thể
  const weight = 
    (input.complexity * complexityWeight) +
    (input.risk * riskWeight) +
    (input.businessValue * businessValueWeight);

  return {
    weight,
    complexityWeight: input.complexity * complexityWeight,
    riskWeight: input.risk * riskWeight,
    businessValueWeight: input.businessValue * businessValueWeight
  };
}; 