import { createClient } from '@/lib/supabase/server'

export interface HistoricalProject {
  id: string
  name: string
  project_field: string
  classification: string
  tasks: Array<{
    id: string
    name: string
    template_id?: number
    raci_assignments: Array<{
      user_id: string
      role: 'R' | 'A' | 'C' | 'I'
      user: {
        id: string
        full_name: string
        position: string
        org_unit: string
      }
    }>
  }>
}

export interface TaskTemplate {
  id: number
  name: string
  description: string
  field: string
  typical_roles: Array<{
    role: 'R' | 'A' | 'C' | 'I'
    position_pattern: string
    org_pattern?: string
    weight: number
  }>
}

export interface RACIRecommendation {
  task_id: string
  task_name: string
  recommendations: Array<{
    user_id: string
    user_name: string
    position: string
    org_unit: string
    role: 'R' | 'A' | 'C' | 'I'
    confidence_score: number
    reasoning: string[]
  }>
}

/**
 * Thuật toán Auto RACI Generation
 * 
 * Input: Dữ liệu từ bảng task_raci của các dự án cũ
 * Output: Đề xuất RACI matrix cho dự án mới
 * Logic: Machine learning từ patterns trong lịch sử
 */
export async function automaticRACIGeneration(
  projectId: string,
  projectField: string,
  projectClassification: string,
  taskTemplates?: TaskTemplate[]
): Promise<RACIRecommendation[]> {
  const supabase = await createClient()
  
  try {
    // 1. Lấy dữ liệu lịch sử từ các dự án tương tự
    const historicalProjects = await getHistoricalProjects(
      supabase,
      projectField,
      projectClassification
    )

    // 2. Lấy tasks của dự án hiện tại
    const { data: currentTasks, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        id,
        name,
        template_id,
        note
      `)
      .eq('project_id', projectId)

    if (tasksError) {
      console.error('Error fetching current tasks:', tasksError)
      return []
    }

    // 3. Lấy danh sách users có thể tham gia
    const { data: availableUsers, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, position, org_unit')

    if (usersError) {
      console.error('Error fetching users:', usersError)
      return []
    }

    // 4. Tạo recommendations cho từng task
    const recommendations: RACIRecommendation[] = []

    for (const task of currentTasks || []) {
      const taskRecommendations = await generateTaskRACIRecommendations(
        task,
        historicalProjects,
        availableUsers || [],
        taskTemplates
      )

      recommendations.push({
        task_id: String(task.id),
        task_name: task.name,
        recommendations: taskRecommendations
      })
    }

    return recommendations

  } catch (error) {
    console.error('Error in automatic RACI generation:', error)
    return []
  }
}

async function getHistoricalProjects(
  supabase: any,
  projectField: string,
  projectClassification: string
): Promise<HistoricalProject[]> {
  // Lấy các dự án tương tự (cùng field và classification)
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select(`
      id,
      name,
      project_field,
      classification,
      tasks!inner(
        id,
        name,
        template_id,
        task_raci!inner(
          user_id,
          role,
          users!inner(
            id,
            full_name,
            position,
            org_unit
          )
        )
      )
    `)
    .eq('project_field', projectField)
    .eq('classification', projectClassification)
    .eq('status', 'completed') // Chỉ lấy dự án đã hoàn thành
    .limit(10) // Giới hạn số dự án để tránh quá tải

  if (projectsError) {
    console.error('Error fetching historical projects:', projectsError)
    return []
  }

  return projects?.map((project: any) => ({
    id: project.id,
    name: project.name,
    project_field: project.project_field,
    classification: project.classification,
    tasks: project.tasks?.map((task: any) => ({
      id: task.id,
      name: task.name,
      template_id: task.template_id,
      raci_assignments: task.task_raci?.map((raci: any) => ({
        user_id: raci.user_id,
        role: raci.role,
        user: raci.users
      })) || []
    })) || []
  })) || []
}

async function generateTaskRACIRecommendations(
  task: any,
  historicalProjects: HistoricalProject[],
  availableUsers: any[],
  taskTemplates?: TaskTemplate[]
): Promise<Array<{
  user_id: string
  user_name: string
  position: string
  org_unit: string
  role: 'R' | 'A' | 'C' | 'I'
  confidence_score: number
  reasoning: string[]
}>> {
  const recommendations: Array<{
    user_id: string
    user_name: string
    position: string
    org_unit: string
    role: 'R' | 'A' | 'C' | 'I'
    confidence_score: number
    reasoning: string[]
  }> = []

  // 1. Template-based recommendations (nếu có template)
  if (task.template_id && taskTemplates) {
    const template = taskTemplates.find(t => t.id === task.template_id)
    if (template) {
      const templateRecs = generateTemplateBasedRecommendations(
        template,
        availableUsers
      )
      recommendations.push(...templateRecs)
    }
  }

  // 2. Historical pattern-based recommendations
  const historicalRecs = generateHistoricalPatternRecommendations(
    task,
    historicalProjects,
    availableUsers
  )
  recommendations.push(...historicalRecs)

  // 3. Role-based recommendations (fallback)
  if (recommendations.length === 0) {
    const roleBasedRecs = generateRoleBasedRecommendations(availableUsers)
    recommendations.push(...roleBasedRecs)
  }

  // 4. Merge và rank recommendations
  const mergedRecs = mergeAndRankRecommendations(recommendations)

  // 5. Ensure RACI completeness (mỗi task phải có ít nhất 1 R và 1 A)
  return ensureRACICompleteness(mergedRecs, availableUsers)
}

function generateTemplateBasedRecommendations(
  template: TaskTemplate,
  availableUsers: any[]
): Array<{
  user_id: string
  user_name: string
  position: string
  org_unit: string
  role: 'R' | 'A' | 'C' | 'I'
  confidence_score: number
  reasoning: string[]
}> {
  const recommendations: Array<{
    user_id: string
    user_name: string
    position: string
    org_unit: string
    role: 'R' | 'A' | 'C' | 'I'
    confidence_score: number
    reasoning: string[]
  }> = []

  template.typical_roles.forEach(typicalRole => {
    // Tìm users phù hợp với pattern
    const matchingUsers = availableUsers.filter(user => {
      const positionMatch = user.position?.toLowerCase().includes(
        typicalRole.position_pattern.toLowerCase()
      )
      const orgMatch = !typicalRole.org_pattern || 
        user.org_unit?.toLowerCase().includes(
          typicalRole.org_pattern.toLowerCase()
        )
      
      return positionMatch && orgMatch
    })

    // Tạo recommendations cho users phù hợp
    matchingUsers.forEach(user => {
      recommendations.push({
        user_id: user.id,
        user_name: user.full_name,
        position: user.position,
        org_unit: user.org_unit,
        role: typicalRole.role,
        confidence_score: 0.8 * typicalRole.weight, // High confidence for template match
        reasoning: [
          `Phù hợp với template "${template.name}"`,
          `Vị trí "${user.position}" khớp với pattern "${typicalRole.position_pattern}"`,
          typicalRole.org_pattern ? `Đơn vị "${user.org_unit}" khớp với pattern "${typicalRole.org_pattern}"` : ''
        ].filter(Boolean)
      })
    })
  })

  return recommendations
}

function generateHistoricalPatternRecommendations(
  task: any,
  historicalProjects: HistoricalProject[],
  availableUsers: any[]
): Array<{
  user_id: string
  user_name: string
  position: string
  org_unit: string
  role: 'R' | 'A' | 'C' | 'I'
  confidence_score: number
  reasoning: string[]
}> {
  const recommendations: Array<{
    user_id: string
    user_name: string
    position: string
    org_unit: string
    role: 'R' | 'A' | 'C' | 'I'
    confidence_score: number
    reasoning: string[]
  }> = []

  // Tìm các task tương tự trong lịch sử
  const similarTasks: Array<{
    task: any
    similarity: number
    project: HistoricalProject
  }> = []

  historicalProjects.forEach(project => {
    project.tasks.forEach(historicalTask => {
      const similarity = calculateTaskSimilarity(task, historicalTask)
      if (similarity > 0.3) { // Threshold for similarity
        similarTasks.push({
          task: historicalTask,
          similarity,
          project
        })
      }
    })
  })

  // Sort by similarity
  similarTasks.sort((a, b) => b.similarity - a.similarity)

  // Analyze patterns from similar tasks
  const rolePatterns = new Map<string, {
    role: 'R' | 'A' | 'C' | 'I'
    position: string
    org_unit: string
    frequency: number
    projects: string[]
  }>()

  similarTasks.forEach(({ task: similarTask, similarity, project }) => {
    similarTask.raci_assignments.forEach((assignment: any) => {
      const key = `${assignment.role}-${assignment.user.position}-${assignment.user.org_unit}`
      
      if (!rolePatterns.has(key)) {
        rolePatterns.set(key, {
          role: assignment.role,
          position: assignment.user.position,
          org_unit: assignment.user.org_unit,
          frequency: 0,
          projects: []
        })
      }

      const pattern = rolePatterns.get(key)!
      pattern.frequency += similarity // Weight by similarity
      if (!pattern.projects.includes(project.name)) {
        pattern.projects.push(project.name)
      }
    })
  })

  // Generate recommendations based on patterns
  rolePatterns.forEach(pattern => {
    // Find matching users
    const matchingUsers = availableUsers.filter(user => {
      const positionMatch = user.position?.toLowerCase() === pattern.position?.toLowerCase()
      const orgMatch = user.org_unit?.toLowerCase() === pattern.org_unit?.toLowerCase()
      return positionMatch || orgMatch // Either position or org match
    })

    matchingUsers.forEach(user => {
      const confidence = Math.min(0.9, pattern.frequency / similarTasks.length)
      
      recommendations.push({
        user_id: user.id,
        user_name: user.full_name,
        position: user.position,
        org_unit: user.org_unit,
        role: pattern.role,
        confidence_score: confidence,
        reasoning: [
          `Dựa trên ${pattern.projects.length} dự án tương tự`,
          `Vị trí "${pattern.position}" thường đảm nhận vai trò ${pattern.role}`,
          `Xuất hiện trong: ${pattern.projects.slice(0, 3).join(', ')}${pattern.projects.length > 3 ? '...' : ''}`
        ]
      })
    })
  })

  return recommendations
}

function generateRoleBasedRecommendations(
  availableUsers: any[]
): Array<{
  user_id: string
  user_name: string
  position: string
  org_unit: string
  role: 'R' | 'A' | 'C' | 'I'
  confidence_score: number
  reasoning: string[]
}> {
  const recommendations: Array<{
    user_id: string
    user_name: string
    position: string
    org_unit: string
    role: 'R' | 'A' | 'C' | 'I'
    confidence_score: number
    reasoning: string[]
  }> = []

  // Basic role assignment rules based on position
  const roleRules = [
    {
      positionPatterns: ['manager', 'lead', 'trưởng', 'giám đốc'],
      role: 'A' as const,
      confidence: 0.6,
      reasoning: 'Vị trí quản lý thường đảm nhận vai trò Accountable'
    },
    {
      positionPatterns: ['developer', 'engineer', 'specialist', 'chuyên viên', 'kỹ sư'],
      role: 'R' as const,
      confidence: 0.5,
      reasoning: 'Vị trí chuyên môn thường đảm nhận vai trò Responsible'
    },
    {
      positionPatterns: ['consultant', 'advisor', 'tư vấn'],
      role: 'C' as const,
      confidence: 0.5,
      reasoning: 'Vị trí tư vấn thường đảm nhận vai trò Consulted'
    }
  ]

  availableUsers.forEach(user => {
    const position = user.position?.toLowerCase() || ''
    
    roleRules.forEach(rule => {
      const matches = rule.positionPatterns.some(pattern => 
        position.includes(pattern.toLowerCase())
      )
      
      if (matches) {
        recommendations.push({
          user_id: user.id,
          user_name: user.full_name,
          position: user.position,
          org_unit: user.org_unit,
          role: rule.role,
          confidence_score: rule.confidence,
          reasoning: [rule.reasoning]
        })
      }
    })
  })

  return recommendations
}

function calculateTaskSimilarity(task1: any, task2: any): number {
  let similarity = 0
  let factors = 0

  // Name similarity (using simple word matching)
  const name1Words = task1.name.toLowerCase().split(/\s+/)
  const name2Words = task2.name.toLowerCase().split(/\s+/)
  const commonWords = name1Words.filter((word: string) => name2Words.includes(word))
  const nameSimilarity = commonWords.length / Math.max(name1Words.length, name2Words.length)
  
  similarity += nameSimilarity * 0.6
  factors += 0.6

  // Template similarity
  if (task1.template_id && task2.template_id) {
    if (task1.template_id === task2.template_id) {
      similarity += 0.4
    }
    factors += 0.4
  }

  return factors > 0 ? similarity / factors : 0
}

function mergeAndRankRecommendations(
  recommendations: Array<{
    user_id: string
    user_name: string
    position: string
    org_unit: string
    role: 'R' | 'A' | 'C' | 'I'
    confidence_score: number
    reasoning: string[]
  }>
): Array<{
  user_id: string
  user_name: string
  position: string
  org_unit: string
  role: 'R' | 'A' | 'C' | 'I'
  confidence_score: number
  reasoning: string[]
}> {
  // Group by user_id and role
  const grouped = new Map<string, {
    user_id: string
    user_name: string
    position: string
    org_unit: string
    role: 'R' | 'A' | 'C' | 'I'
    confidence_score: number
    reasoning: string[]
  }>()

  recommendations.forEach(rec => {
    const key = `${rec.user_id}-${rec.role}`
    
    if (!grouped.has(key)) {
      grouped.set(key, { ...rec })
    } else {
      const existing = grouped.get(key)!
      // Merge confidence scores (take average weighted by reasoning count)
      const totalWeight = existing.reasoning.length + rec.reasoning.length
      existing.confidence_score = (
        existing.confidence_score * existing.reasoning.length +
        rec.confidence_score * rec.reasoning.length
      ) / totalWeight
      
      // Merge reasoning
      existing.reasoning = [...existing.reasoning, ...rec.reasoning]
    }
  })

  // Convert back to array and sort by confidence
  return Array.from(grouped.values())
    .sort((a, b) => b.confidence_score - a.confidence_score)
}

function ensureRACICompleteness(
  recommendations: Array<{
    user_id: string
    user_name: string
    position: string
    org_unit: string
    role: 'R' | 'A' | 'C' | 'I'
    confidence_score: number
    reasoning: string[]
  }>,
  availableUsers: any[]
): Array<{
  user_id: string
  user_name: string
  position: string
  org_unit: string
  role: 'R' | 'A' | 'C' | 'I'
  confidence_score: number
  reasoning: string[]
}> {
  const hasResponsible = recommendations.some(r => r.role === 'R')
  const hasAccountable = recommendations.some(r => r.role === 'A')

  // Add default R if missing
  if (!hasResponsible && availableUsers.length > 0) {
    const defaultUser = availableUsers[0] // Take first available user
    recommendations.unshift({
      user_id: defaultUser.id,
      user_name: defaultUser.full_name,
      position: defaultUser.position,
      org_unit: defaultUser.org_unit,
      role: 'R',
      confidence_score: 0.3,
      reasoning: ['Được gán mặc định để đảm bảo có người chịu trách nhiệm thực hiện']
    })
  }

  // Add default A if missing
  if (!hasAccountable && availableUsers.length > 0) {
    // Try to find a manager-like position
    const manager = availableUsers.find(user => 
      user.position?.toLowerCase().includes('manager') ||
      user.position?.toLowerCase().includes('lead') ||
      user.position?.toLowerCase().includes('trưởng')
    ) || availableUsers[0]

    recommendations.unshift({
      user_id: manager.id,
      user_name: manager.full_name,
      position: manager.position,
      org_unit: manager.org_unit,
      role: 'A',
      confidence_score: 0.3,
      reasoning: ['Được gán mặc định để đảm bảo có người chịu trách nhiệm giải trình']
    })
  }

  return recommendations
}
