export interface ProjectScheduleInput {
  tasks: {
    id: string;
    name: string;
    status: "todo" | "in_progress" | "blocked" | "review" | "done" | "archived";
    estimatedHours: number;
    actualHours: number | null;
    plannedStart: string | null;
    plannedFinish: string | null;
    actualStart: string | null;
    actualFinish: string | null;
    complexity: number;
    risk: number;
  }[];
  team: {
    id: string;
    name: string;
    capacity: number;
    skills: string[];
  }[];
  project: {
    startDate: string;
    endDate: string;
    bufferDays: number;
  };
}

export interface ProjectScheduleOutput {
  scheduleMetrics: {
    plannedDuration: number;
    actualDuration: number;
    progress: number;
    scheduleVariance: number;
    schedulePerformanceIndex: number;
  };
  milestones: {
    name: string;
    plannedDate: string;
    actualDate: string | null;
    status: "on_track" | "at_risk" | "delayed";
    tasks: string[];
  }[];
  scheduleRisks: {
    taskId: string;
    name: string;
    impact: number;
    reason: string;
  }[];
  recommendations: string[];
}

export const calculateProjectSchedule = (input: ProjectScheduleInput): ProjectScheduleOutput => {
  const projectStart = new Date(input.project.startDate);
  const projectEnd = new Date(input.project.endDate);
  const plannedDuration = Math.ceil((projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24));

  // Tính toán tiến độ thực tế
  const completedTasks = input.tasks.filter(task => task.status === "done" || task.status === "archived");
  const inProgressTasks = input.tasks.filter(task => task.status === "in_progress" || task.status === "review");
  const totalTasks = input.tasks.length;

  const progress = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;

  // Tính toán thời gian thực tế
  let actualDuration = 0;
  if (completedTasks.length > 0) {
    const firstStart = new Date(Math.min(...completedTasks
      .map(task => new Date(task.actualStart || task.plannedStart || "").getTime())));
    const lastFinish = new Date(Math.max(...completedTasks
      .map(task => new Date(task.actualFinish || task.plannedFinish || "").getTime())));
    actualDuration = Math.ceil((lastFinish.getTime() - firstStart.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Tính toán độ lệch tiến độ
  const scheduleVariance = actualDuration - plannedDuration;
  const schedulePerformanceIndex = plannedDuration > 0 ? actualDuration / plannedDuration : 1;

  // Xác định các mốc quan trọng
  const milestones: ProjectScheduleOutput["milestones"] = [];
  const taskGroups = new Map<string, string[]>();

  // Nhóm task theo tuần
  input.tasks.forEach(task => {
    if (task.plannedFinish) {
      const finishDate = new Date(task.plannedFinish);
      const weekKey = `${finishDate.getFullYear()}-W${Math.ceil((finishDate.getDate() + finishDate.getDay()) / 7)}`;
      
      if (!taskGroups.has(weekKey)) {
        taskGroups.set(weekKey, []);
      }
      taskGroups.get(weekKey)!.push(task.id);
    }
  });

  // Tạo mốc cho mỗi tuần
  taskGroups.forEach((tasks, weekKey) => {
    const [year, week] = weekKey.split("-W");
    const milestoneDate = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7);
    
    const completedTasksInMilestone = tasks.filter(taskId => 
      completedTasks.some(t => t.id === taskId)
    ).length;

    let status: "on_track" | "at_risk" | "delayed" = "on_track";
    if (completedTasksInMilestone < tasks.length * 0.7) {
      status = "at_risk";
    }
    if (completedTasksInMilestone < tasks.length * 0.5) {
      status = "delayed";
    }

    milestones.push({
      name: `Tuần ${week}`,
      plannedDate: milestoneDate.toISOString().split("T")[0],
      actualDate: null, // Có thể cập nhật sau khi có dữ liệu thực tế
      status,
      tasks
    });
  });

  // Xác định rủi ro tiến độ
  const scheduleRisks: ProjectScheduleOutput["scheduleRisks"] = [];
  
  // Kiểm tra task đang chậm tiến độ
  inProgressTasks.forEach(task => {
    if (task.plannedFinish && task.actualStart) {
      const plannedFinish = new Date(task.plannedFinish);
      const actualStart = new Date(task.actualStart);
      const today = new Date();
      
      const plannedDuration = (plannedFinish.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24);
      const elapsedDuration = (today.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24);
      
      if (elapsedDuration > plannedDuration * 0.7) {
        const impact = (elapsedDuration - plannedDuration * 0.7) / plannedDuration;
        scheduleRisks.push({
          taskId: task.id,
          name: task.name,
          impact,
          reason: "Task đang chậm tiến độ so với kế hoạch"
        });
      }
    }
  });

  // Kiểm tra task có độ phức tạp và rủi ro cao
  input.tasks
    .filter(task => task.complexity >= 4 || task.risk >= 4)
    .forEach(task => {
      if (!completedTasks.some(t => t.id === task.id)) {
        scheduleRisks.push({
          taskId: task.id,
          name: task.name,
          impact: (task.complexity + task.risk) / 10,
          reason: "Task có độ phức tạp hoặc rủi ro cao"
        });
      }
    });

  // Đề xuất cải thiện
  const recommendations: string[] = [];

  if (scheduleVariance > 0) {
    recommendations.push("Tăng cường nguồn lực cho các task đang chậm tiến độ");
  }

  if (scheduleRisks.length > 0) {
    recommendations.push("Ưu tiên giải quyết các task có rủi ro tiến độ cao");
  }

  if (progress < 50) {
    recommendations.push("Xem xét điều chỉnh kế hoạch dự án");
  }

  return {
    scheduleMetrics: {
      plannedDuration,
      actualDuration,
      progress,
      scheduleVariance,
      schedulePerformanceIndex
    },
    milestones,
    scheduleRisks,
    recommendations
  };
}; 