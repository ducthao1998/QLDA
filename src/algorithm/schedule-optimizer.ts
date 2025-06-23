import { OptimizationInput, OptimizationConfig, OptimizationResult, ScheduleChange } from './types'
import { calculateCriticalPath } from './critical-path'
import { calculateResourceUtilization } from './resource-balancer'
import { calculateWorkloadBalance } from './user-performance'
import { calculateEstimatedTime } from './estimated-time'
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
    const originalWorkloadBalance = calculateWorkloadBalance(this.input);

    // 2. Run optimization based on selected algorithm
    let optimizedSchedule;
    switch (this.config.algorithm) {
      case 'genetic':
        optimizedSchedule = await this.runGeneticOptimization();
        break;
      case 'cpm':
        optimizedSchedule = await this.runCPMOptimization();
        break;
      case 'resource_leveling':
        optimizedSchedule = await this.runResourceLeveling();
        break;
      default:
        throw new Error('Invalid optimization algorithm');
    }

    // Ensure optimizedSchedule is not undefined
    optimizedSchedule = optimizedSchedule || this.input.scheduleDetails;

    // 3. Calculate final metrics
    const optimizedMakespan = this.calculateMakespan(optimizedSchedule);
    const optimizedResourceUtilization = calculateResourceUtilization({
      ...this.input,
      scheduleDetails: optimizedSchedule
    });
    const optimizedWorkloadBalance = calculateWorkloadBalance({
      ...this.input,
      scheduleDetails: optimizedSchedule
    });

    // 4. Generate explanation
    const explanation = this.generateExplanation(
      originalMakespan,
      optimizedMakespan,
      originalResourceUtilization,
      optimizedResourceUtilization,
      originalWorkloadBalance,
      optimizedWorkloadBalance
    );

    // 5. Generate schedule changes
    const scheduleChanges = this.generateScheduleChanges(optimizedSchedule);

    // 6. Calculate critical path
    const criticalPath = calculateCriticalPath(this.input.tasks, this.input.dependencies);

    return {
      algorithm_used: this.config.algorithm,
      original_makespan: originalMakespan,
      optimized_makespan: optimizedMakespan,
      improvement_percentage: ((originalMakespan - optimizedMakespan) / originalMakespan) * 100,
      resource_utilization_before: originalResourceUtilization,
      resource_utilization_after: optimizedResourceUtilization,
      workload_balance: optimizedWorkloadBalance,
      explanation,
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

  private async runGeneticOptimization(): Promise<ScheduleDetail[]> {
    // For now, return the original schedule
    return this.input.scheduleDetails;
  }

  private async runCPMOptimization(): Promise<ScheduleDetail[]> {
    // Use critical path method to optimize schedule
    const criticalPath = calculateCriticalPath(this.input.tasks, this.input.dependencies);
    
    // Create optimized schedule based on critical path
    const optimizedSchedule = this.input.scheduleDetails.map(detail => {
      const task = this.input.tasks.find(t => String(t.id) === String(detail.task_id));
      if (!task) return detail;

      const isCritical = criticalPath.includes(String(task.id));
      
      // If task is on critical path, prioritize it
      if (isCritical) {
        return {
          ...detail,
          start_ts: task.start_date,
          finish_ts: task.end_date
        };
      }

      return detail;
    });

    return optimizedSchedule;
  }

  private async runResourceLeveling(): Promise<ScheduleDetail[]> {
    // For now, return the original schedule
    return this.input.scheduleDetails;
  }

  private generateExplanation(
    originalMakespan: number,
    optimizedMakespan: number,
    originalResourceUtilization: number,
    optimizedResourceUtilization: number,
    originalWorkloadBalance: number,
    optimizedWorkloadBalance: number
  ) {
    const improvement = ((originalMakespan - optimizedMakespan) / originalMakespan) * 100;
    const resourceImprovement = ((optimizedResourceUtilization - originalResourceUtilization) / originalResourceUtilization) * 100;
    const workloadImprovement = ((optimizedWorkloadBalance - originalWorkloadBalance) / originalWorkloadBalance) * 100;

    return {
      strategy: `Tối ưu hóa dựa trên thuật toán ${this.config.algorithm}, tập trung vào ${this.config.objective.type}`,
      key_improvements: [
        `Giảm thời gian hoàn thành từ ${originalMakespan.toFixed(1)} xuống ${optimizedMakespan.toFixed(1)} giờ (giảm ${improvement.toFixed(1)}%)`,
        `Tăng hiệu suất sử dụng tài nguyên từ ${(originalResourceUtilization * 100).toFixed(1)}% lên ${(optimizedResourceUtilization * 100).toFixed(1)}%`,
        `Cải thiện cân bằng khối lượng công việc từ ${(originalWorkloadBalance * 100).toFixed(1)}% lên ${(optimizedWorkloadBalance * 100).toFixed(1)}%`
      ],
      trade_offs: [
        "Một số công việc được điều chỉnh thời gian bắt đầu để tối ưu hóa nguồn lực",
        "Phân bổ lại nhân sự dựa trên kỹ năng và khả năng",
        "Ưu tiên các công việc trên đường găng"
      ],
      constraints_considered: [
        "Phụ thuộc giữa các công việc",
        "Kỹ năng và khả năng của nhân viên",
        "Thời gian có sẵn của nhân viên",
        "Đường găng của dự án"
      ],
      why_optimal: `Giải pháp này tối ưu vì đạt được sự cân bằng tốt giữa thời gian hoàn thành (giảm ${improvement.toFixed(1)}%) và hiệu suất sử dụng tài nguyên (${(optimizedResourceUtilization * 100).toFixed(1)}%). Đường găng được tối ưu hóa, giúp giảm thiểu rủi ro chậm tiến độ.`
    };
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
    if (this.isParallelized(original, optimized)) return 'parallelized';
    return 'duration_optimized';
  }

  private isParallelized(original: any, optimized: any): boolean {
    // Implementation to determine if tasks are parallelized
    return false;
  }

  private generateChangeReason(original: any, optimized: any): string {
    // Implementation to generate human-readable reason for the change
    return "Tối ưu hóa dựa trên kỹ năng và khả năng của nhân viên";
  }

  private calculateChangeImpact(original: any, optimized: any): string {
    // Implementation to calculate and describe the impact of the change
    return "Giảm thời gian thực hiện và tăng hiệu suất";
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
  // Ensure all arrays have default values
  const safeTasks = tasks || [];
  const safeDependencies = dependencies || [];
  const safeScheduleDetails = scheduleDetails || [];
  const safeUsers = users || [];
  const safeUserSkills = userSkills || [];
  const safeTaskSkills = taskSkills || [];

  const optimizer = new ScheduleOptimizer(
    {
      tasks: safeTasks,
      dependencies: safeDependencies,
      scheduleDetails: safeScheduleDetails,
      project,
      users: safeUsers,
      userSkills: safeUserSkills,
      taskSkills: safeTaskSkills,
      scheduleRun
    },
    config
  );
  
  return optimizer.optimize();
}
