import { ExperienceMatrix, getExperienceScore } from './experience-matrix'

export interface Task {
  id: string
  name: string
  required_skills: number[]
  priority: number
  estimated_hours: number
}

export interface User {
  id: string
  name: string
  current_workload: number
  max_concurrent_tasks: number
}

export interface Assignment {
  task_id: string
  user_id: string
  confidence_score: number
  experience_score: number
}

/**
 * Thuật toán Hungarian Assignment với ràng buộc
 * 
 * Input: Tasks cần phân công, available users, ma trận kinh nghiệm
 * Output: Phân công tối ưu task -> user
 * Ràng buộc: Mỗi người tối đa 2 công việc đồng thời
 */
export function constrainedHungarianAssignment(
  tasks: Task[],
  users: User[],
  experienceMatrix: ExperienceMatrix,
  maxConcurrentTasks: number = 2
): Assignment[] {
  const assignments: Assignment[] = []
  
  // Lọc users có thể nhận thêm task
  const availableUsers = users.filter(user => 
    user.current_workload < Math.min(maxConcurrentTasks, user.max_concurrent_tasks)
  )

  if (availableUsers.length === 0) {
    return assignments
  }

  // Sắp xếp tasks theo priority (cao -> thấp)
  const sortedTasks = [...tasks].sort((a, b) => b.priority - a.priority)

  // Phân công từng task
  for (const task of sortedTasks) {
    const bestAssignment = findBestUserForTask(task, availableUsers, experienceMatrix)
    
    if (bestAssignment) {
      assignments.push(bestAssignment)
      
      // Cập nhật workload của user được chọn
      const assignedUser = availableUsers.find(u => u.id === bestAssignment.user_id)
      if (assignedUser) {
        assignedUser.current_workload += 1
        
        // Loại bỏ user nếu đã đạt max workload
        if (assignedUser.current_workload >= Math.min(maxConcurrentTasks, assignedUser.max_concurrent_tasks)) {
          const userIndex = availableUsers.indexOf(assignedUser)
          if (userIndex > -1) {
            availableUsers.splice(userIndex, 1)
          }
        }
      }
    }
  }

  return assignments
}

/**
 * Tìm user tốt nhất cho một task cụ thể
 */
function findBestUserForTask(
  task: Task,
  availableUsers: User[],
  experienceMatrix: ExperienceMatrix
): Assignment | null {
  if (availableUsers.length === 0) return null

  let bestUser: User | null = null
  let bestScore = -1
  let bestExperienceScore = 0

  for (const user of availableUsers) {
    const score = calculateUserTaskScore(user, task, experienceMatrix)
    
    if (score > bestScore) {
      bestScore = score
      bestUser = user
      
      // Tính experience score trung bình cho các skills yêu cầu
      const experienceScores = task.required_skills.map(skillId => 
        getExperienceScore(experienceMatrix, user.id, skillId)
      )
      bestExperienceScore = experienceScores.length > 0 
        ? experienceScores.reduce((sum, score) => sum + score, 0) / experienceScores.length
        : 0
    }
  }

  if (!bestUser) return null

  return {
    task_id: task.id,
    user_id: bestUser.id,
    confidence_score: bestScore,
    experience_score: bestExperienceScore
  }
}

/**
 * Tính điểm phù hợp giữa user và task
 */
function calculateUserTaskScore(
  user: User,
  task: Task,
  experienceMatrix: ExperienceMatrix
): number {
  // 1. Experience Score (40% trọng số)
  const experienceScores = task.required_skills.map(skillId => 
    getExperienceScore(experienceMatrix, user.id, skillId)
  )
  const avgExperience = experienceScores.length > 0 
    ? experienceScores.reduce((sum, score) => sum + score, 0) / experienceScores.length
    : 0

  // 2. Workload Score (30% trọng số) - ưu tiên người ít việc hơn
  const maxWorkload = Math.min(2, user.max_concurrent_tasks)
  const workloadScore = maxWorkload > 0 
    ? (maxWorkload - user.current_workload) / maxWorkload
    : 0

  // 3. Skill Coverage Score (20% trọng số) - có bao nhiêu skills yêu cầu
  const skillCoverage = task.required_skills.filter(skillId => 
    getExperienceScore(experienceMatrix, user.id, skillId) > 0
  ).length
  const skillCoverageScore = task.required_skills.length > 0 
    ? skillCoverage / task.required_skills.length
    : 1

  // 4. Availability Score (10% trọng số)
  const availabilityScore = user.current_workload === 0 ? 1 : 0.7

  // Tính tổng điểm có trọng số
  const totalScore = (
    avgExperience * 0.4 +
    workloadScore * 0.3 +
    skillCoverageScore * 0.2 +
    availabilityScore * 0.1
  )

  return totalScore
}

/**
 * Phân công tối ưu cho một task đơn lẻ
 */
export async function assignSingleTask(
  taskId: string,
  requiredSkills: number[],
  availableUsers: User[],
  experienceMatrix: ExperienceMatrix,
  maxConcurrentTasks: number = 2
): Promise<Assignment | null> {
  const task: Task = {
    id: taskId,
    name: `Task ${taskId}`,
    required_skills: requiredSkills,
    priority: 1,
    estimated_hours: 8
  }

  const assignments = constrainedHungarianAssignment(
    [task],
    availableUsers,
    experienceMatrix,
    maxConcurrentTasks
  )

  return assignments.length > 0 ? assignments[0] : null
}

/**
 * Validate assignment constraints
 */
export function validateAssignments(
  assignments: Assignment[],
  users: User[],
  maxConcurrentTasks: number = 2
): { isValid: boolean; violations: string[] } {
  const violations: string[] = []
  const userTaskCounts = new Map<string, number>()

  // Đếm số task được assign cho mỗi user
  assignments.forEach(assignment => {
    const currentCount = userTaskCounts.get(assignment.user_id) || 0
    userTaskCounts.set(assignment.user_id, currentCount + 1)
  })

  // Kiểm tra vi phạm
  userTaskCounts.forEach((taskCount, userId) => {
    const user = users.find(u => u.id === userId)
    const maxTasks = user ? Math.min(maxConcurrentTasks, user.max_concurrent_tasks) : maxConcurrentTasks
    
    if (taskCount > maxTasks) {
      violations.push(`User ${userId} được assign ${taskCount} tasks, vượt quá giới hạn ${maxTasks}`)
    }
  })

  return {
    isValid: violations.length === 0,
    violations
  }
}
