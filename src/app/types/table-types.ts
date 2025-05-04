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
  description: string
  status: string
  start_date: string
  end_date: string
  users?: {
    full_name: string
    position: string
    org_unit: string
  }
}

////////////////////////////////////////////////////
// 4. tasks
export interface Task {
  id: number
  project_id: string
  name: string
  status: TaskStatus
  start_date: string
  end_date: string
  phase_id: string
  assigned_to?: string | null
  note?: string
  unit_in_charge?: string
  legal_basis?: string
  max_retries?: number
}

////////////////////////////////////////////////////

////////////////////////////////////////////////////
// 6. task_raci
export interface TaskRaci {
  id: number              // serial PK
  task_id: string         // FK → tasks.id
  user_id: string   // FK → users.id
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

////////////////////////////////////////////////////
// 7. worklogs
export interface Worklog {
  id: number            // serial PK
  task_id: string       // FK → tasks.id
  user_id: string       // FK → users.id
  spent_hours: number
  log_date: Date      // "YYYY-MM-DD"
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
  created_at: string            // timestamp ISO
}

////////////////////////////////////////////////////
// 18. project_status (VIEW)
export interface ProjectStatus {
  id: string            // projects.id
  name: string
  current_status: "late" | "ahead" | "on_time"

}

export interface TaskSkill {
  task_id: string;    // FK → tasks.id
  skill_id: number;   // FK → skills.id
}

export interface ProjectPhase {
  id: string
  project_id: string
  name: string
  description: string
  order_no: number
  created_at: string
  updated_at: string
}
