export interface RiskPredictionInput {
  tasks: {
    riskLevel: number; // 1-5
    complexity: number; // 1-5
    status: "todo" | "in_progress" | "blocked" | "review" | "done" | "archived";
    plannedStart: string | null;
    plannedFinish: string | null;
    actualStart: string | null;
    actualFinish: string | null;
  }[];
  project: {
    technicalRisk: number; // 1-5
    complexity: number; // 1-5
    startDate: string;
    deadline: string;
  };
  historicalData?: {
    similarProjects: {
      riskLevel: number;
      actualDelay: number; // Số ngày trễ
    }[];
  };
}

export interface RiskPredictionOutput {
  overallRisk: number; // 0-1
  riskFactors: {
    taskRisk: number;
    projectRisk: number;
    scheduleRisk: number;
    historicalRisk: number;
  };
  highRiskTasks: {
    riskScore: number;
    reason: string;
  }[];
  mitigationSuggestions: string[];
}

export const calculateRiskPrediction = (input: RiskPredictionInput): RiskPredictionOutput => {
  // Tính toán rủi ro từ các task
  const activeTasks = input.tasks.filter(task => 
    task.status === "todo" || task.status === "in_progress" || task.status === "blocked"
  );

  const taskRisk = activeTasks.length > 0
    ? activeTasks.reduce((sum, task) => sum + (task.riskLevel * task.complexity), 0) / (activeTasks.length * 25)
    : 0;

  // Tính toán rủi ro từ dự án
  const projectRisk = (input.project.technicalRisk * input.project.complexity) / 25;

  // Tính toán rủi ro về tiến độ
  const now = new Date();
  const projectStart = new Date(input.project.startDate);
  const projectDeadline = new Date(input.project.deadline);
  const totalDays = (projectDeadline.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24);
  const elapsedDays = (now.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24);
  
  const completedTasks = input.tasks.filter(task => task.status === "done" || task.status === "archived").length;
  const totalTasks = input.tasks.length;
  const expectedProgress = elapsedDays / totalDays;
  const actualProgress = totalTasks > 0 ? completedTasks / totalTasks : 0;
  
  const scheduleRisk = Math.max(0, expectedProgress - actualProgress);

  // Tính toán rủi ro từ dữ liệu lịch sử
  const historicalRisk = input.historicalData?.similarProjects.length
    ? input.historicalData.similarProjects.reduce((sum, project) => sum + project.riskLevel, 0) / 
      (input.historicalData.similarProjects.length * 5)
    : 0;

  // Tính toán rủi ro tổng thể
  const overallRisk = (taskRisk * 0.3) + (projectRisk * 0.2) + (scheduleRisk * 0.3) + (historicalRisk * 0.2);

  // Xác định các task có rủi ro cao
  const highRiskTasks = activeTasks
    .map(task => {
      const riskScore = (task.riskLevel * task.complexity) / 25;
      let reason = "";
      
      if (task.riskLevel >= 4) reason += "Mức độ rủi ro cao. ";
      if (task.complexity >= 4) reason += "Độ phức tạp cao. ";
      if (task.status === "blocked") reason += "Task đang bị chặn. ";

      return {
        riskScore,
        reason: reason || "Rủi ro trung bình"
      };
    })
    .filter(task => task.riskScore >= 0.6)
    .sort((a, b) => b.riskScore - a.riskScore);

  // Đề xuất biện pháp giảm thiểu
  const mitigationSuggestions: string[] = [];
  
  if (taskRisk > 0.6) {
    mitigationSuggestions.push("Phân tích và giảm thiểu rủi ro cho các task có độ phức tạp cao");
  }
  
  if (scheduleRisk > 0.3) {
    mitigationSuggestions.push("Tăng cường nguồn lực cho các task đang chậm tiến độ");
  }
  
  if (projectRisk > 0.7) {
    mitigationSuggestions.push("Cân nhắc giảm độ phức tạp kỹ thuật của dự án");
  }

  return {
    overallRisk,
    riskFactors: {
      taskRisk,
      projectRisk,
      scheduleRisk,
      historicalRisk
    },
    highRiskTasks,
    mitigationSuggestions
  };
}; 