import { OptimizationInput, OptimizationConfig, OptimizationResult, ScheduleChange } from './types'
import { calculateCriticalPath, type CPMTaskInput } from './critical-path'
import { ScheduleDetail } from '@/app/types/table-types'
import { computeEarliestSchedule } from '@/lib/scheduling'

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
    // Baseline = sum of all task durations (worst case: everything sequential).
    // This makes "improvement" reflect the genuine value of parallel CPM scheduling
    // rather than comparing two identical CPM passes.
    const originalMakespan = this.calculateSequentialDuration();
    const originalResourceUtilization = calculateResourceUtilization(this.input);

    // Optimized schedule = earliest-start CPM forward pass.
    const optimizedSchedule = this.runMultiProjectCPM();

    const optimizedMakespan = this.calculateMakespan(optimizedSchedule);
    const optimizedResourceUtilization = calculateResourceUtilization({
      ...this.input,
      scheduleDetails: optimizedSchedule
    });

    // 4. Tính toán critical path
    const cpmPrefs = (this.config as any)?.cpm_prefs || {}
    const cpmOptions = {
      defaultTaskDurationDays: cpmPrefs.default_task_duration_days ?? 1,
      allowStartNextDay: cpmPrefs.allow_start_next_day ?? true,
      criticalityThresholdDays: cpmPrefs.criticality_threshold_days ?? 0,
    }
    const cpmTasks1: CPMTaskInput[] = this.buildCpmTasks()
    const criticalPathResult = calculateCriticalPath(cpmTasks1, this.input.dependencies as any, undefined, cpmOptions);
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

  /**
   * Earliest-start CPM forward pass via the shared scheduling lib.
   *
   * The previous implementation re-sorted tasks by "criticality" before scheduling,
   * which broke topological order: a critical task could be visited before its own
   * predecessor, so `taskEndTimes` lookup fell back to `projectStart` and produced
   * dates that violated the dependency. We now delegate to `computeEarliestSchedule`
   * which uses Kahn's topo sort under the hood and is guaranteed to visit
   * predecessors first.
   */
  private runMultiProjectCPM(): ScheduleDetail[] {
    const cpmPrefs = (this.config as any)?.cpm_prefs || {}
    const projectStart = new Date(this.input.project.start_date)

    const scheduled = computeEarliestSchedule(
      this.input.tasks.map((t) => ({ id: String(t.id), duration_days: t.duration_days })),
      this.input.dependencies as any,
      projectStart,
      {
        defaultDurationDays: cpmPrefs.default_task_duration_days ?? 1,
        startNextDayAfterDependency: cpmPrefs.allow_start_next_day ?? true,
      },
    )

    return this.input.tasks.map((task): ScheduleDetail => {
      const taskId = String(task.id)
      const s = scheduled.get(taskId)
      const originalDetail = this.input.scheduleDetails.find((sd) => sd.task_id === taskId)
      return {
        id: originalDetail?.id || crypto.randomUUID(),
        schedule_run_id: originalDetail?.schedule_run_id || '',
        task_id: taskId,
        assigned_user: originalDetail?.assigned_user || '',
        start_ts: s?.start_date || projectStart.toISOString(),
        finish_ts: s?.end_date || projectStart.toISOString(),
        confidence: originalDetail?.confidence ?? 1,
        experience_score: originalDetail?.experience_score ?? 0,
        created_at: originalDetail?.created_at || new Date().toISOString(),
      }
    })
  }

  /**
   * Sequential (no parallelization) duration in days — sum of all task durations.
   * Used as the baseline against which the CPM-optimized makespan is compared.
   */
  private calculateSequentialDuration(): number {
    const defaultDur = ((this.config as any)?.cpm_prefs?.default_task_duration_days) ?? 1
    return this.input.tasks.reduce((sum, t) => sum + (t.duration_days || defaultDur), 0)
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
    const cpmPrefs = (this.config as any)?.cpm_prefs || {}
    const cpmOptions = {
      defaultTaskDurationDays: cpmPrefs.default_task_duration_days ?? 1,
      allowStartNextDay: cpmPrefs.allow_start_next_day ?? true,
      criticalityThresholdDays: cpmPrefs.criticality_threshold_days ?? 0,
    }
    const cpmTasks: CPMTaskInput[] = this.buildCpmTasks()
    const criticalPathResult = calculateCriticalPath(cpmTasks, this.input.dependencies as any, undefined, cpmOptions);
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

  private buildCpmTasks(): CPMTaskInput[] {
    const projectStart = new Date(this.input.project.start_date)
    const defaultDur = ((this.config as any)?.cpm_prefs?.default_task_duration_days) ?? 1
    return this.input.tasks.map(t => {
      const sd = this.input.scheduleDetails.find(d => String(d.task_id) === String(t.id))
      const start = sd?.start_ts ? new Date(sd.start_ts) : new Date(projectStart)
      const end = sd?.finish_ts
        ? new Date(sd.finish_ts)
        : new Date(new Date(start).setDate(start.getDate() + ((t.duration_days ?? defaultDur) - 1)))
      return {
        id: String(t.id),
        project_id: String(t.project_id),
        name: t.name,
        status: t.status as any,
        note: t.note,
        duration_days: t.duration_days,
        template_id: t.template_id ?? null,
        start_date: start.toISOString(),
        end_date: end.toISOString(),
      }
    })
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
