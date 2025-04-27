export interface ProjectProgressInput {
  tasks: {
    weight: number;
    status: "todo" | "in_progress" | "blocked" | "review" | "done" | "archived";
    plannedStart: string | null;
    plannedFinish: string | null;
    actualStart: string | null;
    actualFinish: string | null;
  }[];
  startDate: string;
  deadline: string;
}

export interface ProjectProgressOutput {
  overallProgress: number;
  completedTasks: number;
  totalTasks: number;
  weightedProgress: number;
  onTimeTasks: number;
  delayedTasks: number;
  blockedTasks: number;
  averageDelay: number;
}

export const calculateProjectProgress = (input: ProjectProgressInput): ProjectProgressOutput => {
  const totalTasks = input.tasks.length;
  if (totalTasks === 0) {
    return {
      overallProgress: 0,
      completedTasks: 0,
      totalTasks: 0,
      weightedProgress: 0,
      onTimeTasks: 0,
      delayedTasks: 0,
      blockedTasks: 0,
      averageDelay: 0
    };
  }

  // Tính tổng trọng số
  const totalWeight = input.tasks.reduce((sum, task) => sum + task.weight, 0);

  // Đếm số lượng task theo trạng thái
  const completedTasks = input.tasks.filter(task => task.status === "done" || task.status === "archived").length;
  const blockedTasks = input.tasks.filter(task => task.status === "blocked").length;
  
  // Tính tiến độ tổng thể
  const overallProgress = (completedTasks / totalTasks) * 100;

  // Tính tiến độ có trọng số
  const completedWeight = input.tasks
    .filter(task => task.status === "done" || task.status === "archived")
    .reduce((sum, task) => sum + task.weight, 0);
  const weightedProgress = (completedWeight / totalWeight) * 100;

  // Tính số task đúng hạn và trễ hạn
  const now = new Date();
  const onTimeTasks = input.tasks.filter(task => {
    if (!task.actualFinish) return false;
    const finishDate = new Date(task.actualFinish);
    const plannedFinish = task.plannedFinish ? new Date(task.plannedFinish) : null;
    return plannedFinish && finishDate <= plannedFinish;
  }).length;

  const delayedTasks = input.tasks.filter(task => {
    if (!task.actualFinish) return false;
    const finishDate = new Date(task.actualFinish);
    const plannedFinish = task.plannedFinish ? new Date(task.plannedFinish) : null;
    return plannedFinish && finishDate > plannedFinish;
  }).length;

  // Tính độ trễ trung bình
  const delayedTaskDelays = input.tasks
    .filter(task => task.actualFinish && task.plannedFinish)
    .map(task => {
      const finishDate = new Date(task.actualFinish!);
      const plannedFinish = new Date(task.plannedFinish!);
      return Math.max(0, (finishDate.getTime() - plannedFinish.getTime()) / (1000 * 60 * 60 * 24));
    });

  const averageDelay = delayedTaskDelays.length > 0
    ? delayedTaskDelays.reduce((sum, delay) => sum + delay, 0) / delayedTaskDelays.length
    : 0;

  return {
    overallProgress,
    completedTasks,
    totalTasks,
    weightedProgress,
    onTimeTasks,
    delayedTasks,
    blockedTasks,
    averageDelay
  };
}; 