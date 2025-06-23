import { OptimizationInput } from './types'

interface UserWorkload {
  userId: string;
  totalHours: number;
  tasks: {
    taskId: string;
    hours: number;
    startDate: Date;
    endDate: Date;
  }[];
}

export function calculateWorkloadBalance(input: OptimizationInput): number {
  const { users, scheduleDetails } = input;
  
  // 1. Calculate workload for each user
  const userWorkloads = new Map<string, UserWorkload>();
  
  // Initialize user data
  users.forEach(user => {
    userWorkloads.set(user.id, {
      userId: user.id,
      totalHours: 0,
      tasks: []
    });
  });

  // 2. Process schedule details
  scheduleDetails.forEach(detail => {
    const userWorkload = userWorkloads.get(detail.assigned_user);
    if (!userWorkload) return;

    const startDate = new Date(detail.start_ts);
    const endDate = new Date(detail.finish_ts);
    const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

    userWorkload.tasks.push({
      taskId: detail.task_id,
      hours,
      startDate,
      endDate
    });

    userWorkload.totalHours += hours;
  });

  // 3. Calculate workload balance
  const workloads = Array.from(userWorkloads.values()).map(wl => wl.totalHours);
  const avgWorkload = workloads.reduce((sum, hours) => sum + hours, 0) / workloads.length;
  
  // Calculate variance
  const variance = workloads.reduce((sum, hours) => {
    const diff = hours - avgWorkload;
    return sum + (diff * diff);
  }, 0) / workloads.length;
  
  // Calculate standard deviation
  const stdDev = Math.sqrt(variance);
  
  // Calculate coefficient of variation (CV)
  const cv = stdDev / avgWorkload;
  
  // Convert to balance score (0-1, where 1 is perfectly balanced)
  const balanceScore = 1 / (1 + cv);
  
  return balanceScore;
}

export function calculateUserPerformance(input: OptimizationInput): Map<string, number> {
  const { users, scheduleDetails } = input;
  const performanceScores = new Map<string, number>();
  
  // 1. Calculate base performance metrics for each user
  users.forEach(user => {
    const userTasks = scheduleDetails.filter(detail => detail.assigned_user === user.id);
    
    if (userTasks.length === 0) {
      performanceScores.set(user.id, 0);
      return;
    }
    
    // Calculate metrics
    const totalHours = userTasks.reduce((sum, task) => {
      const start = new Date(task.start_ts);
      const end = new Date(task.finish_ts);
      return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }, 0);
    
    const avgTaskDuration = totalHours / userTasks.length;
    
    // Calculate performance score (0-1)
    // Higher score means better performance
    const score = Math.min(1, avgTaskDuration / 40); // Normalize to 40 hours per week
    
    performanceScores.set(user.id, score);
  });
  
  return performanceScores;
} 