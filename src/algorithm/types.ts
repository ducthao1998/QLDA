import { Task, Project, User, TaskDependency, UserSkill, TaskSkill, ScheduleRun, ScheduleDetail } from "@/app/types/table-types"

// Optimization Types
export interface OptimizationConfig {
  algorithm: 'multi_project_cpm';
  objective: {
    type: 'time' | 'resource' | 'cost' | 'multi';
    weights?: {
      time_weight: number;
      resource_weight: number;
      cost_weight: number;
    };
  };
  constraints: {
    max_duration?: number;
    min_resource_utilization?: number;
    max_cost?: number;
    respect_dependencies: boolean;
    respect_skills: boolean;
    respect_availability: boolean;
  };
}

export interface OptimizationResult {
  algorithm_used: string;
  original_makespan: number;
  optimized_makespan: number;
  improvement_percentage: number;
  resource_utilization_before: number;
  resource_utilization_after: number;
  workload_balance: number;
  explanation: OptimizationExplanation;
  schedule_changes: ScheduleChange[];
  critical_path: string[];
  critical_path_details?: {
    criticalPath: string[];
    totalDuration: number;
    criticalPathDuration: number;
    explanation: string;
    taskDetails: Array<{
      taskId: string;
      taskName: string;
      duration: number;
      slack: number;
      isCritical: boolean;
      reason: string;
    }>;
  };
  // Thêm thông tin chi tiết
  duration_analysis: {
    total_task_duration: number;
    original_parallel_duration: number;
    optimized_parallel_duration: number;
    duration_reduction: number;
    parallel_tasks_count: number;
  };
  resource_analysis: {
    total_users: number;
    assigned_users: number;
    average_workload: number;
    max_workload: number;
    min_workload: number;
    workload_distribution: UserWorkload[];
  };
  optimization_details: {
    tasks_parallelized: number;
    tasks_rescheduled: number;
    tasks_reassigned: number;
    critical_path_optimized: boolean;
    bottlenecks_identified: string[];
  };
}

export interface OptimizationExplanation {
  strategy: string;
  key_improvements: string[];
  trade_offs: string[];
  constraints_considered: string[];
  why_optimal: string;
}

export interface ScheduleChange {
  task_id: string;
  task_name: string;
  change_type: 'moved' | 'reassigned' | 'parallelized' | 'duration_optimized';
  original_start: string;
  new_start: string;
  original_assignee?: string;
  new_assignee?: string;
  reason: string;
  impact: string;
}

// Analysis Types
export interface ProjectAnalysis {
  critical_path: string[];
  total_duration: number;
  resource_utilization: number;
  workload_balance: number;
  risk_factors: RiskFactor[];
  recommendations: string[];
}

export interface RiskFactor {
  task_id: string;
  risk_level: 'low' | 'medium' | 'high';
  description: string;
  mitigation_strategy: string;
}

// Input Data for Optimization
export interface OptimizationInput {
  project: Project;
  tasks: Task[];
  users: User[];
  dependencies: TaskDependency[];
  userSkills: UserSkill[];
  taskSkills: TaskSkill[];
  scheduleRun: ScheduleRun;
  scheduleDetails: ScheduleDetail[];
} 

export interface UserWorkload {
  user_id: string;
  user_name: string;
  total_hours: number;
  task_count: number;
  utilization_percentage: number;
} 