export interface ProjectCompletionInput {
  tasks: {
    id: string;
    status: "todo" | "in_progress" | "blocked" | "review" | "done" | "archived";
    estimatedHours: number;
    actualHours: number | null;
    plannedStart: string | null;
    plannedFinish: string | null;
    actualStart: string | null;
    actualFinish: string | null;
    complexity: number;
    riskLevel: number;
  }[];
  project: {
    startDate: string;
    deadline: string;
    complexity: number;
    technicalRisk: number;
  };
  team: {
    size: number;
    averageCapacity: number; // Số giờ làm việc mỗi ngày
    skillLevel: number; // 1-5
  };
  historicalData?: {
    similarProjects: {
      plannedDuration: number;
      actualDuration: number;
      complexity: number;
    }[];
  };
}

export interface ProjectCompletionOutput {
  predictedCompletion: string;
  confidence: number; // 0-1
  factors: {
    taskProgress: number;
    teamPerformance: number;
    historicalAdjustment: number;
    riskAdjustment: number;
  };
  criticalPath: string[];
  bottlenecks: {
    taskId: string;
    impact: number; // 0-1
    reason: string;
  }[];
}

export const calculateProjectCompletion = (input: ProjectCompletionInput): ProjectCompletionOutput => {
  // Tính toán tiến độ hiện tại
  const completedTasks = input.tasks.filter(task => task.status === "done" || task.status === "archived");
  const totalTasks = input.tasks.length;
  const taskProgress = totalTasks > 0 ? completedTasks.length / totalTasks : 0;

  // Tính toán hiệu suất của team
  const completedTaskHours = completedTasks.reduce((sum, task) => sum + (task.actualHours || task.estimatedHours), 0);
  const plannedTaskHours = completedTasks.reduce((sum, task) => sum + task.estimatedHours, 0);
  const teamPerformance = plannedTaskHours > 0 ? completedTaskHours / plannedTaskHours : 1;

  // Tính toán điều chỉnh từ dữ liệu lịch sử
  let historicalAdjustment = 1;
  if (input.historicalData?.similarProjects.length) {
    const avgDelay = input.historicalData.similarProjects.reduce((sum, project) => {
      return sum + (project.actualDuration - project.plannedDuration) / project.plannedDuration;
    }, 0) / input.historicalData.similarProjects.length;
    historicalAdjustment = 1 + avgDelay;
  }

  // Tính toán điều chỉnh rủi ro
  const projectRisk = (input.project.complexity * input.project.technicalRisk) / 25;
  const riskAdjustment = 1 + (projectRisk * 0.2);

  // Tính toán thời gian còn lại
  const now = new Date();
  const projectStart = new Date(input.project.startDate);
  const elapsedDays = (now.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24);
  
  const remainingTasks = input.tasks.filter(task => 
    task.status === "todo" || task.status === "in_progress" || task.status === "blocked"
  );
  
  const remainingHours = remainingTasks.reduce((sum, task) => sum + task.estimatedHours, 0);
  const dailyCapacity = input.team.size * input.team.averageCapacity;
  const remainingDays = remainingHours / dailyCapacity;
  
  // Áp dụng các hệ số điều chỉnh
  const adjustedRemainingDays = remainingDays * historicalAdjustment * riskAdjustment / teamPerformance;
  
  // Dự đoán ngày hoàn thành
  const predictedCompletion = new Date(now.getTime() + adjustedRemainingDays * 24 * 60 * 60 * 1000);

  // Xác định đường găng và các nút thắt
  const criticalPath: string[] = [];
  const bottlenecks: ProjectCompletionOutput["bottlenecks"] = [];

  remainingTasks.forEach(task => {
    const taskRisk = (task.complexity * task.riskLevel) / 25;
    if (taskRisk > 0.7) {
      bottlenecks.push({
        taskId: task.id,
        impact: taskRisk,
        reason: `Task có độ phức tạp và rủi ro cao (${task.complexity}/${task.riskLevel})`
      });
    }
  });

  // Tính toán độ tin cậy của dự đoán
  const confidence = Math.min(
    0.9,
    0.3 + // Cơ sở
    (taskProgress * 0.3) + // Tiến độ
    (teamPerformance * 0.2) + // Hiệu suất team
    (1 - projectRisk * 0.2) // Rủi ro dự án
  );

  return {
    predictedCompletion: predictedCompletion.toISOString(),
    confidence,
    factors: {
      taskProgress,
      teamPerformance,
      historicalAdjustment,
      riskAdjustment
    },
    criticalPath,
    bottlenecks
  };
}; 