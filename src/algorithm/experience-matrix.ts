import { createClient } from '@/lib/supabase/server'

export interface ExperienceData {
  user_id: string
  skill_id: number
  quality_score: number
  time_spent: number
  difficulty_level: number
  recency_weight: number
}

export interface ExperienceMatrix {
  [user_id: string]: {
    [skill_id: number]: number
  }
}

/**
 * Thuật toán Experience Matrix - Tính toán kinh nghiệm từ dữ liệu lịch sử
 * 
 * Input: Dữ liệu từ bảng user_skill_matrix, worklogs, task_progress
 * Output: Ma trận kinh nghiệm E[user_id][skill_id]
 * Công thức: E(u,s) = (Σ(Q_i × T_i × D_i)) / (Σ T_i) × W_recent
 */
// Helper function to convert completed tasks count to experience score
function toScore(completed: number): number {
  if (completed >= 10) return 0.9
  if (completed >= 7) return 0.8
  if (completed >= 5) return 0.7
  if (completed >= 3) return 0.5
  if (completed >= 1) return 0.3
  return 0
}

export async function buildExperienceMatrix(
  users: string[],
  skills: number[],
  taskId?: string
): Promise<ExperienceMatrix> {
  const supabase = await createClient()
  const matrix: ExperienceMatrix = {}

  try {
    // Khởi tạo ma trận
    users.forEach(userId => {
      matrix[userId] = {}
      skills.forEach(skillId => {
        matrix[userId][skillId] = 0
      })
    })

    // 1) Ưu tiên user_skill_matrix (skill_id, completed_tasks_count)
    const { data: skillMatrix } = await supabase
      .from('user_skill_matrix')
      .select('user_id, skill_id, completed_tasks_count')
      .in('user_id', users)
      .in('skill_id', skills)

    // Áp dụng thang điểm chuẩn từ completed_tasks_count
    skillMatrix?.forEach(item => {
      if (item.user_id && item.skill_id !== null) {
        const userId = item.user_id
        const skillId = item.skill_id
        const completedTasks = item.completed_tasks_count || 0
        const score = toScore(completedTasks)
        matrix[userId][skillId] = score
        
        // Debug log để kiểm tra
        if (completedTasks > 0) {
          console.log(`User ${userId} skill ${skillId}: ${completedTasks} tasks -> score ${score}`)
        }
      }
    })

    // 2) Fallback từ task_raci các task đã hoàn thành để đếm số lần làm theo skill
    const missingUsers = users.filter(u => 
      !matrix[u] || Object.values(matrix[u]).every(score => score === 0)
    )

    if (missingUsers.length > 0) {
      const { data: taskHistory } = await supabase
        .from('task_raci')
        .select(`
          user_id,
          tasks!inner(
            id,
            status,
            task_skills!inner(
              skill_id,
              skills!inner(name)
            )
          )
        `)
        .in('user_id', missingUsers)
        .eq('role', 'R')

      // Count completed tasks per user per skill
      const counts: Record<string, Record<number, number>> = {}
      
      taskHistory?.forEach((r: any) => {
        const task = r.tasks
        if (!task) return
        
        const status = String(task.status || '').toLowerCase()
        const isCompleted = status === 'done' || status === 'completed' || status === 'hoan_thanh'
        if (!isCompleted) return
        
        const userId = r.user_id
        const taskSkills = task.task_skills || []
        
        taskSkills.forEach((ts: any) => {
          const skillId = ts.skill_id
          if (!skills.includes(skillId)) return
          
          counts[userId] ??= {}
          counts[userId][skillId] = (counts[userId][skillId] || 0) + 1
        })
      })

      // Convert counts to scores using same logic
      for (const [userId, bySkill] of Object.entries(counts)) {
        matrix[userId] ??= {}
        for (const [skillIdStr, count] of Object.entries(bySkill)) {
          const skillId = Number(skillIdStr)
          matrix[userId][skillId] = Math.max(matrix[userId][skillId] || 0, toScore(count))
        }
      }
    }

    console.log('Experience Matrix built with scores:', Object.keys(matrix).length, 'users')
    return matrix

  } catch (error) {
    console.error('Error building experience matrix:', error)
    return matrix
  }
}

/**
 * Lấy experience score cho một user và skill cụ thể
 */
export function getExperienceScore(
  matrix: ExperienceMatrix,
  userId: string,
  skillId: number
): number {
  return matrix[userId]?.[skillId] || 0
}

/**
 * Tìm top users có kinh nghiệm cao nhất cho một skill
 */
export function getTopExperiencedUsers(
  matrix: ExperienceMatrix,
  skillId: number,
  limit: number = 5
): Array<{ user_id: string; experience_score: number }> {
  const users = Object.keys(matrix)
  
  return users
    .map(userId => ({
      user_id: userId,
      experience_score: getExperienceScore(matrix, userId, skillId)
    }))
    .filter(item => item.experience_score > 0)
    .sort((a, b) => b.experience_score - a.experience_score)
    .slice(0, limit)
}
