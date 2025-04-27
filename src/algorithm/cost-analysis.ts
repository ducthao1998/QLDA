export interface CostAnalysisInput {
  tasks: {
    id: string;
    status: "todo" | "in_progress" | "blocked" | "review" | "done" | "archived";
    estimatedHours: number;
    actualHours: number | null;
    complexity: number;
    riskLevel: number;
    assignedTo: string | null;
  }[];
  team: {
    id: string;
    hourlyRate: number;
    capacity: number; // Số giờ làm việc mỗi ngày
  }[];
  project: {
    startDate: string;
    deadline: string;
    budget: number;
    overheadRate: number; // Tỷ lệ chi phí chung
  };
  historicalData?: {
    similarProjects: {
      plannedCost: number;
      actualCost: number;
      complexity: number;
    }[];
  };
}

export interface CostAnalysisOutput {
  costMetrics: {
    plannedCost: number;
    actualCost: number;
    remainingCost: number;
    costVariance: number;
    costPerformanceIndex: number;
  };
  breakdown: {
    laborCost: number;
    overheadCost: number;
    riskContingency: number;
  };
  costTrends: {
    dailyCost: number;
    weeklyCost: number;
    monthlyCost: number;
  };
  costRisks: {
    highCostTasks: {
      taskId: string;
      costImpact: number;
      reason: string;
    }[];
    budgetAtRisk: number;
  };
}

export const calculateCostAnalysis = (input: CostAnalysisInput): CostAnalysisOutput => {
  // Tính toán chi phí lao động
  const laborCost = input.tasks.reduce((sum, task) => {
    if (task.status === "done" || task.status === "archived") {
      const hours = task.actualHours || task.estimatedHours;
      const teamMember = input.team.find(member => member.id === task.assignedTo);
      return sum + (hours * (teamMember?.hourlyRate || 0));
    }
    return sum;
  }, 0);

  // Tính toán chi phí chung
  const overheadCost = laborCost * input.project.overheadRate;

  // Tính toán dự phòng rủi ro
  const remainingTasks = input.tasks.filter(task => 
    task.status === "todo" || task.status === "in_progress" || task.status === "blocked"
  );
  
  const riskContingency = remainingTasks.reduce((sum, task) => {
    const riskFactor = (task.complexity * task.riskLevel) / 25;
    const teamMember = input.team.find(member => member.id === task.assignedTo);
    return sum + (task.estimatedHours * (teamMember?.hourlyRate || 0) * riskFactor * 0.2);
  }, 0);

  // Tính toán chi phí kế hoạch và thực tế
  const plannedCost = input.tasks.reduce((sum, task) => {
    const teamMember = input.team.find(member => member.id === task.assignedTo);
    return sum + (task.estimatedHours * (teamMember?.hourlyRate || 0));
  }, 0) * (1 + input.project.overheadRate);

  const actualCost = laborCost + overheadCost;
  const remainingCost = remainingTasks.reduce((sum, task) => {
    const teamMember = input.team.find(member => member.id === task.assignedTo);
    return sum + (task.estimatedHours * (teamMember?.hourlyRate || 0));
  }, 0) * (1 + input.project.overheadRate);

  // Tính toán các chỉ số chi phí
  const costVariance = actualCost - plannedCost;
  const costPerformanceIndex = plannedCost > 0 ? actualCost / plannedCost : 1;

  // Tính toán xu hướng chi phí
  const now = new Date();
  const projectStart = new Date(input.project.startDate);
  const elapsedDays = (now.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24);
  
  const dailyCost = elapsedDays > 0 ? actualCost / elapsedDays : 0;
  const weeklyCost = dailyCost * 5; // Giả sử 5 ngày làm việc mỗi tuần
  const monthlyCost = weeklyCost * 4; // Giả sử 4 tuần mỗi tháng

  // Xác định các task có chi phí cao
  const highCostTasks = remainingTasks
    .map(task => {
      const teamMember = input.team.find(member => member.id === task.assignedTo);
      const taskCost = task.estimatedHours * (teamMember?.hourlyRate || 0);
      const costImpact = taskCost / plannedCost;
      
      let reason = "";
      if (task.estimatedHours > 40) reason += "Thời gian ước tính cao. ";
      if (task.complexity >= 4) reason += "Độ phức tạp cao. ";
      if (task.riskLevel >= 4) reason += "Rủi ro cao. ";

      return {
        taskId: task.id,
        costImpact,
        reason: reason || "Chi phí trung bình"
      };
    })
    .filter(task => task.costImpact > 0.1)
    .sort((a, b) => b.costImpact - a.costImpact);

  // Tính toán ngân sách có rủi ro
  const budgetAtRisk = highCostTasks.reduce((sum, task) => sum + task.costImpact, 0) * input.project.budget;

  return {
    costMetrics: {
      plannedCost,
      actualCost,
      remainingCost,
      costVariance,
      costPerformanceIndex
    },
    breakdown: {
      laborCost,
      overheadCost,
      riskContingency
    },
    costTrends: {
      dailyCost,
      weeklyCost,
      monthlyCost
    },
    costRisks: {
      highCostTasks,
      budgetAtRisk
    }
  };
}; 