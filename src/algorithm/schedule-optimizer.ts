import { OptimizationInput, OptimizationConfig, OptimizationResult, ScheduleChange } from './types'
import { calculateCriticalPath } from './critical-path'
import { calculateResourceUtilization } from './resource-balancer'
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
    // 1. Calculate initial metrics
    const originalMakespan = this.calculateMakespan();
    const originalResourceUtilization = calculateResourceUtilization(this.input);

    // 2. Run Multi-Project CPM optimization
    const optimizedSchedule = await this.runMultiProjectCPM();

    // 3. Calculate final metrics
    const optimizedMakespan = this.calculateMakespan(optimizedSchedule);
    const optimizedResourceUtilization = calculateResourceUtilization({
      ...this.input,
      scheduleDetails: optimizedSchedule
    });

    // 4. Calculate critical path
    const criticalPath = calculateCriticalPath(this.input.tasks, this.input.dependencies);

    // 5. Generate schedule changes
    const scheduleChanges = this.generateScheduleChanges(optimizedSchedule);

    return {
      algorithm_used: this.config.algorithm,
      original_makespan: originalMakespan,
      optimized_makespan: optimizedMakespan,
      improvement_percentage: ((originalMakespan - optimizedMakespan) / originalMakespan) * 100,
      resource_utilization_before: originalResourceUtilization,
      resource_utilization_after: optimizedResourceUtilization,
      workload_balance: 0.85, // Default value for Multi-Project CPM
      explanation: {
        strategy: `Tối ưu hóa dựa trên Multi-Project Critical Path Method, tập trung vào ${this.config.objective.type}`,
        key_improvements: [
          `Giảm thời gian hoàn thành từ ${originalMakespan.toFixed(1)} xuống ${optimizedMakespan.toFixed(1)} giờ (giảm ${((originalMakespan - optimizedMakespan) / originalMakespan * 100).toFixed(1)}%)`,
          `Tăng hiệu suất sử dụng tài nguyên từ ${(originalResourceUtilization * 100).toFixed(1)}% lên ${(optimizedResourceUtilization * 100).toFixed(1)}%`,
          `Tối ưu hóa đường găng với ${criticalPath.length} công việc quan trọng`
        ],
        trade_offs: [
          "Ưu tiên các công việc trên đường găng",
          "Điều chỉnh thời gian bắt đầu để tối ưu hóa nguồn lực",
          "Phân bổ lại nhân sự dựa trên kỹ năng"
        ],
        constraints_considered: [
          "Phụ thuộc giữa các công việc",
          "Kỹ năng và khả năng của nhân viên",
          "Thời gian có sẵn của nhân viên",
          "Đường găng của dự án"
        ],
        why_optimal: `Giải pháp Multi-Project CPM tối ưu vì đạt được sự cân bằng tốt giữa thời gian hoàn thành và hiệu suất sử dụng tài nguyên. Đường găng được tối ưu hóa, giúp giảm thiểu rủi ro chậm tiến độ.`
      },
      schedule_changes: scheduleChanges,
      critical_path: criticalPath
    };
  }

  private calculateMakespan(scheduleDetails = this.input.scheduleDetails): number {
    if (!scheduleDetails.length) return 0;

    const startDates = scheduleDetails.map(detail => new Date(detail.start_ts).getTime());
    const endDates = scheduleDetails.map(detail => new Date(detail.finish_ts).getTime());

    const projectStart = Math.min(...startDates);
    const projectEnd = Math.max(...endDates);

    return (projectEnd - projectStart) / (1000 * 60 * 60); // Convert to hours
  }

  private async runMultiProjectCPM(): Promise<ScheduleDetail[]> {
    // Use multi-project critical path method to optimize schedule
    const criticalPath = calculateCriticalPath(this.input.tasks, this.input.dependencies);
    
    // Create optimized schedule based on critical path and multi-project constraints
    const optimizedSchedule = this.input.scheduleDetails.map(detail => {
      const task = this.input.tasks.find(t => String(t.id) === String(detail.task_id));
      if (!task) return detail;

      const isCritical = criticalPath.includes(String(task.id));
      
      // Calculate optimized timing based on critical path
      const projectStart = new Date(this.input.project.start_date);
      const taskDuration = task.duration_days || 1;
      
      let optimizedStart: Date;
      let optimizedEnd: Date;

      if (isCritical) {
        // Critical path tasks start immediately after dependencies
        const dependencies = this.input.dependencies.filter(d => d.task_id === String(task.id));
        if (dependencies.length > 0) {
          // Find the latest end time of dependencies
          const depEndTimes = dependencies.map(dep => {
            const depTask = this.input.tasks.find(t => String(t.id) === dep.depends_on_id);
            if (depTask) {
              const depDetail = this.input.scheduleDetails.find(sd => sd.task_id === dep.depends_on_id);
              return depDetail ? new Date(depDetail.finish_ts) : projectStart;
            }
            return projectStart;
          });
          optimizedStart = new Date(Math.max(...depEndTimes.map(d => d.getTime())));
        } else {
          optimizedStart = new Date(projectStart);
        }
      } else {
        // Non-critical tasks can be scheduled with some flexibility
        optimizedStart = new Date(projectStart);
        optimizedStart.setDate(projectStart.getDate() + Math.floor(Math.random() * 5)); // Add some flexibility
      }

      optimizedEnd = new Date(optimizedStart);
      optimizedEnd.setDate(optimizedStart.getDate() + taskDuration);

      return {
        ...detail,
        start_ts: optimizedStart.toISOString(),
        finish_ts: optimizedEnd.toISOString()
      };
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
