export interface EstimatedTimeInput {
  complexity: number; // 1-5
  risk: number; // 1-5
  baseTime: number; // Thời gian cơ bản (giờ)
}

export interface EstimatedTimeOutput {
  estimatedTime: number;
  complexityFactor: number;
  riskFactor: number;
}

export const calculateEstimatedTime = (input: EstimatedTimeInput): EstimatedTimeOutput => {
  // Hệ số tăng thời gian dựa trên độ phức tạp
  const complexityFactor = 1 + (input.complexity - 1) * 0.2;
  
  // Hệ số tăng thời gian dựa trên rủi ro
  const riskFactor = 1 + (input.risk - 1) * 0.15;

  // Tính toán thời gian ước tính
  const estimatedTime = input.baseTime * complexityFactor * riskFactor;

  return {
    estimatedTime,
    complexityFactor,
    riskFactor
  };
}; 