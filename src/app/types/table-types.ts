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

export type ProjectPhaseStandard = "Chuẩn bị" | "Thực hiện" | "Kết thúc"

// ==========================================================
// BẢNG VÀ VIEW CỐT LÕI
// ==========================================================

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

// 2. external_orgs
export interface ExternalOrg {
  id: string            // PK
  name: string
  contact_info: string | null
}

// 3. projects (SỬA LỖI: Đã thêm project_field)
export interface Project {
  id: string
  name: string
  description: string
  status: string
  start_date: string
  end_date: string
  // ---- CỘT MỚI ----
  classification: ProjectClassification | null
  project_field: string | null // Lĩnh vực dự án, ví dụ: 'Xây dựng', 'CNTT'
  // Thông tin user join vào
  users?: {
    full_name: string
    position: string
    org_unit: string
  }
}

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
  // ---- CỘT MỚI ----
  template_id?: number | null; // Liên kết với công việc mẫu
}

// 5. task_dependencies
export interface TaskDependency {
  id: number            // serial PK (auto)
  task_id: string       // FK → tasks.id
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

// 7. project_phases
export interface ProjectPhase {
  id: string
  project_id: string
  name: string
  description: string
  order_no: number
  created_at: string
  updated_at: string
}

// ==========================================================
// CÁC BẢNG & VIEW MỚI
// ==========================================================

// 8. skills (Bảng mới)
export interface Skill {
  id: number;
  name: string;
  field: string | null; // Lĩnh vực: 'Xây dựng', 'CNTT', 'Pháp lý'
  created_at: string;
}

// 9. task_templates (Bảng mới)
export interface TaskTemplate {
  id: number;
  name: string;
  description: string | null;
  project_field: string; // 'Xây dựng', 'CNTT', 'Cải cách TTHC'
  applicable_classification: string[]; // {"A", "B"} hoặc {"ALL"}
  phase: ProjectPhaseStandard;
  sequence_order: number;
  default_duration_days: number | null;
  required_skill_id: number | null;
  created_at: string;
}

// 10. user_skill_matrix (VIEW mới)
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
// CÁC BẢNG PHỤ (VẪN CÓ THỂ CẦN THIẾT)
// ==========================================================

// 11. worklogs
export interface Worklog {
  id: number
  task_id: string
  user_id: string
  spent_hours: number
  log_date: Date
  note: string | null
}

// 12. comments
export interface Comment {
  id: number
  task_id: string
  user_id: string
  body: string
}

// 13. attachments
export interface Attachment {
  id: string
  task_id: string
  file_url: string
  file_name: string
  uploaded_by: string
}

// 14. task_progress
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

// 15. task_history
export interface TaskHistory {
  id: number
  task_id: string
  user_id: string
  action: string
  from_val: string | null
  to_val: string | null
  created_at: string
}
