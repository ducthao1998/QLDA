export interface QualityAnalysisInput {
  tasks: {
    id: string;
    status: "todo" | "in_progress" | "blocked" | "review" | "done" | "archived";
    complexity: number;
    qualityScore: number | null; // 1-5
    reviewCount: number;
    rejectionCount: number;
    defects: {
      severity: "low" | "medium" | "high" | "critical";
      status: "open" | "in_progress" | "resolved" | "closed";
    }[];
  }[];
  project: {
    qualityStandards: {
      maxDefectsPerTask: number;
      maxRejections: number;
      minQualityScore: number;
    };
    complexity: number;
  };
  team: {
    id: string;
    skillLevel: number; // 1-5
    experience: number; // Số năm kinh nghiệm
  }[];
}

export interface QualityAnalysisOutput {
  qualityMetrics: {
    overallQuality: number; // 0-1
    defectDensity: number;
    reviewEffectiveness: number;
    reworkRate: number;
  };
  breakdown: {
    byTask: {
      taskId: string;
      qualityScore: number;
      defectCount: number;
      reviewCount: number;
    }[];
    bySeverity: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
  };
  qualityRisks: {
    highRiskTasks: {
      taskId: string;
      riskScore: number;
      reasons: string[];
    }[];
    criticalIssues: {
      taskId: string;
      issue: string;
      impact: number;
    }[];
  };
  recommendations: string[];
}

export const calculateQualityAnalysis = (input: QualityAnalysisInput): QualityAnalysisOutput => {
  // Tính toán các chỉ số chất lượng
  const completedTasks = input.tasks.filter(task => task.status === "done" || task.status === "archived");
  const totalTasks = input.tasks.length;

  // Tính điểm chất lượng tổng thể
  const overallQuality = completedTasks.length > 0
    ? completedTasks.reduce((sum, task) => sum + (task.qualityScore || 3), 0) / (completedTasks.length * 5)
    : 0;

  // Tính mật độ lỗi
  const totalDefects = input.tasks.reduce((sum, task) => sum + task.defects.length, 0);
  const defectDensity = totalTasks > 0 ? totalDefects / totalTasks : 0;

  // Tính hiệu quả review
  const totalReviews = input.tasks.reduce((sum, task) => sum + task.reviewCount, 0);
  const reviewEffectiveness = totalReviews > 0
    ? 1 - (input.tasks.reduce((sum, task) => sum + task.rejectionCount, 0) / totalReviews)
    : 0;

  // Tính tỷ lệ làm lại
  const totalRejections = input.tasks.reduce((sum, task) => sum + task.rejectionCount, 0);
  const reworkRate = totalReviews > 0 ? totalRejections / totalReviews : 0;

  // Phân tích theo task
  const taskBreakdown = input.tasks.map(task => ({
    taskId: task.id,
    qualityScore: task.qualityScore || 0,
    defectCount: task.defects.length,
    reviewCount: task.reviewCount
  }));

  // Phân tích theo mức độ nghiêm trọng
  const severityBreakdown = {
    low: input.tasks.reduce((sum, task) => 
      sum + task.defects.filter(d => d.severity === "low").length, 0),
    medium: input.tasks.reduce((sum, task) => 
      sum + task.defects.filter(d => d.severity === "medium").length, 0),
    high: input.tasks.reduce((sum, task) => 
      sum + task.defects.filter(d => d.severity === "high").length, 0),
    critical: input.tasks.reduce((sum, task) => 
      sum + task.defects.filter(d => d.severity === "critical").length, 0)
  };

  // Xác định các task có rủi ro cao
  const highRiskTasks = input.tasks
    .map(task => {
      const riskScore = (
        (task.defects.length / input.project.qualityStandards.maxDefectsPerTask) * 0.4 +
        (task.rejectionCount / input.project.qualityStandards.maxRejections) * 0.3 +
        ((5 - (task.qualityScore || 3)) / 5) * 0.3
      );

      const reasons: string[] = [];
      if (task.defects.length > input.project.qualityStandards.maxDefectsPerTask) {
        reasons.push("Số lượng lỗi vượt quá tiêu chuẩn");
      }
      if (task.rejectionCount > input.project.qualityStandards.maxRejections) {
        reasons.push("Số lần từ chối vượt quá giới hạn");
      }
      if ((task.qualityScore || 0) < input.project.qualityStandards.minQualityScore) {
        reasons.push("Điểm chất lượng thấp");
      }

      return {
        taskId: task.id,
        riskScore,
        reasons
      };
    })
    .filter(task => task.riskScore > 0.7)
    .sort((a, b) => b.riskScore - a.riskScore);

  // Xác định các vấn đề nghiêm trọng
  const criticalIssues = input.tasks
    .flatMap(task => 
      task.defects
        .filter(defect => defect.severity === "critical" && defect.status !== "closed")
        .map(defect => ({
          taskId: task.id,
          issue: `Lỗi nghiêm trọng trong task ${task.id}`,
          impact: 1
        }))
    );

  // Đề xuất cải thiện
  const recommendations: string[] = [];
  
  if (defectDensity > 0.5) {
    recommendations.push("Tăng cường kiểm tra chất lượng trong quá trình phát triển");
  }
  
  if (reworkRate > 0.3) {
    recommendations.push("Cải thiện quy trình review và phản hồi");
  }
  
  if (overallQuality < 0.7) {
    recommendations.push("Tổ chức training nâng cao kỹ năng cho team");
  }

  return {
    qualityMetrics: {
      overallQuality,
      defectDensity,
      reviewEffectiveness,
      reworkRate
    },
    breakdown: {
      byTask: taskBreakdown,
      bySeverity: severityBreakdown
    },
    qualityRisks: {
      highRiskTasks,
      criticalIssues
    },
    recommendations
  };
}; 