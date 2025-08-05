// Helper type for JSONB columns
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

// ==========================================================
// ENUMS
// ==========================================================

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "blocked"
  | "review"
  | "done"
  | "archived"

export type RaciRole = "R" | "A" | "C" | "I"

export type ProjectClassification = "A" | "B" | "C"


// ==========================================================
// BẢNG VÀ VIEW CỐT LÕI
// ==========================================================

// 1. users
export interface User {
  id: string          // PK, FK → auth.users
  full_name: string
  position: string
  org_unit: string
  email: string
  phone_number: string | null
  created_at: string
}

// 2. external_orgs
export interface ExternalOrg {
  id: string          // PK
  name: string
  contact_info: string | null
}

// 3. projects
export interface Project {
  id: string
  name: string
  description: string
  status: string
  start_date: string
  classification: ProjectClassification | null
  project_field: string | null
  total_investment?: string | null
  users?: {
    full_name: string
    position: string
    org_unit: string
  }
  user_statistics: {
    by_user: Array<{
      user_id: string
      full_name: string
      position: string
      org_unit: string
      total_tasks: number
      completed_tasks: number
      in_progress_tasks: number
      overdue_tasks: number
      completion_rate: number
      avg_task_duration: number
      workload_score: number
    }>
    skills_utilization: Array<{
      skill_name: string
      skill_field: string
      users_count: number
      tasks_count: number
      utilization_rate: number
    }>
    workload_distribution: Array<{
      org_unit: string
      total_users: number
      total_tasks: number
      avg_workload: number
      completion_rate: number
    }>
  }
  time_statistics: {
    monthly_trends: Array<{
      month: string
      completed_tasks: number
      created_tasks: number
      overdue_tasks: number
      completion_rate: number
    }>
    weekly_productivity: Array<{
      week: string
      productivity_score: number
      tasks_completed: number
      avg_completion_time: number
    }>
    deadline_performance: Array<{
      period: string
      on_time: number
      late: number
      early: number
      on_time_rate: number
    }>
  }
  advanced_analytics: {
    bottlenecks: Array<{
      type: string
      description: string
      impact_score: number
      affected_tasks: number
      recommendations: string[]
    }>
    predictions: {
      project_completion_forecast: Array<{
        project_name: string
        predicted_completion: string
        confidence: number
        risk_factors: string[]
      }>
      resource_needs: Array<{
        skill_name: string
        current_capacity: number
        predicted_demand: number
        gap: number
      }>
    }
    kpis: {
      efficiency_score: number
      quality_score: number
      resource_utilization: number
      customer_satisfaction: number
      innovation_index: number
    }
  }
}

// 4. tasks
export interface Task {
   id: number
   project_id: string  // FK -> projects.id
   name: string
   status: TaskStatus
   note?: string
   duration_days?: number
   template_id?: number | null; // FK -> task_templates.id
   // KHÔNG cần thêm skill_id ở đây. Mối quan hệ được xử lý qua bảng task_skills.
}

// 5. task_dependencies
export interface TaskDependency {
  id: number           // serial PK (auto)
  task_id: string      // FK → tasks.id
  depends_on_id: string // FK → tasks.id
  created_at?: string   // timestamp ISO
  updated_at?: string   // timestamp ISO
  dependency_task?: {
    id: string
    name: string
    status: TaskStatus
    progress_percentage?: number
  }
}

// 6. task_raci
export interface TaskRaci {
  id: number              // serial PK
  task_id: string         // FK → tasks.id
  user_id: string  // FK → users.id
  external_org_id: string | null // FK → external_orgs.id
  role: RaciRole
  created_at: string
  updated_at: string
  users?: {
    full_name: string
    position?: string
    org_unit?: string
  }
}



// ==========================================================
// CÁC BẢNG & VIEW MỚI
// ==========================================================

// 8. skills
export interface Skill {
  id: number;
  name: string;
  field: string | null; // Lĩnh vực: 'Xây dựng', 'CNTT', 'Pháp lý'
  created_at: string;
}

// 9. task_templates
export interface TaskTemplate {
  id: number;
  name: string;
  description: string | null;
  applicable_classification: string[];
  default_duration_days: number | null;
  created_at: string;
  sequence_order?: number; // Added for sorting templates
}

// 10. task_skills (Bảng trung gian)
export interface TaskSkill {
    task_id: string;      // PK, FK -> tasks.id
    skill_id: number;     // PK, FK -> skills.id
}

// 11. user_skill_matrix (VIEW mới)
export interface UserSkillMatrixView {
  user_id: string;
  full_name: string;
  skill_id: number;
  skill_name: string;
  skill_field: string | null;
  completed_tasks_count: number;
  total_experience_days: number | null;
  last_activity_date: string | null;
}

// ==========================================================
// CÁC BẢNG PHỤ (VẦN CÓ THỂ CẦN THIẾT)
// ==========================================================

// 12. worklogs
export interface Worklog {
  id: number
  task_id: string
  user_id: string
  spent_hours: number
  log_date: Date
  note: string | null
}

// 13. comments
export interface Comment {
  id: number
  task_id: string
  user_id: string
  body: string
}

// 14. attachments
export interface Attachment {
  id: string
  task_id: string
  file_url: string
  file_name: string
  uploaded_by: string
}

// 15. task_progress
export interface TaskProgress {
  id: number
  task_id: string
  planned_start: string | null
  planned_finish: string | null
  actual_start: string | null
  actual_finish: string | null
  status_snapshot: "on_time" | "late" | "ahead"
  snapshot_at: string
}

// 16. task_history
export interface TaskHistory {
  id: number
  task_id: string
  user_id: string
  action: string
  from_val: string | null
  to_val: string | null
  created_at: string
}

// 17. task_template_skills (Bảng trung gian)
export interface TaskTemplateSkill {
  template_id: number; // PK, FK -> task_templates.id
  skill_id: number;    // PK, FK -> skills.id
}

// ==========================================================
// DASHBOARD STATISTICS TYPES
// ==========================================================

export interface DashboardData {
  overview: {
    total_projects: number
    active_projects: number
    total_tasks: number
    completed_tasks: number
    overdue_tasks: number
    users_count: number
    completion_rate: number
    on_time_rate: number
  }
  task_statistics: {
    by_status: Array<{ status: string; count: number; percentage: number }>
    by_template: Array<{ template_name: string; count: number; avg_duration: number }>
    by_classification: Array<{ classification: string; count: number; avg_progress: number }>
  }}

  export interface TaskTemplateDependency {
    id: number;                      // serial PK (auto)
    template_id: number;             // FK -> task_templates.id (Công việc này)
    depends_on_template_id: number;  // FK -> task_templates.id (...phụ thuộc vào công việc mẫu này)
  }
