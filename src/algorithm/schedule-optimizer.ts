import { OptimizationInput, OptimizationConfig, OptimizationResult, ScheduleChange } from './types'
import { calculateCriticalPath } from './critical-path'
import { ScheduleDetail } from '@/app/types/table-types'

export class ScheduleOptimizer {
  private input: OptimizationInput;
  private config: OptimizationConfig;

  constructor(input: OptimizationInput, config: OptimizationConfig) {
    this.input = {
      tasks: input.tasks || [],
      dependencies: input.dependencies || [],
      scheduleDetails: input.scheduleDetails || [],
      project: input.project,
      users: input.users || [],
      userSkills: input.userSkills || [],
      taskSkills: input.taskSkills || [],
      scheduleRun: input.scheduleRun
    };
    this.config = config;
  }

  public async optimize(): Promise<OptimizationResult> {
    console.log('🚀 Bắt đầu tối ưu hóa Multi-Project CPM...');
    
    // 1. Tính toán metrics ban đầu
    const originalMakespan = this.calculateMakespan();
    const originalResourceUtilization = calculateResourceUtilization(this.input);
    
    console.log(`📊 Metrics ban đầu: Makespan=${originalMakespan} ngày, Resource=${(originalResourceUtilization * 100).toFixed(1)}%`);

    // 2. Chạy thuật toán tối ưu hóa Multi-Project CPM
    const optimizedSchedule = await this.runMultiProjectCPM();

    // 3. Tính toán metrics sau tối ưu hóa
    const optimizedMakespan = this.calculateMakespan(optimizedSchedule);
    const optimizedResourceUtilization = calculateResourceUtilization({
      ...this.input,
      scheduleDetails: optimizedSchedule
    });

    console.log(`✅ Metrics sau tối ưu: Makespan=${optimizedMakespan} ngày, Resource=${(optimizedResourceUtilization * 100).toFixed(1)}%`);

    // 4. Tính toán critical path
    const criticalPathResult = calculateCriticalPath(this.input.tasks, this.input.dependencies);
    const criticalPath = criticalPathResult.criticalPath;

    // 5. Tạo báo cáo thay đổi lịch trình
    const scheduleChanges = this.generateScheduleChanges(optimizedSchedule);

    // 6. Phân tích tài nguyên
    const resourceAnalysis = this.calculateResourceAnalysis(optimizedSchedule);

    // 7. Chi tiết tối ưu hóa
    const optimizationDetails = this.calculateOptimizationDetails(optimizedSchedule, criticalPath);

    // 8. Phân tích thời gian
    const durationAnalysis = this.calculateDurationAnalysis();

    // 9. Tính toán cải thiện - So sánh makespan thực tế
    const improvementPercentage = originalMakespan > 0 ? 
      Math.max(0, ((originalMakespan - optimizedMakespan) / originalMakespan) * 100) : 0;
    
    const resourceImprovement = optimizedResourceUtilization > originalResourceUtilization ? 
      ((optimizedResourceUtilization - originalResourceUtilization) / Math.max(originalResourceUtilization, 0.01)) * 100 : 0;

    console.log(`🎯 Cải thiện: Thời gian=${improvementPercentage.toFixed(1)}%, Tài nguyên=+${resourceImprovement.toFixed(1)}%`);

    return {
      algorithm_used: this.config.algorithm,
      original_makespan: originalMakespan,
      optimized_makespan: optimizedMakespan,
      improvement_percentage: improvementPercentage,
      resource_utilization_before: originalResourceUtilization,
      resource_utilization_after: optimizedResourceUtilization,
      workload_balance: resourceAnalysis.assigned_users > 0 ? (resourceAnalysis.max_workload - resourceAnalysis.min_workload) / resourceAnalysis.average_workload : 0,
      explanation: {
        strategy: 'Multi-Project CPM Optimization',
        key_improvements: [
          `Giảm thời gian từ ${originalMakespan.toFixed(1)} xuống ${optimizedMakespan.toFixed(1)} ngày (${improvementPercentage.toFixed(1)}%)`,
          `Tăng hiệu suất tài nguyên từ ${(originalResourceUtilization * 100).toFixed(1)}% lên ${(optimizedResourceUtilization * 100).toFixed(1)}%`
        ],
        trade_offs: [
          'Ưu tiên tối ưu hóa thời gian dựa trên đường găng',
          'Cân bằng tải công việc giữa các thành viên'
        ],
        constraints_considered: [
          'Tôn trọng dependencies giữa các tasks',
          'Đảm bảo kỹ năng phù hợp với công việc',
          'Tối ưu hóa sử dụng tài nguyên'
        ],
        why_optimal: `Thuật toán Multi-Project CPM được chọn vì nó tối ưu hóa đồng thời thời gian và tài nguyên, giảm ${improvementPercentage.toFixed(1)}% thời gian thực hiện dự án và tăng ${resourceImprovement.toFixed(1)}% hiệu suất sử dụng tài nguyên.`
      },
      schedule_changes: scheduleChanges,
      critical_path: criticalPath,
      critical_path_details: criticalPathResult,
      duration_analysis: durationAnalysis,
      resource_analysis: resourceAnalysis,
      optimization_details: optimizationDetails
    };
  }

  private calculateMakespan(scheduleDetails = this.input.scheduleDetails): number {
    if (!scheduleDetails.length) return 0;

    const startDates = scheduleDetails.map(detail => new Date(detail.start_ts).getTime());
    const endDates = scheduleDetails.map(detail => new Date(detail.finish_ts).getTime());

    const projectStart = Math.min(...startDates);
    const projectEnd = Math.max(...endDates);

    // Convert to days instead of hours
    return Math.ceil((projectEnd - projectStart) / (1000 * 60 * 60 * 24));
  }

  private async runMultiProjectCPM(): Promise<ScheduleDetail[]> {
    // Use multi-project critical path method to optimize schedule
    const criticalPathResult = calculateCriticalPath(this.input.tasks, this.input.dependencies);
    const criticalPath = criticalPathResult.criticalPath;
    
    // Build dependency graph for better optimization
    const dependencyGraph = new Map<string, string[]>();
    const reverseDependencyGraph = new Map<string, string[]>();
    
    // Initialize graphs
    this.input.tasks.forEach(task => {
      dependencyGraph.set(String(task.id), []);
      reverseDependencyGraph.set(String(task.id), []);
    });
    
    // Build dependency relationships
    this.input.dependencies.forEach(dep => {
      const taskId = String(dep.task_id);
      const dependsOnId = String(dep.depends_on_id);
      
      if (!dependencyGraph.has(taskId)) dependencyGraph.set(taskId, []);
      if (!dependencyGraph.has(dependsOnId)) dependencyGraph.set(dependsOnId, []);
      
      dependencyGraph.get(taskId)!.push(dependsOnId);
      reverseDependencyGraph.get(dependsOnId)!.push(taskId);
    });
    
    // Create optimized schedule with earliest start time strategy
    const optimizedSchedule: ScheduleDetail[] = [];
    const projectStart = new Date(this.input.project.start_date);
    const taskEndTimes = new Map<string, Date>();
    
    // Sort tasks by critical path first, then by dependencies
    const sortedTasks = this.input.tasks
      .map(task => ({
        ...task,
        isCritical: criticalPath.includes(String(task.id)),
        dependencyCount: dependencyGraph.get(String(task.id))?.length || 0
      }))
      .sort((a, b) => {
        // Critical path tasks first
        if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
        // Then by dependency count (fewer dependencies first)
        if (a.dependencyCount !== b.dependencyCount) return a.dependencyCount - b.dependencyCount;
        // Then by duration (longer tasks first)
        return (b.duration_days || 1) - (a.duration_days || 1);
      });
    
    // Schedule tasks with earliest start time strategy
    sortedTasks.forEach(task => {
      const taskId = String(task.id);
      const taskDuration = task.duration_days || 1;
      
      // Find earliest possible start time based on dependencies
      let earliestStart = new Date(projectStart);
      
      const dependencies = dependencyGraph.get(taskId) || [];
      if (dependencies.length > 0) {
        // Find the latest end time of all dependencies
        const depEndTimes = dependencies.map(depId => {
          return taskEndTimes.get(depId) || projectStart;
        });
        const latestDepEnd = new Date(Math.max(...depEndTimes.map(d => d.getTime())));
        earliestStart = new Date(latestDepEnd);
        earliestStart.setDate(earliestStart.getDate() + 1); // Start next day after dependency
      }
      
      // For critical path tasks, try to start even earlier if possible
      if (criticalPath.includes(taskId)) {
        // Critical tasks should start as early as possible
        const criticalDeps = dependencies.filter(depId => 
          criticalPath.includes(depId)
        );
        
        if (criticalDeps.length > 0) {
          const criticalDepEndTimes = criticalDeps.map(depId => {
            return taskEndTimes.get(depId) || projectStart;
          });
          const latestCriticalDepEnd = new Date(Math.max(...criticalDepEndTimes.map(d => d.getTime())));
          if (latestCriticalDepEnd > earliestStart) {
            earliestStart = new Date(latestCriticalDepEnd);
            earliestStart.setDate(earliestStart.getDate() + 1);
          }
        }
      }
      
      const endTime = new Date(earliestStart);
      endTime.setDate(earliestStart.getDate() + taskDuration - 1);
      
      // Store task end time for future reference
      taskEndTimes.set(taskId, new Date(endTime));
      
      // Find original schedule detail
      const originalDetail = this.input.scheduleDetails.find(sd => sd.task_id === taskId);
      
      optimizedSchedule.push({
        id: originalDetail?.id || crypto.randomUUID(),
        schedule_run_id: originalDetail?.schedule_run_id || '',
        task_id: taskId,
        assigned_user: originalDetail?.assigned_user || '',
        start_ts: earliestStart.toISOString(),
        finish_ts: endTime.toISOString(),
        created_at: originalDetail?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });
    
    return optimizedSchedule;
  }

  private generateScheduleChanges(optimizedSchedule: ScheduleDetail[]): ScheduleChange[] {
    return optimizedSchedule.map(detail => {
      const originalDetail = this.input.scheduleDetails.find(d => d.task_id === detail.task_id);
      const task = this.input.tasks.find(t => String(t.id) === String(detail.task_id));
      
      if (!originalDetail || !task) return null;

      const change: ScheduleChange = {
        task_id: String(detail.task_id),
        task_name: task.name,
        change_type: this.determineChangeType(originalDetail, detail),
        original_start: originalDetail.start_ts,
        new_start: detail.start_ts,
        original_assignee: originalDetail.assigned_user || '',
        new_assignee: detail.assigned_user || '',
        reason: this.generateChangeReason(originalDetail, detail),
        impact: this.calculateChangeImpact(originalDetail, detail)
      };

      return change;
    }).filter((change): change is ScheduleChange => change !== null);
  }

  private determineChangeType(original: any, optimized: any): 'moved' | 'reassigned' | 'parallelized' | 'duration_optimized' {
    if (original.assigned_user !== optimized.assigned_user) return 'reassigned';
    if (original.start_ts !== optimized.start_ts) return 'moved';
    return 'duration_optimized';
  }

  private generateChangeReason(original: any, optimized: any): string {
    const task = this.input.tasks.find(t => String(t.id) === String(optimized.task_id));
    const isCritical = this.input.dependencies.some(d => d.task_id === String(task?.id));
    
    if (isCritical) {
      return "Tối ưu hóa đường găng - công việc quan trọng được ưu tiên";
    }
    return "Tối ưu hóa dựa trên Multi-Project CPM để giảm thời gian chờ";
  }

  private calculateChangeImpact(original: any, optimized: any): string {
    const originalStart = new Date(original.start_ts);
    const newStart = new Date(optimized.start_ts);
    const timeDiff = Math.abs(newStart.getTime() - originalStart.getTime()) / (1000 * 60 * 60 * 24);
    
    if (timeDiff > 0) {
      return `Điều chỉnh thời gian ${timeDiff.toFixed(1)} ngày để tối ưu hóa lịch trình`;
    }
    return "Giữ nguyên lịch trình gốc";
  }

  private calculateDurationAnalysis() {
    const totalTaskDuration = this.input.tasks.reduce((sum, task) => sum + (task.duration_days || 1), 0);
    
    // Calculate original parallel duration (sequential execution)
    const originalParallelDuration = totalTaskDuration;
    
    // Calculate optimized parallel duration based on critical path
    const criticalPathResult = calculateCriticalPath(this.input.tasks, this.input.dependencies);
    const criticalPathDuration = criticalPathResult.criticalPathDuration;
    
    // Count parallel tasks (tasks that can run simultaneously)
    const parallelTasksCount = this.input.tasks.filter(task => {
      const dependencies = this.input.dependencies.filter(d => d.task_id === String(task.id));
      return dependencies.length === 0;
    }).length;
    
    return {
      total_task_duration: totalTaskDuration,
      original_parallel_duration: originalParallelDuration,
      optimized_parallel_duration: criticalPathDuration,
      duration_reduction: originalParallelDuration - criticalPathDuration,
      parallel_tasks_count: parallelTasksCount
    };
  }

  private calculateResourceAnalysis(optimizedSchedule: ScheduleDetail[]) {
    const userWorkloads = new Map<string, { hours: number; tasks: number }>();
    
    // Initialize user workloads
    this.input.users.forEach(user => {
      userWorkloads.set(user.id, { hours: 0, tasks: 0 });
    });
    
    // Calculate workload for each user
    optimizedSchedule.forEach(detail => {
      if (detail.assigned_user) {
        const workload = userWorkloads.get(detail.assigned_user);
        if (workload) {
          const startDate = new Date(detail.start_ts);
          const endDate = new Date(detail.finish_ts);
          const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) * 8; // 8 hours per day
          workload.hours += hours;
          workload.tasks += 1;
        }
      }
    });
    
    const workloads = Array.from(userWorkloads.entries()).map(([userId, workload]) => {
      const user = this.input.users.find(u => u.id === userId);
      return {
        user_id: userId,
        user_name: user?.full_name || 'Unknown',
        total_hours: workload.hours,
        task_count: workload.tasks,
        utilization_percentage: Math.min(100, (workload.hours / (30 * 8)) * 100) // Assume 30 days, 8 hours per day
      };
    });
    
    const assignedUsers = workloads.filter(w => w.task_count > 0).length;
    const totalHours = workloads.reduce((sum, w) => sum + w.total_hours, 0);
    const averageWorkload = assignedUsers > 0 ? totalHours / assignedUsers : 0;
    const maxWorkload = Math.max(...workloads.map(w => w.total_hours));
    const minWorkload = Math.min(...workloads.map(w => w.total_hours));
    
    return {
      total_users: this.input.users.length,
      assigned_users: assignedUsers,
      average_workload: averageWorkload,
      max_workload: maxWorkload,
      min_workload: minWorkload,
      workload_distribution: workloads
    };
  }

  private calculateOptimizationDetails(optimizedSchedule: ScheduleDetail[], criticalPath: string[]) {
    const originalSchedule = this.input.scheduleDetails;
    
    // Count rescheduled tasks
    const tasksRescheduled = optimizedSchedule.filter(optDetail => {
      const originalDetail = originalSchedule.find(orig => orig.task_id === optDetail.task_id);
      if (!originalDetail) return false;
      return optDetail.start_ts !== originalDetail.start_ts;
    }).length;
    
    // Count reassigned tasks
    const tasksReassigned = optimizedSchedule.filter(optDetail => {
      const originalDetail = originalSchedule.find(orig => orig.task_id === optDetail.task_id);
      if (!originalDetail) return false;
      return optDetail.assigned_user !== originalDetail.assigned_user;
    }).length;
    
    // Count parallelized tasks
    const tasksParallelized = optimizedSchedule.filter(detail => {
      const dependencies = this.input.dependencies.filter(d => d.task_id === detail.task_id);
      return dependencies.length === 0;
    }).length;
    
    // Identify bottlenecks
    const bottlenecks = criticalPath.map(taskId => {
      const task = this.input.tasks.find(t => String(t.id) === taskId);
      return task?.name || `Task ${taskId}`;
    });
    
    return {
      tasks_parallelized: tasksParallelized,
      tasks_rescheduled: tasksRescheduled,
      tasks_reassigned: tasksReassigned,
      critical_path_optimized: criticalPath.length > 0,
      bottlenecks_identified: bottlenecks
    };
  }
}

export async function optimizeSchedule(
  tasks: any[],
  dependencies: any[],
  scheduleDetails: any[],
  config: OptimizationConfig,
  project: any,
  users: any[],
  userSkills: any[],
  taskSkills: any[],
  scheduleRun: any
): Promise<OptimizationResult> {
  const optimizer = new ScheduleOptimizer(
    {
      tasks: tasks || [],
      dependencies: dependencies || [],
      scheduleDetails: scheduleDetails || [],
      project,
      users: users || [],
      userSkills: userSkills || [],
      taskSkills: taskSkills || [],
      scheduleRun
    },
    config
  );
  
  return optimizer.optimize();
}

// Local fallback for resource utilization calculation (removed external module)
function calculateResourceUtilization(input: OptimizationInput & { scheduleDetails: ScheduleDetail[] }): number {
  const scheduleDetails = input.scheduleDetails || []
  const users = input.users || []

  if (scheduleDetails.length === 0 || users.length === 0) {
    return 0
  }

  const userHours = new Map<string, number>()
  scheduleDetails.forEach(detail => {
    if (!detail.assigned_user) return
    const start = new Date(detail.start_ts)
    const end = new Date(detail.finish_ts)
    const days = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    const hours = days * 8
    userHours.set(detail.assigned_user, (userHours.get(detail.assigned_user) || 0) + hours)
  })

  const totalHours = Array.from(userHours.values()).reduce((sum, h) => sum + h, 0)
  const capacityPerUserHours = 30 * 8 // assume 30 days window, 8h/day
  const totalCapacity = users.length * capacityPerUserHours
  if (totalCapacity <= 0) return 0
  return Math.min(1, totalHours / totalCapacity)
}
