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

    // Lấy dữ liệu từ user_skill_matrix (kinh nghiệm cơ bản)
    const { data: skillMatrix } = await supabase
      .from('user_skill_matrix')
      .select('user_id, skill_id, completed_tasks_count, avg_quality_score')
      .in('user_id', users)
      .in('skill_id', skills)

    // Lấy dữ liệu từ task_progress và worklogs để tính toán chi tiết hơn
    const { data: taskHistory } = await supabase
      .from('task_raci')
      .select(`
        user_id,
        tasks!inner(
          id,
          name,
          status,
          created_at,
          updated_at,
          task_skills!inner(
            skill_id
          ),
          task_progress(
            quality_score,
            time_spent_hours
          )
        )
      `)
      .eq('role', 'R')
      .eq('tasks.status', 'done')
      .in('user_id', users)

    // Tính toán Experience Matrix
    skillMatrix?.forEach(item => {
      if (item.user_id && item.skill_id !== null) {
        const userId = item.user_id
        const skillId = item.skill_id
        
        // Base experience từ user_skill_matrix
        const baseExperience = (item.completed_tasks_count || 0) * (item.avg_quality_score || 0.5)
        
        // Tìm các task history liên quan
        const userTasks = taskHistory?.filter(th => {
          if (th.user_id !== userId || !th.tasks) return false
          const task = th.tasks as any
          return task.task_skills?.some((ts: any) => ts.skill_id === skillId)
        }) || []

        let totalWeightedScore = baseExperience
        let totalTime = 1 // Tránh chia cho 0

        userTasks.forEach(taskRecord => {
          const task = taskRecord.tasks as any
          if (!task) return

          const progressArray = task.task_progress as any[]
          const progress = progressArray?.[0]
          if (!progress) return

          const qualityScore = progress.quality_score || 0.5
          const timeSpent = progress.time_spent_hours || 1
          const difficultyLevel = 1.0 // Có thể tính từ task complexity
          
          // Tính recency weight (task gần đây có trọng số cao hơn)
          const taskDate = new Date(task.updated_at || task.created_at)
          const daysSince = (Date.now() - taskDate.getTime()) / (1000 * 60 * 60 * 24)
          const recencyWeight = Math.exp(-daysSince / 365) // Decay theo năm

          // Áp dụng công thức: Q_i × T_i × D_i × W_recent
          const weightedScore = qualityScore * timeSpent * difficultyLevel * recencyWeight
          totalWeightedScore += weightedScore
          totalTime += timeSpent
        })

        // Tính experience cuối cùng: (Σ(Q_i × T_i × D_i × W_recent)) / (Σ T_i)
        matrix[userId][skillId] = totalWeightedScore / totalTime
      }
    })

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
