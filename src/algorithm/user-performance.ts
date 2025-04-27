export interface UserPerformanceInput {
  completedTasks: {
    plannedHours: number;
    actualHours: number;
    qualityScore: number; // 1-5
    onTime: boolean;
  }[];
}

export interface UserPerformanceOutput {
  onTimePercentage: number;
  averageQuality: number;
  efficiencyScore: number;
  totalPlannedHours: number;
  totalActualHours: number;
}

export const calculateUserPerformance = (input: UserPerformanceInput): UserPerformanceOutput => {
  const totalTasks = input.completedTasks.length;
  if (totalTasks === 0) {
    return {
      onTimePercentage: 0,
      averageQuality: 0,
      efficiencyScore: 0,
      totalPlannedHours: 0,
      totalActualHours: 0
    };
  }

  // Tính tổng số giờ
  const totalPlannedHours = input.completedTasks.reduce((sum, task) => sum + task.plannedHours, 0);
  const totalActualHours = input.completedTasks.reduce((sum, task) => sum + task.actualHours, 0);

  // Tính tỷ lệ hoàn thành đúng hạn
  const onTimeTasks = input.completedTasks.filter(task => task.onTime).length;
  const onTimePercentage = (onTimeTasks / totalTasks) * 100;

  // Tính điểm chất lượng trung bình
  const averageQuality = input.completedTasks.reduce((sum, task) => sum + task.qualityScore, 0) / totalTasks;

  // Tính điểm hiệu suất (0-1)
  const timeEfficiency = totalPlannedHours / totalActualHours;
  const qualityFactor = averageQuality / 5;
  const efficiencyScore = (timeEfficiency * 0.6) + (qualityFactor * 0.4);

  return {
    onTimePercentage,
    averageQuality,
    efficiencyScore,
    totalPlannedHours,
    totalActualHours
  };
}; 