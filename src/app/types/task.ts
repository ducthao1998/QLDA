export interface Task {
  id: string
  project_id: string
  name: string
  description: string | null
  status: string
  estimate_low: number
  estimate_high: number
  weight: number
  due_date: string
  risk_level: number
  complexity: number
  max_rejections: number
  assigned_to: string | null
  users?: {
    full_name: string
    position: string
    org_unit: string
  }
  projects?: {
    name: string
  }
} 