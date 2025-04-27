export interface TeamPerformanceInput {
  tasks: {
    id: string;
    status: "todo" | "in_progress" | "blocked" | "review" | "done" | "archived";
    assignedTo: string | null;
    estimatedHours: number;
    actualHours: number | null;
    complexity: number;
    qualityScore: number | null;
    plannedStart: string | null;
    plannedFinish: string | null;
    actualStart: string | null;
    actualFinish: string | null;
  }[];
  team: {
    id: string;
    name: string;
    role: string;
    skills: {
      id: number;
      level: number; // 1-5
    }[];
    capacity: number; // Số giờ làm việc mỗi ngày
    experience: number; // Số năm kinh nghiệm
  }[];
  project: {
    startDate: string;
    deadline: string;
    complexity: number;
  };
}

export interface TeamPerformanceOutput {
  overallMetrics: {
    productivity: number; // 0-1
    quality: number; // 0-1
    efficiency: number; // 0-1
    utilization: number; // 0-1
  };
  individualPerformance: {
    memberId: string;
    name: string;
    metrics: {
      completedTasks: number;
      onTimeTasks: number;
      averageQuality: number;
      efficiency: number;
      utilization: number;
    };
    strengths: string[];
    areasForImprovement: string[];
  }[];
  teamDynamics: {
    workloadDistribution: {
      memberId: string;
      name: string;
      workload: number; // 0-1
    }[];
    skillGaps: {
      skillId: number;
      requiredLevel: number;
      currentLevel: number;
      affectedMembers: string[];
    }[];
  };
  recommendations: string[];
}

export const calculateTeamPerformance = (input: TeamPerformanceInput): TeamPerformanceOutput => {
  // Tính toán hiệu suất tổng thể
  const completedTasks = input.tasks.filter(task => task.status === "done" || task.status === "archived");
  const totalTasks = input.tasks.length;

  // Tính năng suất
  const productivity = totalTasks > 0 ? completedTasks.length / totalTasks : 0;

  // Tính chất lượng
  const quality = completedTasks.length > 0
    ? completedTasks.reduce((sum, task) => sum + (task.qualityScore || 3), 0) / (completedTasks.length * 5)
    : 0;

  // Tính hiệu quả
  const efficiency = completedTasks.length > 0
    ? completedTasks.reduce((sum, task) => {
        const plannedHours = task.estimatedHours;
        const actualHours = task.actualHours || plannedHours;
        return sum + (plannedHours / actualHours);
      }, 0) / completedTasks.length
    : 0;

  // Tính tỷ lệ sử dụng
  const now = new Date();
  const projectStart = new Date(input.project.startDate);
  const elapsedDays = (now.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24);
  const totalCapacity = input.team.reduce((sum, member) => sum + (member.capacity * elapsedDays), 0);
  const actualHours = completedTasks.reduce((sum, task) => sum + (task.actualHours || task.estimatedHours), 0);
  const utilization = totalCapacity > 0 ? actualHours / totalCapacity : 0;

  // Tính toán hiệu suất cá nhân
  const individualPerformance = input.team.map(member => {
    const memberTasks = input.tasks.filter(task => task.assignedTo === member.id);
    const completedMemberTasks = memberTasks.filter(task => task.status === "done" || task.status === "archived");

    // Tính các chỉ số cá nhân
    const completedTasks = completedMemberTasks.length;
    const onTimeTasks = completedMemberTasks.filter(task => {
      if (!task.actualFinish || !task.plannedFinish) return false;
      return new Date(task.actualFinish) <= new Date(task.plannedFinish);
    }).length;

    const averageQuality = completedMemberTasks.length > 0
      ? completedMemberTasks.reduce((sum, task) => sum + (task.qualityScore || 3), 0) / completedMemberTasks.length
      : 0;

    const efficiency = completedMemberTasks.length > 0
      ? completedMemberTasks.reduce((sum, task) => {
          const plannedHours = task.estimatedHours;
          const actualHours = task.actualHours || plannedHours;
          return sum + (plannedHours / actualHours);
        }, 0) / completedMemberTasks.length
      : 0;

    const memberCapacity = member.capacity * elapsedDays;
    const memberUtilization = memberCapacity > 0
      ? completedMemberTasks.reduce((sum, task) => sum + (task.actualHours || task.estimatedHours), 0) / memberCapacity
      : 0;

    // Xác định điểm mạnh và điểm cần cải thiện
    const strengths: string[] = [];
    const areasForImprovement: string[] = [];

    if (efficiency > 0.9) strengths.push("Hiệu quả cao trong công việc");
    if (averageQuality > 4) strengths.push("Chất lượng công việc tốt");
    if (onTimeTasks / completedTasks > 0.9) strengths.push("Đúng hạn");

    if (efficiency < 0.7) areasForImprovement.push("Cần cải thiện hiệu suất");
    if (averageQuality < 3) areasForImprovement.push("Cần nâng cao chất lượng");
    if (memberUtilization < 0.7) areasForImprovement.push("Cần tăng cường sử dụng thời gian");

    return {
      memberId: member.id,
      name: member.name,
      metrics: {
        completedTasks,
        onTimeTasks,
        averageQuality,
        efficiency,
        utilization: memberUtilization
      },
      strengths,
      areasForImprovement
    };
  });

  // Phân tích phân bổ công việc
  const workloadDistribution = input.team.map(member => {
    const memberTasks = input.tasks.filter(task => task.assignedTo === member.id);
    const totalWorkload = memberTasks.reduce((sum, task) => sum + task.estimatedHours, 0);
    const teamTotalWorkload = input.tasks.reduce((sum, task) => sum + task.estimatedHours, 0);
    
    return {
      memberId: member.id,
      name: member.name,
      workload: teamTotalWorkload > 0 ? totalWorkload / teamTotalWorkload : 0
    };
  });

  // Phân tích khoảng cách kỹ năng
  const skillGaps: TeamPerformanceOutput["teamDynamics"]["skillGaps"] = [];
  const requiredSkills = new Map<number, number>();

  // Xác định kỹ năng yêu cầu từ các task
  input.tasks.forEach(task => {
    const complexity = task.complexity;
    if (complexity >= 4) {
      // Giả sử task phức tạp yêu cầu kỹ năng level 4-5
      requiredSkills.set(1, Math.max(requiredSkills.get(1) || 0, 4));
    }
  });

  // So sánh với kỹ năng hiện có của team
  requiredSkills.forEach((requiredLevel, skillId) => {
    const affectedMembers = input.team
      .filter(member => {
        const memberSkill = member.skills.find(s => s.id === skillId);
        return !memberSkill || memberSkill.level < requiredLevel;
      })
      .map(member => member.id);

    if (affectedMembers.length > 0) {
      const currentLevel = input.team.reduce((sum, member) => {
        const memberSkill = member.skills.find(s => s.id === skillId);
        return sum + (memberSkill?.level || 0);
      }, 0) / input.team.length;

      skillGaps.push({
        skillId,
        requiredLevel,
        currentLevel,
        affectedMembers
      });
    }
  });

  // Đề xuất cải thiện
  const recommendations: string[] = [];

  if (productivity < 0.7) {
    recommendations.push("Cần tăng cường năng suất làm việc của team");
  }

  if (quality < 0.7) {
    recommendations.push("Cần cải thiện chất lượng công việc");
  }

  if (efficiency < 0.7) {
    recommendations.push("Cần tối ưu hóa quy trình làm việc");
  }

  if (skillGaps.length > 0) {
    recommendations.push("Cần đào tạo bổ sung kỹ năng cho team");
  }

  return {
    overallMetrics: {
      productivity,
      quality,
      efficiency,
      utilization
    },
    individualPerformance,
    teamDynamics: {
      workloadDistribution,
      skillGaps
    },
    recommendations
  };
}; 