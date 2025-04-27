export interface ResourceAllocationInput {
  tasks: {
    id: string;
    weight: number;
    complexity: number;
    risk: number;
    estimatedHours: number;
    dueDate: string;
    status: "todo" | "in_progress" | "blocked" | "review" | "done" | "archived";
  }[];
  users: {
    id: string;
    capacity: number; // Số giờ làm việc mỗi ngày
    skills: {
      id: number;
      level: number; // 1-5
    }[];
    currentWorkload: number; // Số giờ đã được phân công
  }[];
  projectStartDate: string;
  projectDeadline: string;
}

export interface ResourceAllocationOutput {
  allocations: {
    taskId: string;
    userId: string;
    startDate: string;
    endDate: string;
    hoursPerDay: number;
    skillMatch: number; // 0-1
  }[];
  utilization: {
    userId: string;
    totalHours: number;
    utilizationRate: number; // 0-1
  }[];
}

export const calculateResourceAllocation = (input: ResourceAllocationInput): ResourceAllocationOutput => {
  const allocations: ResourceAllocationOutput["allocations"] = [];
  const utilization: ResourceAllocationOutput["utilization"] = [];

  // Sắp xếp task theo độ ưu tiên (trọng số * độ phức tạp * rủi ro)
  const sortedTasks = [...input.tasks]
    .filter(task => task.status === "todo")
    .sort((a, b) => {
      const priorityA = a.weight * a.complexity * a.risk;
      const priorityB = b.weight * b.complexity * b.risk;
      return priorityB - priorityA;
    });

  // Khởi tạo utilization cho mỗi user
  input.users.forEach(user => {
    utilization.push({
      userId: user.id,
      totalHours: user.currentWorkload,
      utilizationRate: user.currentWorkload / (user.capacity * 5) // Giả sử 5 ngày làm việc
    });
  });

  // Phân bổ task
  for (const task of sortedTasks) {
    // Tìm user phù hợp nhất
    let bestUser = null;
    let bestScore = -1;

    for (const user of input.users) {
      // Tính điểm phù hợp
      const skillMatch = user.skills.reduce((sum, skill) => sum + skill.level, 0) / (user.skills.length * 5);
      const availability = 1 - (user.currentWorkload / (user.capacity * 5));
      const score = (skillMatch * 0.6) + (availability * 0.4);

      if (score > bestScore) {
        bestScore = score;
        bestUser = user;
      }
    }

    if (bestUser) {
      // Tính toán thời gian bắt đầu và kết thúc
      const startDate = new Date(input.projectStartDate);
      const dueDate = new Date(task.dueDate);
      const daysAvailable = Math.floor((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const hoursPerDay = Math.min(
        task.estimatedHours / daysAvailable,
        bestUser.capacity - (bestUser.currentWorkload / 5)
      );

      // Cập nhật utilization
      const userUtilization = utilization.find(u => u.userId === bestUser!.id);
      if (userUtilization) {
        userUtilization.totalHours += task.estimatedHours;
        userUtilization.utilizationRate = userUtilization.totalHours / (bestUser.capacity * 5);
      }

      // Thêm vào allocations
      allocations.push({
        taskId: task.id,
        userId: bestUser.id,
        startDate: startDate.toISOString(),
        endDate: dueDate.toISOString(),
        hoursPerDay,
        skillMatch: bestScore
      });
    }
  }

  return {
    allocations,
    utilization
  };
}; 