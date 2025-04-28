// enums
export type TaskStatus = 
  | "todo" 
  | "in_progress" 
  | "blocked" 
  | "review" 
  | "done" 
  | "archived"

export type RaciRole = "R" | "A" | "C" | "I"

////////////////////////////////////////////////////
// 1. users
export interface User {
  id: string            // PK, FK → auth.users
  full_name: string
  position: string
  org_unit: string
  email: string
  phone_number: string | null
  capacity_hrs: number
  created_at: string
  updated_at: string
}

////////////////////////////////////////////////////
// 2. external_orgs
export interface ExternalOrg {
  id: string            // PK
  name: string
  contact_info: string | null
}

////////////////////////////////////////////////////
// 3. projects
export interface Project {
  id: string
  name: string
  description: string | null
  start_date: string
  deadline: string
  priority: number
  status: "planning" | "in_progress" | "completed" | "on_hold" | "cancelled"
  created_at: string
  updated_at: string
  complexity: number
  business_value: number
  technical_risk: number
  dependencies: string | null
  historical_data: string | null
}

////////////////////////////////////////////////////
// 4. tasks
export interface Task {
  id: string            // PK
  project_id: string    // FK → projects.id
  name: string
  description: string | null
  status: TaskStatus
  priority: number      // 1-5 scale
  estimate_low: number
  estimate_high: number
  weight: number
  due_date: string
  max_rejections: number
  current_rej: number
  risk_level: number
  complexity: number
  created_at: string
  updated_at: string
  assigned_to: string | null
}

////////////////////////////////////////////////////
// 5. task_dependencies
export interface TaskDependency {
  id: number            // serial PK
  task_id: string       // FK → tasks.id
  depends_on_id: string // FK → tasks.id
}

////////////////////////////////////////////////////
// 6. task_raci
export interface TaskRaci {
  id: number              // serial PK
  task_id: string         // FK → tasks.id
  user_id: string | null  // FK → users.id
  external_org_id: string | null // FK → external_orgs.id
  role: RaciRole
}

////////////////////////////////////////////////////
// 7. worklogs
export interface Worklog {
  id: number            // serial PK
  task_id: string       // FK → tasks.id
  user_id: string       // FK → users.id
  spent_hours: number
  log_date: string      // "YYYY-MM-DD"
  note: string | null
}

////////////////////////////////////////////////////
// 8. comments
export interface Comment {
  id: number            // serial PK
  task_id: string       // FK → tasks.id
  user_id: string       // FK → users.id
  body: string
}

////////////////////////////////////////////////////
// 9. attachments
export interface Attachment {
  id: string            // uuid PK
  task_id: string       // FK → tasks.id
  file_url: string
  file_name: string
  uploaded_by: string   // FK → users.id
}

////////////////////////////////////////////////////
// 10. task_progress
export interface TaskProgress {
  id: number            // serial PK
  task_id: string       // FK → tasks.id
  planned_start: string | null   // "YYYY-MM-DD"
  planned_finish: string | null  // "YYYY-MM-DD"
  actual_start: string | null    // "YYYY-MM-DD"
  actual_finish: string | null   // "YYYY-MM-DD"
  status_snapshot: "on_time" | "late" | "ahead"
  snapshot_at: string    // timestamp ISO
}

////////////////////////////////////////////////////
// 11. skills
export interface Skill {
  id: number            // serial PK
  name: string
}

////////////////////////////////////////////////////
// 12. user_skills
export interface UserSkill {
  user_id: string       // PK, FK → users.id
  skill_id: number      // PK, FK → skills.id
  level: number         // 1..5
}

////////////////////////////////////////////////////
// 13. user_task_perf
export interface UserTaskPerf {
  id: number            // serial PK
  user_id: string       // FK → users.id
  task_id: string       // FK → tasks.id
  planned_hours: number
  actual_hours: number
  on_time: boolean
  qual_score: number    // 1..5
}

////////////////////////////////////////////////////
// 14. user_performance (VIEW)
export interface UserPerformance {
  id: string            // users.id
  full_name: string
  pct_on_time: number
  avg_quality: number
  perf_score: number    // 0..1
}

////////////////////////////////////////////////////
// 15. schedule_runs
export interface ScheduleRun {
  id: string            // uuid PK
  project_id: string    // FK → projects.id
  algorithm: string
  objective: any         // jsonb
  generated_by: string  // FK → users.id
  created_at: string     // timestamp ISO
}

////////////////////////////////////////////////////
// 16. schedule_details
export interface ScheduleDetail {
  id: number            // serial PK
  run_id: string        // FK → schedule_runs.id
  task_id: string       // FK → tasks.id
  start_ts: string      // timestamp ISO
  finish_ts: string     // timestamp ISO
  assigned_user: string // FK → users.id
}

////////////////////////////////////////////////////
// 17. task_history
export interface TaskHistory {
  id: number            // serial PK
  task_id: string       // FK → tasks.id
  user_id: string       // FK → users.id
  action: string
  from_val: string | null
  to_val: string | null
  at: string            // timestamp ISO
}

////////////////////////////////////////////////////
// 18. project_status (VIEW)
export interface ProjectStatus {
  id: string            // projects.id
  name: string
  current_status: "late" | "ahead" | "on_time"
}
