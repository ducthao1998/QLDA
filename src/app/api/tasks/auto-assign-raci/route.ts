import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { buildExperienceMatrix } from '@/algorithm/experience-matrix'
import {
  constrainedHungarianAssignment,
  calculateUserTaskScore,
  pickAccountableForTask,
  pickConsultedInformedRandom,
  type AlgoTask,
  type AlgoUser
} from '@/algorithm/hungarian-assignment'

// Helper function to check if user can take more tasks
const canTakeMore = (u: any, capParam: number) => {
  const cap = Math.min(capParam, Number.isFinite(u.max_concurrent_tasks) ? u.max_concurrent_tasks : capParam)
  const cur = u.current_workload ?? 0
  return cur < cap
}

async function getUnavailableUsersInfo(
  supabase: any,
  unavailableUsersList: any[],
  maxConcurrentTasks: number,
  requiredSkills: number[],
  experienceMatrix: any,
  optimalAssignments: any[] = []
) {
  const unavailableUsers = []

  console.log('Processing unavailable users:', unavailableUsersList.length)
  console.log('Required skills for unavailable users:', requiredSkills)
  
  // Optimize: Batch queries instead of N+1
  const userIds = unavailableUsersList.map(u => u.id)
  
  // 1) Current tasks for all users
  const { data: currentTasksAll } = await supabase
    .from('task_raci')
    .select(`
      user_id,
      tasks!inner(
        id,
        name,
        status,
        duration_days,
        projects!inner(name)
      )
    `)
    .eq('role', 'R')
    .in('user_id', userIds)
    .in('tasks.status', ['todo', 'in_progress', 'review', 'blocked'])

  // Group current tasks by user
  const curTasksByUser = new Map<string, any[]>()
  currentTasksAll?.forEach((r: any) => {
    const arr = curTasksByUser.get(r.user_id) ?? []
    arr.push(r)
    curTasksByUser.set(r.user_id, arr)
  })

  // 2) Skill matrix for all users
  const { data: matrixAll } = await supabase
    .from('user_skill_matrix')
    .select(`
      user_id,
      skill_id,
      skill_name,
      completed_tasks_count,
      last_activity_date
    `)
    .in('user_id', userIds)
    .in('skill_id', requiredSkills)

  const skillsByUser = new Map<string, any[]>()
  matrixAll?.forEach((r: any) => {
    const arr = skillsByUser.get(r.user_id) ?? []
    arr.push(r)
    skillsByUser.set(r.user_id, arr)
  })

  // 3) User skills for all users
  const { data: userSkillsAll } = await supabase
    .from('user_skill_matrix')
    .select('user_id, skill_id')
    .in('user_id', userIds)
    .in('skill_id', requiredSkills)

  const userSkillsByUser = new Map<string, any[]>()
  userSkillsAll?.forEach((r: any) => {
    const arr = userSkillsByUser.get(r.user_id) ?? []
    arr.push(r)
    userSkillsByUser.set(r.user_id, arr)
  })
  
  // 4) Hoisted fallback aggregation for completed tasks per skill (all users)
  const fallbackCountsByUser = new Map<string, Record<number, { name: string; count: number }>>()
  const { data: raciAggAll } = await supabase
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
    .in('user_id', userIds)
    .eq('role', 'R')

  if (raciAggAll) {
    (raciAggAll as any[]).forEach((row: any) => {
      const task = row.tasks
      if (!task) return
      const status = String(task.status || '').toLowerCase()
      const isCompleted = status === 'done' || status === 'completed' || status === 'hoan_thanh'
      if (!isCompleted) return
      const tskills = task.task_skills || []
      tskills.forEach((ts: any) => {
        const skillId = ts.skill_id
        const skillName = ts.skills?.name
        if (requiredSkills.includes(skillId)) {
          if (!fallbackCountsByUser.has(row.user_id)) fallbackCountsByUser.set(row.user_id, {})
          const userCounts = fallbackCountsByUser.get(row.user_id)!
          if (!userCounts[skillId]) userCounts[skillId] = { name: skillName, count: 0 }
          userCounts[skillId].count += 1
        }
      })
    })
  }
  
  for (const user of unavailableUsersList) {
    console.log('Processing user:', user.id, user.name || user.full_name)
    
    // Get user's current tasks from batch result
    const currentTasks = curTasksByUser.get(user.id) || []
    const userSkills = userSkillsByUser.get(user.id) || []
    const matrixData = skillsByUser.get(user.id) || []

    // Calculate actual current workload from tasks
    const actualWorkload = currentTasks.length

    console.log(`User ${user.id} matrix data:`, matrixData)

    // If no data from view, fallback to task_raci aggregation
    let userSkillData = { skills: matrixData || [] }
    
    if (!matrixData || matrixData.length === 0) {
      const userFallbackCounts = fallbackCountsByUser.get(user.id) || {}
      userSkillData.skills = Object.entries(userFallbackCounts).map(([skillId, info]) => ({
        skill_id: Number(skillId),
        skill_name: (info as any).name,
        completed_tasks_count: (info as any).count,
        last_activity_date: null
      }))
    }

    console.log(`User ${user.id} final skill data:`, userSkillData)

    const userExperience = requiredSkills.map(skillId => {
      const skillData = userSkillData?.skills?.find((s: any) => s.skill_id === skillId)
      console.log(`Skill ${skillId} for user ${user.id}:`, skillData)
      
      const completedTasks = skillData?.completed_tasks_count || 0
      
      return { 
        skill_id: skillId, 
        skill_name: skillData?.skill_name || `Kỹ năng ${skillId}`,
        completed_tasks: completedTasks
      }
    })

    // ĐÁNH GIÁ KỸ NĂNG: dùng tập hợp cuối cùng (bao gồm fallback) thay vì chỉ view
    const hasRequiredSkills = (userSkillData?.skills?.length ?? 0) > 0
    const userMaxConcurrent = Number.isFinite(user.max_concurrent_tasks) 
      ? user.max_concurrent_tasks 
      : maxConcurrentTasks
    const isOverloaded = actualWorkload >= userMaxConcurrent

    // Calculate total completed tasks with required skills
    const totalCompletedTasks = userExperience.reduce((sum, exp) => sum + exp.completed_tasks, 0)

    // Determine reason based on algorithm analysis
    let reason: 'overloaded' | 'no_skills' | 'unavailable' = 'unavailable'
    let reasonText = 'Không khả dụng'
    
    // Check if user was considered but not chosen due to workload
    if (isOverloaded) {
      reason = 'overloaded'
      if (totalCompletedTasks >= 5) {
        reasonText = `Đáng ra được chọn (đã hoàn thành ${totalCompletedTasks} công việc liên quan) nhưng đang bận ${actualWorkload}/${userMaxConcurrent} công việc`
      } else if (totalCompletedTasks >= 1) {
        reasonText = `Có thể phù hợp (đã hoàn thành ${totalCompletedTasks} công việc liên quan) nhưng đang bận ${actualWorkload}/${userMaxConcurrent} công việc`
      } else {
        reasonText = `Đang bận ${actualWorkload}/${userMaxConcurrent} công việc`
      }
    } else if (!hasRequiredSkills) {
      reason = 'no_skills'
      reasonText = 'Không có kỹ năng phù hợp với yêu cầu công việc'
    } else {
      // User has skills and is not overloaded, but algorithm chose someone else
      // This means there are better candidates
      if (totalCompletedTasks >= 5) {
        reasonText = `Có kinh nghiệm (đã hoàn thành ${totalCompletedTasks} công việc liên quan) nhưng có người phù hợp hơn được chọn`
      } else if (totalCompletedTasks >= 1) {
        reasonText = `Có ít kinh nghiệm (đã hoàn thành ${totalCompletedTasks} công việc liên quan) nhưng có người phù hợp hơn được chọn`
      } else {
        reasonText = `Chưa có kinh nghiệm với kỹ năng này - có người phù hợp hơn được chọn`
      }
    }

    // Debug current tasks data
    console.log(`User ${user.id} current tasks:`, currentTasks?.length || 0, 'tasks')
    console.log('Current tasks data:', currentTasks)
    
    // Find best role recommendations based on completed tasks
    const roleRecommendations = {
      R: { completed_tasks: 0, reason: 'Chưa có kinh nghiệm với kỹ năng này' },
      A: { completed_tasks: 0, reason: 'Cần kinh nghiệm nhiều hơn để đảm nhận vai trò chịu trách nhiệm' },
      C: { completed_tasks: 0, reason: 'Cần nhiều kinh nghiệm hơn để đưa ra lời khuyên đáng tin cậy' },
      I: { completed_tasks: 0, reason: 'Có đủ thời gian và khả năng để theo dõi và cập nhật tiến độ công việc' }
    }
    
    if (totalCompletedTasks >= 7) {
      roleRecommendations.R = { completed_tasks: totalCompletedTasks, reason: `Có kinh nghiệm cao (đã hoàn thành ${totalCompletedTasks} công việc liên quan)` }
      roleRecommendations.A = { completed_tasks: totalCompletedTasks, reason: `Có thể đảm nhận vai trò chịu trách nhiệm (đã hoàn thành ${totalCompletedTasks} công việc liên quan)` }
    } else if (totalCompletedTasks >= 3) {
      roleRecommendations.R = { completed_tasks: totalCompletedTasks, reason: `Có kinh nghiệm vừa phải (đã hoàn thành ${totalCompletedTasks} công việc liên quan)` }
      roleRecommendations.A = { completed_tasks: totalCompletedTasks, reason: `Cần hỗ trợ thêm để chịu trách nhiệm (đã hoàn thành ${totalCompletedTasks} công việc liên quan)` }
    } else if (totalCompletedTasks >= 1) {
      roleRecommendations.R = { completed_tasks: totalCompletedTasks, reason: `Có ít kinh nghiệm (đã hoàn thành ${totalCompletedTasks} công việc liên quan)` }
    }
    
    if (totalCompletedTasks >= 5) {
      roleRecommendations.C = { completed_tasks: totalCompletedTasks, reason: `Có chuyên môn để đưa ra lời khuyên (đã hoàn thành ${totalCompletedTasks} công việc liên quan)` }
    }
    
    if (actualWorkload < 2) {
      roleRecommendations.I = { completed_tasks: 0, reason: 'Có đủ thời gian để theo dõi tiến độ' }
    }

    unavailableUsers.push({
      user_id: user.id,
      full_name: user.name || user.full_name, // Support both field names
      position: user.position,
      org_unit: user.org_unit,
      current_workload: actualWorkload, // Use actual count from tasks
      max_concurrent_tasks: user.max_concurrent_tasks || maxConcurrentTasks, // Use user's actual max
      current_tasks: currentTasks.map((ct: any) => ({
        task_id: ct.tasks.id,
        task_name: ct.tasks.name,
        project_name: ct.tasks.projects.name,
        status: ct.tasks.status,
        duration_days: ct.tasks.duration_days
      })),
      workload_percentage: 0, // Remove percentage calculation
      reason,
      reason_text: reasonText,
      skill_experience: userExperience,
      role_recommendations: roleRecommendations
    })
  }

  return unavailableUsers
}

// Legacy helpers removed after two-phase R/A + deterministic C/I implementation

export async function POST(req: Request) {
  const supabase = await createClient()

  try {
    const body = await req.json()
    const {
      task_ids,
      project_id,
      max_concurrent_tasks = 2,
      allow_same_RA = false,
      minConfidenceR = 0.35,
      minAccountableScore = 0.5,
      minAccountableSkillFit = 0.3,
      planning = false,
      force_assignments
    } = body

    if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
      return NextResponse.json(
        { error: 'Cần cung cấp danh sách task_ids' },
        { status: 400 }
      )
    }

    if (!project_id) {
      return NextResponse.json(
        { error: 'Cần cung cấp project_id' },
        { status: 400 }
      )
    }

    console.log('=== AUTO ASSIGN RACI DEBUG ===')
    console.log('Task IDs:', task_ids)
    console.log('Project ID:', project_id)
    console.log('Max concurrent tasks:', max_concurrent_tasks)

    // === BƯỚC 1: LẤY THÔNG TIN CÁC TASKS CẦN PHÂN CÔNG ===
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        id,
        name,
        template_id,
        project_id,
        task_skills(skill_id)
      `)
      .in('id', task_ids)
      .eq('project_id', project_id)

    console.log('Tasks data:', tasksData)
    console.log('Tasks error:', tasksError)

    if (tasksError || !tasksData || tasksData.length === 0) {
      return NextResponse.json(
        { error: 'Không tìm thấy tasks trong dự án' },
        { status: 404 }
      )
    }

    // === BƯỚC 2: LẤY THÔNG TIN SKILLS YÊU CẦU CHO TỪNG TASK ===
    const allSkills = new Set<number>()
    const taskSkillsMap = new Map<string, number[]>()

    for (const task of tasksData) {
      let requiredSkills: number[] = []

      // Từ template nếu có
      if (task.template_id) {
        const { data: templateData } = await supabase
          .from('task_templates')
          .select('required_skill_id')
          .eq('id', task.template_id)
          .single()

        if (templateData?.required_skill_id) {
          requiredSkills.push(templateData.required_skill_id)
          allSkills.add(templateData.required_skill_id)
        }
      }

      // Từ task_skills
      if (task.task_skills && task.task_skills.length > 0) {
        const skillIds = task.task_skills
          .map((ts: any) => ts.skill_id)
          .filter((id: number) => id !== null)
        
        requiredSkills = [...new Set([...requiredSkills, ...skillIds])]
        skillIds.forEach(id => allSkills.add(id))
      }

      taskSkillsMap.set(task.id, requiredSkills)
    }

    console.log('Task skills map:', Object.fromEntries(taskSkillsMap))
    console.log('All skills:', Array.from(allSkills))

    // === BƯỚC 3: ĐỌC CẤU HÌNH ALGORITHM (assignment_prefs) ===
    const { data: sessionRes } = await supabase.auth.getSession()
    const session = sessionRes?.session
    let AP: any = {}
    if (session?.user?.id) {
      const { data: apRow } = await supabase
        .from('algorithm_settings')
        .select('assignment_prefs')
        .eq('user_id', session.user.id)
        .eq('project_id', project_id)
        .maybeSingle()
      const settings = (apRow as any)?.assignment_prefs || {}
      AP = {
        enabled: settings.enabled ?? true,
        priority_mode: settings.priority_mode ?? 'lexi',
        default_max_concurrent_tasks: settings.default_max_concurrent_tasks ?? max_concurrent_tasks,
        respect_user_caps: settings.respect_user_caps ?? true,
        min_confidence_R: settings.min_confidence_R ?? minConfidenceR,
        unassigned_cost: settings.unassigned_cost ?? 0.5,
        allow_same_RA: settings.allow_same_RA ?? allow_same_RA,
        min_accountable_score: settings.min_accountable_score ?? Math.max(0.6, minAccountableScore),
        min_accountable_skill_fit: settings.min_accountable_skill_fit ?? Math.max(0.3, minAccountableSkillFit),
      }
    } else {
      AP = {
        enabled: true,
        priority_mode: 'weighted',
        default_max_concurrent_tasks: max_concurrent_tasks,
        respect_user_caps: true,
        min_confidence_R: minConfidenceR,
        unassigned_cost: 0.5,
        allow_same_RA,
        min_accountable_score: Math.max(0.6, minAccountableScore),
        min_accountable_skill_fit: Math.max(0.3, minAccountableSkillFit),
      }
    }

    const effMaxConcurrent = Number(AP.default_max_concurrent_tasks) || max_concurrent_tasks

    // === BƯỚC 4: LẤY DANH SÁCH TẤT CẢ USERS TRONG HỆ THỐNG ===
    // Lấy tất cả users trong hệ thống (không giới hạn org_unit)
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        position,
        org_unit,
        max_concurrent_tasks
      `)
      .not('id', 'is', null)

    if (usersError) console.error('Users query error:', usersError)
    console.log('All users:', allUsers)

    if (!allUsers || allUsers.length === 0) {
      return NextResponse.json({
        error: 'Không có người dùng nào trong hệ thống',
        assignments: []
      })
    }

    const userIds = (allUsers as any[]).map((user: any) => user.id).filter(Boolean)

    // === BƯỚC 4: TÍNH WORKLOAD HIỆN TẠI CỦA TỪNG USER (TẤT CẢ DỰ ÁN) ===
    const { data: currentWorkloads } = await supabase
      .from('task_raci')
      .select(`
        user_id,
        tasks!inner(
          id,
          status,
          project_id,
          projects!inner(
            id,
            name,
            status
          )
        )
      `)
      .eq('role', 'R')
      .in('tasks.status', ['todo', 'in_progress', 'review', 'blocked'])
      .in('user_id', userIds)

    console.log('Current workloads (all projects):', currentWorkloads)

    // Đếm workload cho mỗi user từ tất cả dự án
    const userWorkloadMap = new Map<string, number>()
    const userProjectsMap = new Map<string, Set<string>>() // Track projects per user
    
    currentWorkloads?.forEach((item: any) => {
      const projectStatus = item?.tasks?.projects?.status
      if (item.user_id && (projectStatus === 'active' || projectStatus === 'planning')) {
        const currentCount = userWorkloadMap.get(item.user_id) || 0
        userWorkloadMap.set(item.user_id, currentCount + 1)
        if (!userProjectsMap.has(item.user_id)) userProjectsMap.set(item.user_id, new Set())
        userProjectsMap.get(item.user_id)?.add(item.tasks.project_id)
      }
    })

    console.log('User workload map (all projects):', Object.fromEntries(userWorkloadMap))
    console.log('User projects count:', Object.fromEntries(
      Array.from(userProjectsMap.entries()).map(([userId, projects]) => [userId, projects.size])
    ))

    // === BƯỚC 5: TẠO DANH SÁCH USERS CHO THUẬT TOÁN ===
    const availableUsers: AlgoUser[] = (allUsers as any[]).map((user: any) => {
      return {
        id: user.id,
        name: user.full_name,
        current_workload: userWorkloadMap.get(user.id) || 0,
        // Trần: nếu tôn trọng trần riêng thì dùng users.max_concurrent_tasks, ngược lại dùng default
        max_concurrent_tasks: AP.respect_user_caps && Number.isFinite(user.max_concurrent_tasks)
          ? user.max_concurrent_tasks
          : effMaxConcurrent
      }
    })

    console.log('Available users:', availableUsers)

    // === BƯỚC 6: XÂY DỰNG EXPERIENCE MATRIX ===
    const experienceMatrix = await buildExperienceMatrix(
      userIds,
      Array.from(allSkills),
    )

    const isProd = process.env.NODE_ENV === 'production'
    if (!isProd) console.log('Experience Matrix size:', Object.keys(experienceMatrix).length)

    // === BƯỚC 7: TẠO DANH SÁCH TASKS CHO THUẬT TOÁN ===
    const algorithmTasks: AlgoTask[] = tasksData.map(task => ({
      id: task.id,
      name: task.name,
      required_skills: taskSkillsMap.get(task.id) || [],
      priority: 1,
      estimated_hours: 8
    }))

    console.log('Algorithm Tasks:', algorithmTasks)

    // Debug: Log top candidates for each task
    if (!isProd) {
      algorithmTasks.forEach(task => {
        const candidates = availableUsers
          .map(user => {
            const skillExperience = task.required_skills.map(skillId => {
              // Lấy thông tin từ user_skill_matrix để hiển thị completed_tasks_count thực tế
              return {
                skill_id: skillId,
                completed_tasks: 'N/A' // Sẽ được cập nhật từ database
              }
            })
            
            return { 
              user_id: user.id, 
              name: user.name, 
              current_workload: user.current_workload,
              max_capacity: user.max_concurrent_tasks,
              skill_experience: skillExperience
            }
          })
          .slice(0, 3)
        
        console.log(`Task ${task.name} - Required skills: ${task.required_skills.join(', ')}`)
        console.log(`Top 3 candidates:`, candidates)
      })
    }

    // === BƯỚC 8: TẠO PHÂN CÔNG R (chế độ lập kế hoạch bỏ qua capacity)
    const filteredUsers = availableUsers.filter(u => u.current_workload < max_concurrent_tasks)
    if (!isProd) console.log('Filtered users (by workload):', filteredUsers.length)
    
    const envMinR = parseFloat(String(process.env.MIN_CONFIDENCE_R || ''))
    const envMinA = parseFloat(String(process.env.MIN_ACCOUNTABLE_SCORE || ''))
    const envMinASkill = parseFloat(String(process.env.MIN_ACCOUNTABLE_SKILL_FIT || ''))
    const effectiveMinR = Number.isFinite(envMinR) ? envMinR : minConfidenceR
    const effectiveMinA = Number.isFinite(envMinA) ? envMinA : Math.max(0.6, minAccountableScore)
    const effectiveMinASkill = Number.isFinite(envMinASkill) ? envMinASkill : minAccountableSkillFit

    let assignments: { task_id: string; user_id: string; confidence_score: number; experience_score: number }[] = []
    if (Array.isArray(force_assignments) && force_assignments.length > 0) {
      // Force use preview assignments exactly
      const allowedTaskIds = new Set(tasksData.map(t => t.id))
      const allowedUserIds = new Set((allUsers as any[]).map(u => u.id))
      assignments = force_assignments
        .filter((fa: any) => allowedTaskIds.has(fa.task_id) && allowedUserIds.has(fa.user_id))
        .map((fa: any) => {
          const reqSkills = taskSkillsMap.get(fa.task_id) || []
          const exps = reqSkills.map(sid => (experienceMatrix?.[fa.user_id]?.[sid] ?? 0))
          const expAvg = exps.length ? exps.reduce((a: number, b: number) => a + b, 0) / exps.length : 0
          return { task_id: fa.task_id, user_id: fa.user_id, confidence_score: expAvg, experience_score: expAvg }
        })
    } else if (planning) {
      // Greedy: chọn user có kinh nghiệm trung bình cao nhất cho từng task, bỏ qua capacity
      assignments = algorithmTasks.map(t => {
        let bestUser: any = null
        let bestScore = -1
        let expAvg = 0
        for (const u of availableUsers) {
          const exps = t.required_skills.map(sid => experienceMatrix?.[u.id]?.[sid] ?? 0)
          const avg = exps.length ? exps.reduce((a: number, b: number) => a + b, 0) / exps.length : 0
          if (avg > bestScore) { bestScore = avg; bestUser = u; expAvg = avg }
          else if (avg === bestScore && bestUser) {
            // Tie-break: workload asc, then user id asc
            const uW = userWorkloadMap.get(u.id) || 0
            const bW = userWorkloadMap.get(bestUser.id) || 0
            if (uW < bW || (uW === bW && String(u.id).localeCompare(String(bestUser.id)) < 0)) {
              bestUser = u; expAvg = avg
            }
          }
        }
        return { task_id: t.id, user_id: bestUser?.id, confidence_score: bestScore < 0 ? 0 : bestScore, experience_score: expAvg }
      })
    } else {
      assignments = constrainedHungarianAssignment(
        algorithmTasks,
        availableUsers,
        experienceMatrix,
        effMaxConcurrent,
        {
          minConfidence: AP.min_confidence_R ?? effectiveMinR,
          unassignedCost: AP.unassigned_cost ?? 0.5,
          bigPenalty: 1e6,
          priorityMode: AP.priority_mode
        }
      )
      // Second-pass fallback nếu còn trống
      if (assignments.length < algorithmTasks.length) {
        const assignedTaskIds = new Set(assignments.map(a => a.task_id))
        const unassignedCount = algorithmTasks.filter(t => !assignedTaskIds.has(t.id)).length
        const freeUsers = availableUsers.filter(u => (u.current_workload < Math.min(effMaxConcurrent, u.max_concurrent_tasks)))
        if (unassignedCount > 0 && freeUsers.length > 0) {
          const relaxed = constrainedHungarianAssignment(
            algorithmTasks,
            availableUsers,
            experienceMatrix,
            effMaxConcurrent,
            {
              minConfidence: Math.min(0.2, AP.min_confidence_R ?? effectiveMinR),
              unassignedCost: Math.max(0.7, AP.unassigned_cost ?? 0.5),
              bigPenalty: 1e6,
              priorityMode: AP.priority_mode
            }
          )
          const relaxedMap = new Map(relaxed.map(r => [r.task_id, r]))
          const merged: typeof assignments = []
          for (const t of algorithmTasks) {
            const strict = assignments.find(a => a.task_id === t.id)
            if (strict) { merged.push(strict); continue }
            const alt = relaxedMap.get(t.id)
            if (alt) merged.push(alt)
          }
          assignments = merged
        }
      }
      // Single-task hard fallback: nếu vẫn chưa có ai, chọn người rảnh nhất có kinh nghiệm cao nhất (tôn trọng capacity)
      if (algorithmTasks.length === 1 && assignments.length === 0) {
        const t = algorithmTasks[0]
        const pool = availableUsers.filter(u => (u.current_workload < Math.min(effMaxConcurrent, u.max_concurrent_tasks)))
        if (pool.length > 0) {
          let best: any = null
          let bestAvg = -1
          for (const u of pool) {
            const exps = t.required_skills.map(sid => experienceMatrix?.[u.id]?.[sid] ?? 0)
            const avg = exps.length ? exps.reduce((a: number, b: number) => a + b, 0) / exps.length : 0
            if (avg > bestAvg) { bestAvg = avg; best = u }
            else if (avg === bestAvg && best) {
              const uW = u.current_workload || 0
              const bW = best.current_workload || 0
              if (uW < bW || (uW === bW && String(u.id).localeCompare(String(best.id)) < 0)) best = u
            }
          }
          if (best) {
            assignments = [{ task_id: t.id, user_id: best.id, confidence_score: Math.max(0, bestAvg), experience_score: Math.max(0, bestAvg) }]
          }
        }
      }
    }
    
    console.log('Assignments result:', assignments)

    // Second-pass fallback: if many tasks unassigned but users are free, relax thresholds
    if (assignments.length < algorithmTasks.length) {
      const assignedTaskIds = new Set(assignments.map(a => a.task_id))
      const unassignedCount = algorithmTasks.filter(t => !assignedTaskIds.has(t.id)).length
      const freeUsers = availableUsers.filter(u => (u.current_workload < Math.min(effMaxConcurrent, u.max_concurrent_tasks)))
      if (unassignedCount > 0 && freeUsers.length > 0) {
        const relaxed = constrainedHungarianAssignment(
          algorithmTasks,
          availableUsers,
          experienceMatrix,
          effMaxConcurrent,
          {
            minConfidence: Math.min(0.2, AP.min_confidence_R ?? effectiveMinR),
            unassignedCost: Math.max(0.7, AP.unassigned_cost ?? 0.5),
            bigPenalty: 1e6,
            priorityMode: AP.priority_mode
          }
        )
        // Prefer relaxed results where previously unassigned
        const relaxedMap = new Map(relaxed.map(r => [r.task_id, r]))
        const merged: typeof assignments = []
        for (const t of algorithmTasks) {
          const strict = assignments.find(a => a.task_id === t.id)
          if (strict) { merged.push(strict); continue }
          const alt = relaxedMap.get(t.id)
          if (alt) merged.push(alt)
        }
        assignments = merged
        console.log('Assignments after fallback:', assignments)
      }
    }

    // === BƯỚC 9: PHA 2 - CHỌN A, C, I THEO YÊU CẦU ===
    const orgMap = new Map<string, string>()
    const managerMap = new Map<string, string | null>()
    const posLevelMap = new Map<string, number>()
    const capacityMap = new Map<string, { current: number; max: number }>()
    for (const u of (allUsers as any[])) {
      orgMap.set(u.id, u.org_unit)
      // Không có manager_id/position_level trong hệ thống hiện tại
      managerMap.set(u.id, null)
      posLevelMap.set(u.id, 0)
      capacityMap.set(u.id, {
        current: userWorkloadMap.get(u.id) || 0,
        max: (AP.respect_user_caps && Number.isFinite(u.max_concurrent_tasks)) ? u.max_concurrent_tasks : effMaxConcurrent
      })
    }

    // Placeholder for user A performance metrics; can be replaced by a view later
    const userMetrics = new Map<string, { a_count?: number; a_on_time_rate?: number; a_overdue_count?: number; a_avg_delay?: number }>()

    const results: any[] = []
    const errors: any[] = []

    for (const assignment of assignments) {
      try {
        const taskId = assignment.task_id
        const rUserId = assignment.user_id
        const task = tasksData.find(t => t.id === taskId)
        const rUser = (allUsers as any[]).find(u => u.id === rUserId)

        // Pick A
        const context = {
          userOrgUnit: orgMap,
          userManagerId: managerMap,
          userPositionLevel: posLevelMap,
          userMetrics,
          userWorkload: capacityMap,
          allowSameRA: !!AP.allow_same_RA,
          minAccountableScore: Number(AP.min_accountable_score ?? effectiveMinA),
          minAccountableSkillFit: Number(AP.min_accountable_skill_fit ?? effectiveMinASkill)
        }

        const candidateIds = (allUsers as any[]).map(u => u.id)
        let aPick = pickAccountableForTask(
          {
            id: String(taskId),
            name: task?.name || String(taskId),
            required_skills: taskSkillsMap.get(taskId) || [],
            priority: 1,
            estimated_hours: 8
          },
          rUserId,
          candidateIds,
          experienceMatrix,
          context
        )
        // Fallbacks to enforce that every task has exactly one A
        let aUserId: string | null = aPick?.userId ?? null
        let aExplain = aPick?.explain
        let aScore = aPick?.score
        if (!aUserId) {
          // Try relaxed thresholds first (keep allowSameRA as is)
          const relaxed1 = pickAccountableForTask(
            {
              id: String(taskId),
              name: task?.name || String(taskId),
              required_skills: taskSkillsMap.get(taskId) || [],
              priority: 1,
              estimated_hours: 8
            },
            rUserId,
            candidateIds,
            experienceMatrix,
            { ...context, minAccountableScore: 0, minAccountableSkillFit: 0 }
          )
          if (relaxed1) {
            aUserId = relaxed1.userId
            aExplain = relaxed1.explain
            aScore = relaxed1.score
          }
        }
        if (!aUserId && !context.allowSameRA) {
          // Allow same R/A as last resort
          const relaxed2 = pickAccountableForTask(
            {
              id: String(taskId),
              name: task?.name || String(taskId),
              required_skills: taskSkillsMap.get(taskId) || [],
              priority: 1,
              estimated_hours: 8
            },
            rUserId,
            candidateIds,
            experienceMatrix,
            { ...context, allowSameRA: true, minAccountableScore: 0, minAccountableSkillFit: 0 }
          )
          if (relaxed2) {
            aUserId = relaxed2.userId
            aExplain = relaxed2.explain
            aScore = relaxed2.score
          }
        }
        if (!aUserId) {
          // Absolute fallback: set A = R (ensures exactly one A)
          aUserId = rUserId
        }

        // Deterministic C/I excluding R and A, respecting capacity
        const ci = pickConsultedInformedRandom(
          {
            id: String(taskId),
            name: task?.name || String(taskId),
            required_skills: taskSkillsMap.get(taskId) || [],
            priority: 1,
            estimated_hours: 8
          },
          (allUsers as any[]).map(u => ({ id: u.id })),
          rUserId,
          aUserId,
          capacityMap
        )

        // === LƯU VÀO DB: đảm bảo đúng 1 R và 1 A (simple retry) ===
        await supabase.from('task_raci').delete().eq('task_id', taskId)
        const rows: any[] = [{ task_id: taskId, user_id: rUserId, role: 'R' }]
        let aSaved = null as null | string
        if (aUserId) { rows.push({ task_id: taskId, user_id: aUserId, role: 'A' }); aSaved = aUserId }
        for (const uid of ci.C) rows.push({ task_id: taskId, user_id: uid, role: 'C' })
        for (const uid of ci.I) rows.push({ task_id: taskId, user_id: uid, role: 'I' })
        let insertErr: any = null
        let attempt = 0
        do {
          const { error } = await supabase.from('task_raci').insert(rows)
          insertErr = error
          attempt++
        } while (insertErr && attempt < 2)
        if (insertErr) throw insertErr

        results.push({
          task_id: taskId,
          task_name: task?.name,
          R: {
            user_id: rUserId,
            user_name: rUser?.full_name || rUser?.name,
            confidence_score: assignment.confidence_score,
            experience_score: assignment.experience_score,
            explain: {
              summary: '50% kinh nghiệm + 35% cân tải + 10% phủ kỹ năng + 5% chuyên sâu'
            }
          },
          A: {
            user_id: aSaved!,
            user_name: (allUsers as any[]).find(u => u.id === aSaved)?.full_name,
            accountable_score: aScore ?? 0,
            explain: aExplain
          },
          C: ci.C,
          I: ci.I
        })
      } catch (error: any) {
        console.error('Assignment error:', error)
        errors.push({ task_id: assignment.task_id, error: error.message })
      }
    }

    // === BƯỚC 10: TRẢ VỀ KẾT QUẢ ===
    const unassignedTasks = tasksData
      .filter(task => !assignments.some(a => a.task_id === task.id))
      .map(task => ({
        task_id: task.id,
        task_name: task.name,
        reason: 'Không đạt ngưỡng tin cậy hoặc không đủ năng lực/capacity'
      }))

    console.log('Final results:', results)
    console.log('Unassigned tasks:', unassignedTasks)
    console.log('Errors:', errors)

    // Get detailed info about unavailable users for explanation dialog
    // Run algorithm to find optimal assignments and compare with actual results
    const optimalAlgorithmTasks = tasksData.map(task => ({
      id: task.id,
      name: task.name,
      required_skills: taskSkillsMap.get(task.id) || [],
      priority: 1,
      estimated_hours: 8
    }))

    // Convert allUsers to User format for algorithm
    const algorithmUsers = (allUsers as any[]).map((user: any) => ({
      id: user.id,
      name: user.full_name || user.name,
      current_workload: userWorkloadMap.get(user.id) ?? 0, // <-- dùng map đã tính
      max_concurrent_tasks: Number.isFinite(user.max_concurrent_tasks)
        ? user.max_concurrent_tasks
        : max_concurrent_tasks
    }))

    // Run Hungarian algorithm to find optimal assignments
    const optimalAssignments = constrainedHungarianAssignment(
      optimalAlgorithmTasks,
      algorithmUsers,
      experienceMatrix,
      effMaxConcurrent,
      {
        minConfidence: AP.min_confidence_R ?? 0.35,
        unassignedCost: AP.unassigned_cost ?? 0.5,
        bigPenalty: 1e6,
        priorityMode: AP.priority_mode
      }
    )

    // Find users who were NOT assigned in optimal solution
    const assignedUserIds = new Set(optimalAssignments.map(a => a.user_id))
    const unavailableUsersList = (allUsers as any[]).filter((user: any) => 
      !assignedUserIds.has(user.id)
    )
    
    console.log('Optimal assignments:', optimalAssignments.length)
    console.log('Unavailable users list:', unavailableUsersList.length, 'users')
    console.log('Sample unavailable user:', unavailableUsersList[0])
    
    const unavailableUsers = await getUnavailableUsersInfo(
      supabase, 
      unavailableUsersList, 
      max_concurrent_tasks, 
      Array.from(allSkills),
      experienceMatrix,
      optimalAssignments
    )
    
    console.log('Processed unavailable users:', unavailableUsers.length, 'users')
    console.log('Sample processed user:', unavailableUsers[0])

    // Get skill names for display
    const { data: skillsData } = await supabase
      .from('skills')
      .select('id, name')
      .in('id', Array.from(allSkills))

    const skillNames = skillsData?.map(s => s.name) || []

    return NextResponse.json({
      success: true,
      message: `Đã phân công ${results.length}/${tasksData.length} công việc`,
      assignments: results,
      unassigned: unassignedTasks,
      errors: errors,
      unavailable_users: unavailableUsers,
      required_skills: skillNames,
      debug: {
        total_tasks: tasksData.length,
        total_users: availableUsers.length,
        available_users: filteredUsers.length,
        algorithm_used: planning ? 'planning_greedy (ignore capacity) + accountable_scoring + deterministic_CI' : 'experience_matrix + constrained_hungarian + accountable_scoring + deterministic_CI',
        experience_matrix_size: Object.keys(experienceMatrix).length,
        skills_count: allSkills.size,
        minConfidenceR: AP.min_confidence_R ?? minConfidenceR,
        minAccountableScore: AP.min_accountable_score ?? effectiveMinA,
        minAccountableSkillFit: AP.min_accountable_skill_fit ?? effectiveMinASkill,
        allow_same_RA: AP.allow_same_RA,
        priority_mode: AP.priority_mode,
        default_max_concurrent_tasks: effMaxConcurrent,
        respect_user_caps: AP.respect_user_caps
      }
    })

  } catch (error: any) {
    console.error('Lỗi khi tự động phân công RACI:', error)
    return NextResponse.json({
      error: error.message,
      assignments: []
    }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const supabase = await createClient()

  try {
    const { searchParams } = new URL(req.url)
    const taskIds = (searchParams.get('task_ids') || '').split(',').filter(Boolean)
    const projectId = searchParams.get('project_id') || ''
    const maxConcurrentParam = Number(searchParams.get('max_concurrent_tasks') || '0')
    const max_concurrent_tasks = Number.isFinite(maxConcurrentParam) && maxConcurrentParam > 0 ? maxConcurrentParam : 2
    const planning = (searchParams.get('planning') || '0') === '1'

    if (taskIds.length === 0) {
      return NextResponse.json({ error: 'Cần cung cấp task_ids' }, { status: 400 })
    }
    if (!projectId) {
      return NextResponse.json({ error: 'Cần cung cấp project_id' }, { status: 400 })
    }

    // 1) Load tasks
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select(`id, name, template_id, project_id, task_skills(skill_id)`)    
      .in('id', taskIds)
      .eq('project_id', projectId)

    if (tasksError || !tasksData || tasksData.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy tasks trong dự án' }, { status: 404 })
    }

    // 2) Build required skills per task
    const allSkills = new Set<number>()
    const taskSkillsMap = new Map<string, number[]>()
    for (const task of tasksData) {
      let requiredSkills: number[] = []
      if (task.template_id) {
        const { data: templateData } = await supabase
          .from('task_templates')
          .select('required_skill_id')
          .eq('id', task.template_id)
          .single()
        if (templateData?.required_skill_id) {
          requiredSkills.push(templateData.required_skill_id)
          allSkills.add(templateData.required_skill_id)
        }
      }
      if (task.task_skills && task.task_skills.length > 0) {
        const skillIds = task.task_skills.map((ts: any) => ts.skill_id).filter((id: number) => id !== null)
        requiredSkills = [...new Set([...requiredSkills, ...skillIds])]
        skillIds.forEach(id => allSkills.add(id))
      }
      taskSkillsMap.set(task.id, requiredSkills)
    }

    // 3) Read algorithm settings
    const { data: sessionRes } = await supabase.auth.getSession()
    const session = sessionRes?.session
    let AP: any = {}
    const minConfidenceR = 0.35
    if (session?.user?.id) {
      const { data: apRow } = await supabase
        .from('algorithm_settings')
        .select('assignment_prefs')
        .eq('user_id', session.user.id)
        .eq('project_id', projectId)
        .maybeSingle()
      const settings = (apRow as any)?.assignment_prefs || {}
      AP = {
        enabled: settings.enabled ?? true,
        priority_mode: settings.priority_mode ?? 'lexi',
        default_max_concurrent_tasks: settings.default_max_concurrent_tasks ?? max_concurrent_tasks,
        respect_user_caps: settings.respect_user_caps ?? true,
        min_confidence_R: settings.min_confidence_R ?? minConfidenceR,
        unassigned_cost: settings.unassigned_cost ?? 0.5,
      }
    } else {
      AP = {
        enabled: true,
        priority_mode: 'weighted',
        default_max_concurrent_tasks: max_concurrent_tasks,
        respect_user_caps: true,
        min_confidence_R: minConfidenceR,
        unassigned_cost: 0.5,
      }
    }

    const effMaxConcurrent = Number(AP.default_max_concurrent_tasks) || max_concurrent_tasks

    // 4) Load all users (global) and compute workloads
    const { data: allUsers } = await supabase
      .from('users')
      .select('id, full_name, position, org_unit, max_concurrent_tasks')
      .not('id', 'is', null)

    if (!allUsers || allUsers.length === 0) {
      return NextResponse.json({ preview: [], assignments: [], unassigned: [], debug: { total_tasks: tasksData.length, total_users: 0 } })
    }

    const userIds = (allUsers as any[]).map((u: any) => u.id).filter(Boolean)
    const { data: currentWorkloads } = await supabase
      .from('task_raci')
      .select(`user_id, tasks!inner(id, status, project_id, projects!inner(id,name,status))`)
      .eq('role', 'R')
      .in('tasks.status', ['todo', 'in_progress', 'review', 'blocked'])
      .in('user_id', userIds)

    const userWorkloadMap = new Map<string, number>()
    currentWorkloads?.forEach((item: any) => {
      const projectStatus = item?.tasks?.projects?.status
      if (item.user_id && (projectStatus === 'active' || projectStatus === 'planning')) {
        userWorkloadMap.set(item.user_id, (userWorkloadMap.get(item.user_id) || 0) + 1)
      }
    })

    const availableUsers: AlgoUser[] = (allUsers as any[]).map((user: any) => ({
      id: user.id,
      name: user.full_name,
      current_workload: userWorkloadMap.get(user.id) || 0,
      max_concurrent_tasks: AP.respect_user_caps && Number.isFinite(user.max_concurrent_tasks)
        ? user.max_concurrent_tasks
        : effMaxConcurrent,
    }))

    // 5) Experience matrix
    const experienceMatrix = await buildExperienceMatrix(userIds, Array.from(allSkills))

    // 6) Build algorithm tasks
    const algorithmTasks: AlgoTask[] = tasksData.map(task => ({
      id: task.id,
      name: task.name,
      required_skills: taskSkillsMap.get(task.id) || [],
      priority: 1,
      estimated_hours: 8,
    }))

    // 7) Run assignment + fallback (or planning greedy)
    let assignments: any[] = []
    if (planning) {
      assignments = algorithmTasks.map(t => {
        let bestUser: any = null
        let bestScore = -1
        let expAvg = 0
        for (const u of availableUsers) {
          const exps = t.required_skills.map(sid => experienceMatrix?.[u.id]?.[sid] ?? 0)
          const avg = exps.length ? exps.reduce((a: number, b: number) => a + b, 0) / exps.length : 0
          if (avg > bestScore) { bestScore = avg; bestUser = u; expAvg = avg }
        }
        return { task_id: t.id, user_id: bestUser?.id, confidence_score: bestScore < 0 ? 0 : bestScore, experience_score: expAvg }
      })
    } else {
      const assignmentsStrict = constrainedHungarianAssignment(
        algorithmTasks,
        availableUsers,
        experienceMatrix,
        effMaxConcurrent,
        {
          minConfidence: AP.min_confidence_R ?? minConfidenceR,
          unassignedCost: AP.unassigned_cost ?? 0.5,
          bigPenalty: 1e6,
          priorityMode: AP.priority_mode,
        }
      )
      assignments = assignmentsStrict
      if (assignmentsStrict.length < algorithmTasks.length) {
        const assignedSet = new Set(assignmentsStrict.map(a => a.task_id))
        const unassignedCount = algorithmTasks.filter(t => !assignedSet.has(t.id)).length
        const freeUsers = availableUsers.filter(u => u.current_workload < Math.min(effMaxConcurrent, u.max_concurrent_tasks))
        if (unassignedCount > 0 && freeUsers.length > 0) {
          const relaxed = constrainedHungarianAssignment(
            algorithmTasks,
            availableUsers,
            experienceMatrix,
            effMaxConcurrent,
            { minConfidence: 0.2, unassignedCost: 0.7, bigPenalty: 1e6, priorityMode: AP.priority_mode }
          )
          const relaxedMap = new Map(relaxed.map(r => [r.task_id, r]))
          const merged: typeof assignments = []
          for (const t of algorithmTasks) {
            const strict = assignmentsStrict.find(a => a.task_id === t.id)
            if (strict) { merged.push(strict); continue }
            const alt = relaxedMap.get(t.id)
            if (alt) merged.push(alt)
          }
          assignments = merged
        }
      }
    }

    // 8) Build preview payload (R only)
    const results = assignments.map(a => {
      const task = tasksData.find(t => t.id === a.task_id)
      const user = (allUsers as any[]).find(u => u.id === a.user_id)
      return {
        task_id: a.task_id,
        task_name: task?.name,
        user_id: a.user_id,
        user_name: user?.full_name,
        confidence_score: a.confidence_score,
        experience_score: a.experience_score,
      }
    })

    const unassignedTasks = tasksData
      .filter(task => !assignments.some(a => a.task_id === task.id))
      .map(task => ({ task_id: task.id, task_name: task.name, reason: 'Preview: chưa đạt ngưỡng hoặc thiếu năng lực/capacity' }))

    return NextResponse.json({
      success: true,
      message: `Preview: Có thể phân công ${results.length}/${tasksData.length} công việc`,
      assignments: results,
      unassigned: unassignedTasks,
      debug: {
        total_tasks: tasksData.length,
        total_users: availableUsers.length,
        available_users: availableUsers.filter(u => u.current_workload < Math.min(effMaxConcurrent, u.max_concurrent_tasks)).length,
        algorithm_used: planning ? 'planning_greedy (ignore capacity) (preview)' : 'experience_matrix + constrained_hungarian (preview)'
      }
    })
  } catch (error: any) {
    console.error('Lỗi preview tự động phân công RACI:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
