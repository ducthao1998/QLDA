import { Task, Project, User, TaskDependency, ScheduleDetail } from "@/app/types/table-types"
import { multiProjectCPM } from "./multi-project-cpm"
import { constrainedHungarianAssignment } from "./hungarian-assignment"
import { buildExperienceMatrix } from "./experience-matrix"

export interface GanttViewMode {
  type: 'day' | 'week' | 'month' | 'quarter'
  zoom_level: number
  show_critical_path: boolean
  show_dependencies: boolean
  show_resource_conflicts: boolean
}

export interface ResourceConstraint {
  user_id: string
  max_concurrent_tasks: number
  working_hours_per_day: number
  unavailable_periods: Array<{
    start_date: string
    end_date: string
    reason: string
  }>
}

export interface ConflictResolution {
  conflict_id: string
  type: 'resource_overallocation' | 'dependency_violation' | 'deadline_miss'
  severity: 'low' | 'medium' | 'high' | 'critical'
  affected_tasks: string[]
  resolution_strategy: 'reschedule' | 'reassign' | 'parallelize' | 'extend_deadline'
  estimated_impact: {
    time_delay: number // in hours
    cost_increase: number // percentage
    quality_risk: number // 0-1
  }
}

export interface OptimizedGanttResult {
  optimized_schedule: ScheduleDetail[]
  view_optimizations: {
    [key in GanttViewMode['type']]: {
      optimal_zoom: number
      recommended_grouping: 'by_user' | 'by_phase' | 'by_priority'
      idle_time_percentage: number
      resource_utilization: number
    }
  }
  conflict_resolutions: ConflictResolution[]
  collaboration_suggestions: Array<{
    task_id: string
    suggestion_type: 'parallel_work' | 'knowledge_sharing' | 'review_overlap'
    participants: string[]
    estimated_time_saving: number
  }>
  real_time_updates: {
    last_optimized: string
    next_optimization_due: string
    auto_reoptimize_triggers: string[]
  }
}

/**
 * Thuật toán Gantt Optimization
 * 
 * Input: Schedule từ CPM, view mode (day/week/month)
 * Output: Optimized Gantt chart với minimal idle time
 * Features: Real-time collaboration, conflict resolution
 */
export async function multiProjectGanttOptimization(
  projects: Project[],
  allTasks: Task[],
  allDependencies: TaskDependency[],
  users: User[],
  resourceConstraints: ResourceConstraint[],
  viewMode: GanttViewMode
): Promise<OptimizedGanttResult> {
  
  // 1. Run Multi-Project CPM to get initial schedule
  const cpmResult = multiProjectCPM(projects, allTasks, allDependencies)
  
  // 2. Build experience matrix for better assignments
  const userIds = users.map(u => u.id)
  const skillIds = Array.from(new Set(allTasks.flatMap(t => 
    // Assuming tasks have skill requirements - adjust based on your schema
    []
  )))
  const experienceMatrix = await buildExperienceMatrix(userIds, skillIds)
  
  // 3. Optimize resource assignments
  const optimizedAssignments = await optimizeResourceAssignments(
    allTasks,
    users,
    experienceMatrix,
    resourceConstraints
  )
  
  // 4. Create optimized schedule details
  const projectStartDate = new Date(projects[0]?.start_date || new Date())
  const optimizedSchedule = await createOptimizedSchedule(
    allTasks,
    optimizedAssignments,
    cpmResult,
    resourceConstraints,
    projectStartDate
  )
  
  // 5. Detect and resolve conflicts
  const conflictResolutions = await detectAndResolveConflicts(
    optimizedSchedule,
    allTasks,
    allDependencies,
    resourceConstraints
  )
  
  // 6. Generate view optimizations for different modes
  const viewOptimizations = generateViewOptimizations(
    optimizedSchedule,
    allTasks,
    users,
    viewMode
  )
  
  // 7. Generate collaboration suggestions
  const collaborationSuggestions = generateCollaborationSuggestions(
    optimizedSchedule,
    allTasks,
    users,
    experienceMatrix
  )
  
  // 8. Setup real-time update configuration
  const realTimeUpdates = {
    last_optimized: new Date().toISOString(),
    next_optimization_due: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    auto_reoptimize_triggers: [
      'task_completion',
      'resource_availability_change',
      'new_task_added',
      'dependency_change',
      'deadline_change'
    ]
  }
  
  return {
    optimized_schedule: optimizedSchedule,
    view_optimizations: viewOptimizations,
    conflict_resolutions: conflictResolutions,
    collaboration_suggestions: collaborationSuggestions,
    real_time_updates: realTimeUpdates
  }
}

async function optimizeResourceAssignments(
  tasks: Task[],
  users: User[],
  experienceMatrix: any,
  resourceConstraints: ResourceConstraint[]
): Promise<Array<{ task_id: string; user_id: string; confidence: number }>> {
  const assignments: Array<{ task_id: string; user_id: string; confidence: number }> = []
  
  // Convert tasks to Hungarian algorithm format
  const hungarianTasks = tasks.map(task => ({
    id: String(task.id),
    name: task.name,
    required_skills: [], // Would need to be populated from task-skill relationships
    priority: 1, // Could be derived from task properties
    estimated_hours: task.duration_days ? task.duration_days * 8 : 8
  }))
  
  // Convert users to Hungarian algorithm format
  const hungarianUsers = users.map(user => {
    const constraint = resourceConstraints.find(c => c.user_id === user.id)
    return {
      id: user.id,
      name: user.full_name || '',
      current_workload: 0, // Would need to be calculated from existing assignments
      max_concurrent_tasks: constraint?.max_concurrent_tasks || 2
    }
  })
  
  // Run Hungarian assignment
  const hungarianResults = constrainedHungarianAssignment(
    hungarianTasks,
    hungarianUsers,
    experienceMatrix,
    2 // max concurrent tasks
  )
  
  // Convert results back
  hungarianResults.forEach(result => {
    assignments.push({
      task_id: result.task_id,
      user_id: result.user_id,
      confidence: result.confidence_score
    })
  })
  
  return assignments
}

async function createOptimizedSchedule(
  tasks: Task[],
  assignments: Array<{ task_id: string; user_id: string; confidence: number }>,
  cpmResult: any,
  resourceConstraints: ResourceConstraint[],
  projectStartDate: Date
): Promise<ScheduleDetail[]> {
  const schedule: ScheduleDetail[] = []
  
  // Use CPM result to get calculated dates, or calculate from project start + duration
  tasks.forEach(task => {
    const assignment = assignments.find(a => a.task_id === String(task.id))
    const assignedUserId = assignment?.user_id || ''
    
    // Calculate start and end dates from CPM result or duration
    let startDate: Date
    let endDate: Date
    
    if (cpmResult && cpmResult.taskSchedule && cpmResult.taskSchedule[String(task.id)]) {
      // Use CPM calculated dates
      const cpmTask = cpmResult.taskSchedule[String(task.id)]
      startDate = new Date(projectStartDate.getTime() + cpmTask.earliestStart * 24 * 60 * 60 * 1000)
      endDate = new Date(projectStartDate.getTime() + cpmTask.earliestFinish * 24 * 60 * 60 * 1000)
    } else {
      // Fallback: calculate from duration_days
      const durationDays = task.duration_days || 1
      startDate = new Date(projectStartDate)
      endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000)
    }
    
    // Apply resource constraints
    const constraint = resourceConstraints.find(c => c.user_id === assignedUserId)
    if (constraint) {
      // Check for unavailable periods and adjust schedule
      const adjustedDates = adjustForUnavailability(startDate, endDate, constraint)
      startDate = adjustedDates.start
      endDate = adjustedDates.end
    }
    
    schedule.push({
      id: `schedule_${task.id}`,
      schedule_run_id: '', // Would be set by the calling function
      task_id: String(task.id),
      assigned_user: assignedUserId,
      start_ts: startDate.toISOString(),
      finish_ts: endDate.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  })
  
  return schedule
}

function adjustForUnavailability(
  startDate: Date,
  endDate: Date,
  constraint: ResourceConstraint
): { start: Date; end: Date } {
  let adjustedStart = new Date(startDate)
  let adjustedEnd = new Date(endDate)
  
  // Check each unavailable period
  constraint.unavailable_periods.forEach(period => {
    const unavailableStart = new Date(period.start_date)
    const unavailableEnd = new Date(period.end_date)
    
    // If task overlaps with unavailable period, shift it
    if (adjustedStart < unavailableEnd && adjustedEnd > unavailableStart) {
      const taskDuration = adjustedEnd.getTime() - adjustedStart.getTime()
      adjustedStart = new Date(unavailableEnd.getTime() + 1000) // Start 1 second after unavailable period
      adjustedEnd = new Date(adjustedStart.getTime() + taskDuration)
    }
  })
  
  return { start: adjustedStart, end: adjustedEnd }
}

async function detectAndResolveConflicts(
  schedule: ScheduleDetail[],
  tasks: Task[],
  dependencies: TaskDependency[],
  resourceConstraints: ResourceConstraint[]
): Promise<ConflictResolution[]> {
  const conflicts: ConflictResolution[] = []
  
  // 1. Detect resource overallocation
  const resourceConflicts = detectResourceOverallocation(schedule, resourceConstraints)
  conflicts.push(...resourceConflicts)
  
  // 2. Detect dependency violations
  const dependencyConflicts = detectDependencyViolations(schedule, dependencies)
  conflicts.push(...dependencyConflicts)
  
  // 3. Detect deadline misses
  const deadlineConflicts = detectDeadlineMisses(schedule, tasks)
  conflicts.push(...deadlineConflicts)
  
  return conflicts
}

function detectResourceOverallocation(
  schedule: ScheduleDetail[],
  resourceConstraints: ResourceConstraint[]
): ConflictResolution[] {
  const conflicts: ConflictResolution[] = []
  
  // Group schedule by user
  const userSchedules = new Map<string, ScheduleDetail[]>()
  schedule.forEach(item => {
    if (!userSchedules.has(item.assigned_user)) {
      userSchedules.set(item.assigned_user, [])
    }
    userSchedules.get(item.assigned_user)!.push(item)
  })
  
  // Check each user's schedule
  userSchedules.forEach((userTasks, userId) => {
    const constraint = resourceConstraints.find(c => c.user_id === userId)
    if (!constraint) return
    
    // Sort tasks by start time
    userTasks.sort((a, b) => new Date(a.start_ts).getTime() - new Date(b.start_ts).getTime())
    
    // Check for overlapping tasks
    for (let i = 0; i < userTasks.length - 1; i++) {
      const currentTask = userTasks[i]
      const nextTask = userTasks[i + 1]
      
      const currentEnd = new Date(currentTask.finish_ts)
      const nextStart = new Date(nextTask.start_ts)
      
      if (currentEnd > nextStart) {
        conflicts.push({
          conflict_id: `resource_${userId}_${i}`,
          type: 'resource_overallocation',
          severity: 'high',
          affected_tasks: [currentTask.task_id, nextTask.task_id],
          resolution_strategy: 'reschedule',
          estimated_impact: {
            time_delay: 8, // 1 day delay
            cost_increase: 5, // 5% cost increase
            quality_risk: 0.2 // 20% quality risk
          }
        })
      }
    }
  })
  
  return conflicts
}

function detectDependencyViolations(
  schedule: ScheduleDetail[],
  dependencies: TaskDependency[]
): ConflictResolution[] {
  const conflicts: ConflictResolution[] = []
  
  dependencies.forEach(dep => {
    const dependentTask = schedule.find(s => s.task_id === String(dep.task_id))
    const prerequisiteTask = schedule.find(s => s.task_id === String(dep.depends_on_id))
    
    if (dependentTask && prerequisiteTask) {
      const dependentStart = new Date(dependentTask.start_ts)
      const prerequisiteEnd = new Date(prerequisiteTask.finish_ts)
      
      if (dependentStart < prerequisiteEnd) {
        conflicts.push({
          conflict_id: `dependency_${dep.task_id}_${dep.depends_on_id}`,
          type: 'dependency_violation',
          severity: 'critical',
          affected_tasks: [String(dep.task_id), String(dep.depends_on_id)],
          resolution_strategy: 'reschedule',
          estimated_impact: {
            time_delay: 16, // 2 days delay
            cost_increase: 10, // 10% cost increase
            quality_risk: 0.3 // 30% quality risk
          }
        })
      }
    }
  })
  
  return conflicts
}

function detectDeadlineMisses(
  schedule: ScheduleDetail[],
  tasks: Task[]
): ConflictResolution[] {
  const conflicts: ConflictResolution[] = []
  
  // Since tasks only have duration_days, we can't detect deadline misses
  // This function would need project deadlines or task deadlines to work properly
  // For now, return empty array
  
  return conflicts
}

function generateViewOptimizations(
  schedule: ScheduleDetail[],
  tasks: Task[],
  users: User[],
  viewMode: GanttViewMode
): OptimizedGanttResult['view_optimizations'] {
  const optimizations: OptimizedGanttResult['view_optimizations'] = {
    day: {
      optimal_zoom: 1,
      recommended_grouping: 'by_user',
      idle_time_percentage: 0,
      resource_utilization: 0
    },
    week: {
      optimal_zoom: 0.7,
      recommended_grouping: 'by_phase',
      idle_time_percentage: 0,
      resource_utilization: 0
    },
    month: {
      optimal_zoom: 0.3,
      recommended_grouping: 'by_priority',
      idle_time_percentage: 0,
      resource_utilization: 0
    },
    quarter: {
      optimal_zoom: 0.1,
      recommended_grouping: 'by_phase',
      idle_time_percentage: 0,
      resource_utilization: 0
    }
  }
  
  // Calculate metrics for each view mode
  Object.keys(optimizations).forEach(mode => {
    const modeKey = mode as keyof typeof optimizations
    const optimization = optimizations[modeKey]
    
    // Calculate idle time percentage
    const totalTime = calculateTotalProjectTime(schedule)
    const activeTime = calculateActiveTime(schedule)
    optimization.idle_time_percentage = ((totalTime - activeTime) / totalTime) * 100
    
    // Calculate resource utilization
    optimization.resource_utilization = calculateResourceUtilization(schedule, users)
  })
  
  return optimizations
}

function calculateTotalProjectTime(schedule: ScheduleDetail[]): number {
  if (schedule.length === 0) return 0
  
  const startTimes = schedule.map(s => new Date(s.start_ts).getTime())
  const endTimes = schedule.map(s => new Date(s.finish_ts).getTime())
  
  const projectStart = Math.min(...startTimes)
  const projectEnd = Math.max(...endTimes)
  
  return (projectEnd - projectStart) / (1000 * 60 * 60) // Convert to hours
}

function calculateActiveTime(schedule: ScheduleDetail[]): number {
  return schedule.reduce((total, item) => {
    const start = new Date(item.start_ts).getTime()
    const end = new Date(item.finish_ts).getTime()
    return total + (end - start) / (1000 * 60 * 60) // Convert to hours
  }, 0)
}

function calculateResourceUtilization(schedule: ScheduleDetail[], users: User[]): number {
  const userUtilization = new Map<string, number>()
  
  // Calculate utilization for each user
  users.forEach(user => {
    const userTasks = schedule.filter(s => s.assigned_user === user.id)
    const totalHours = userTasks.reduce((sum, task) => {
      const start = new Date(task.start_ts).getTime()
      const end = new Date(task.finish_ts).getTime()
      return sum + (end - start) / (1000 * 60 * 60)
    }, 0)
    
    // Assume 8 hours per day, 5 days per week
    const availableHours = 8 * 5 * 4 // 4 weeks
    userUtilization.set(user.id, totalHours / availableHours)
  })
  
  // Calculate average utilization
  const utilizationValues = Array.from(userUtilization.values())
  return utilizationValues.reduce((sum, util) => sum + util, 0) / utilizationValues.length
}

function generateCollaborationSuggestions(
  schedule: ScheduleDetail[],
  tasks: Task[],
  users: User[],
  experienceMatrix: any
): Array<{
  task_id: string
  suggestion_type: 'parallel_work' | 'knowledge_sharing' | 'review_overlap'
  participants: string[]
  estimated_time_saving: number
}> {
  const suggestions: Array<{
    task_id: string
    suggestion_type: 'parallel_work' | 'knowledge_sharing' | 'review_overlap'
    participants: string[]
    estimated_time_saving: number
  }> = []
  
  // Find tasks that could benefit from parallel work
  tasks.forEach(task => {
    const scheduleItem = schedule.find(s => s.task_id === String(task.id))
    if (!scheduleItem) return
    
    // Check if task is large enough to split
    const taskDuration = new Date(scheduleItem.finish_ts).getTime() - new Date(scheduleItem.start_ts).getTime()
    const taskHours = taskDuration / (1000 * 60 * 60)
    
    if (taskHours > 16) { // Tasks longer than 2 days
      // Find users with relevant experience
      const suitableUsers = users.filter(user => {
        // This would use the experience matrix to find suitable users
        return user.id !== scheduleItem.assigned_user
      }).slice(0, 2) // Limit to 2 additional users
      
      if (suitableUsers.length > 0) {
        suggestions.push({
          task_id: String(task.id),
          suggestion_type: 'parallel_work',
          participants: [scheduleItem.assigned_user, ...suitableUsers.map(u => u.id)],
          estimated_time_saving: taskHours * 0.3 // 30% time saving
        })
      }
    }
  })
  
  return suggestions
}
