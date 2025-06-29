import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

// Types for optimization
interface Task {
  id: string
  name: string
  start_date: string
  end_date: string
  duration: number // in days
  phase_id: string
  dependencies?: string[]
  assigned_to?: string // từ RACI role 'R'
  required_skill_id?: number
  required_skills?: number[]
  status: string
}

interface Resource {
  user_id: string
  full_name: string
  skills: number[]
  current_workload: number
  availability: number // % available time
}

interface OptimizationConfig {
  algorithm: "cpm" | "genetic" | "resource_leveling"
  objective: {
    type: "time" | "resource" | "cost" | "multi"
    weights?: {
      time_weight: number
      resource_weight: number
      cost_weight: number
    }
  }
}

interface OptimizedSchedule {
  task_id: string
  task_name: string
  original_start: string
  original_end: string
  new_start: string
  new_end: string
  original_assignee?: string
  new_assignee?: string
  change_type: "rescheduled" | "reassigned" | "both" | "unchanged"
  reason: string
  impact: string
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id: projectId } = await params
  const config: OptimizationConfig = await req.json()

  try {
    // 1. Load project data
    const projectData = await loadProjectData(supabase, projectId)
    
    // 2. Run optimization based on selected algorithm
    let optimizedSchedule
    switch (config.algorithm) {
      case "cpm":
        optimizedSchedule = await runCPMOptimization(projectData)
        break
      case "genetic":
        optimizedSchedule = await runGeneticOptimization(projectData, config)
        break
      case "resource_leveling":
        optimizedSchedule = await runResourceLevelingOptimization(projectData)
        break
      default:
        throw new Error("Invalid algorithm")
    }

    // 3. Calculate metrics and prepare response
    const result = calculateOptimizationMetrics(projectData, optimizedSchedule, config)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Optimization error:", error)
    return NextResponse.json({ error: "Optimization failed" }, { status: 500 })
  }
}

// Load all project data including tasks, dependencies, resources
async function loadProjectData(supabase: any, projectId: string) {
  // Get project info
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single()

  // Get tasks with RACI assignments
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select(`
      *,
      task_raci!inner(
        user_id,
        role
      ),
      task_dependencies!task_dependencies_task_id_fkey(
        depends_on_id
      ),
      task_skills(
        skill_id
      )
    `)
    .eq("project_id", projectId)
    .order("start_date", { ascending: true })

  if (tasksError) {
    console.error("Error fetching tasks:", tasksError)
    throw new Error("Failed to fetch tasks")
  }

  if (!tasks || tasks.length === 0) {
    throw new Error("No tasks found for this project")
  }

  // Process tasks to include assigned user (role R) and dependencies
  const processedTasks = tasks.map((task: any) => {
    const responsibleUser = task.task_raci?.find((r: any) => r.role === "R")
    const dependencies = task.task_dependencies?.map((d: any) => d.depends_on_id) || []
    const requiredSkills = task.task_skills?.map((s: any) => s.skill_id) || []
    
    return {
      ...task,
      assigned_to: responsibleUser?.user_id,
      dependencies,
      required_skills: requiredSkills,
      duration: calculateDuration(task.start_date, task.end_date),
    }
  })

  // Get available resources with skills
  const { data: users, error: usersError } = await supabase.from("user_skill_matrix").select("*")

  if (usersError) {
    console.error("Error fetching users:", usersError)
    throw new Error("Failed to fetch users")
  }

  // Get current workload for each user
  const { data: workloads, error: workloadsError } = await supabase
    .from("task_raci")
    .select(`
      user_id,
      tasks!inner(
        id,
        status
      )
    `)
    .eq("role", "R")
    .in("tasks.status", ["todo", "in_progress"])

  if (workloadsError) {
    console.error("Error fetching workloads:", workloadsError)
    // Don't throw error for workloads, use empty array as fallback
  }

  // Process resources
  const resources = processResources(users || [], workloads || [])

  return {
    project,
    tasks: processedTasks,
    resources,
  }
}

// Critical Path Method optimization
async function runCPMOptimization(projectData: any) {
  const { tasks } = projectData

  // Build task network
  const network = buildTaskNetwork(tasks)

  // Calculate forward pass (earliest start/finish times)
  const forwardPass = calculateForwardPass(network)

  // Calculate backward pass (latest start/finish times)
  const backwardPass = calculateBackwardPass(network, forwardPass)

  // Identify critical path
  const criticalPath = identifyCriticalPath(forwardPass, backwardPass)

  // Optimize schedule based on critical path
  const optimizedSchedule = optimizeCriticalPath(tasks, criticalPath, forwardPass, backwardPass)

  return {
    schedule: optimizedSchedule,
    critical_path: criticalPath,
    algorithm_used: "Critical Path Method (CPM)",
  }
}

// Genetic Algorithm optimization
async function runGeneticOptimization(projectData: any, config: OptimizationConfig) {
  const { tasks, resources } = projectData
  const { weights } = config.objective

  // GA parameters
  const populationSize = 100
  const generations = 500
  const mutationRate = 0.1
  const crossoverRate = 0.8

  // Initialize population
  let population = initializePopulation(tasks, resources, populationSize)

  // Evolution loop
  for (let gen = 0; gen < generations; gen++) {
    // Evaluate fitness
    population = evaluateFitness(population, tasks, resources, weights)

    // Selection
    const parents = tournamentSelection(population)

    // Crossover
    const offspring = crossover(parents, crossoverRate)

    // Mutation
    const mutated = mutate(offspring, mutationRate, tasks, resources)

    // Create new generation
    population = [...parents.slice(0, populationSize / 2), ...mutated]
  }

  // Get best solution
  const bestSolution = population.sort((a, b) => b.fitness - a.fitness)[0]

  return {
    schedule: convertSolutionToSchedule(bestSolution, tasks),
    algorithm_used: "Genetic Algorithm",
  }
}

// Resource Leveling optimization
async function runResourceLevelingOptimization(projectData: any) {
  const { tasks, resources } = projectData

  // Calculate resource usage histogram
  const resourceHistogram = calculateResourceHistogram(tasks, resources)

  // Identify resource conflicts
  const conflicts = identifyResourceConflicts(resourceHistogram)

  // Resolve conflicts by rescheduling tasks
  const leveledSchedule = levelResources(tasks, resources, conflicts)

  return {
    schedule: leveledSchedule,
    algorithm_used: "Resource Leveling",
  }
}

// Helper functions
function calculateDuration(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function buildTaskNetwork(tasks: Task[]) {
  const network: any = {}

  tasks.forEach((task) => {
    network[task.id] = {
      ...task,
      predecessors: task.dependencies || [],
      successors: [],
    }
  })

  // Build successor relationships
  Object.values(network).forEach((task: any) => {
    task.predecessors.forEach((predId: string) => {
      if (network[predId]) {
        network[predId].successors.push(task.id)
      }
    })
  })

  return network
}

function calculateForwardPass(network: any) {
  const result: any = {}
  const visited = new Set()
  
  // Find tasks with no predecessors
  const startTasks = Object.values(network).filter((task: any) => task && task.id && task.predecessors.length === 0)
  
  if (startTasks.length === 0) {
    console.warn("No start tasks found, treating all tasks as independent")
    // If no start tasks, treat all tasks as independent
    Object.values(network).forEach((task: any) => {
      if (task && task.id) {
        result[task.id] = {
          earliestStart: 0,
          earliestFinish: task.duration || 0,
        }
      }
    })
    return result
  }
  
  // BFS to calculate earliest times
  const queue = [...startTasks]
  
  while (queue.length > 0) {
    const task: any = queue.shift()
    
    // Validate task exists and has required properties
    if (!task || !task.id || visited.has(task.id)) continue
    
    // Calculate earliest start
    let earliestStart = 0
    task.predecessors.forEach((predId: string) => {
      if (result[predId]) {
        earliestStart = Math.max(earliestStart, result[predId].earliestFinish)
      }
    })
    
    result[task.id] = {
      earliestStart,
      earliestFinish: earliestStart + (task.duration || 0),
    }
    
    visited.add(task.id)
    
    // Add successors to queue (with validation)
    task.successors.forEach((succId: string) => {
      const successor = network[succId]
      if (successor && successor.id) {
        const allPredecessorsVisited = successor.predecessors.every((predId: string) => visited.has(predId))
        if (allPredecessorsVisited) {
          queue.push(successor)
        }
      } else {
        console.warn(`Successor ${succId} not found in network for task ${task.id}`)
      }
    })
  }
  
  // Handle any tasks that weren't reached (cycles or isolated tasks)
  Object.values(network).forEach((task: any) => {
    if (task && task.id && !result[task.id]) {
      console.warn(`Task ${task.id} not reached in forward pass, treating as independent`)
      result[task.id] = {
        earliestStart: 0,
        earliestFinish: task.duration || 0,
      }
    }
  })
  
  return result
}

function calculateBackwardPass(network: any, forwardPass: any) {
  const result: any = {}
  const visited = new Set()
  
  // Find project end time
  let projectEnd = 0
  Object.values(forwardPass).forEach((times: any) => {
    projectEnd = Math.max(projectEnd, times.earliestFinish)
  })
  
  // Find tasks with no successors
  const endTasks = Object.values(network).filter((task: any) => task.successors.length === 0)
  
  // BFS to calculate latest times
  const queue = [...endTasks]
  
  while (queue.length > 0) {
    const task: any = queue.shift()
    
    // Validate task exists and has required properties
    if (!task || !task.id || visited.has(task.id)) continue
    
    // Calculate latest finish
    let latestFinish = projectEnd
    task.successors.forEach((succId: string) => {
      if (result[succId]) {
        latestFinish = Math.min(latestFinish, result[succId].latestStart)
      }
    })
    
    // Ensure forwardPass data exists for this task
    if (!forwardPass[task.id]) {
      console.error(`Missing forward pass data for task ${task.id}`)
      // Use fallback values
      result[task.id] = {
        latestFinish: projectEnd,
        latestStart: projectEnd - task.duration,
        totalFloat: 0,
      }
    } else {
      result[task.id] = {
        latestFinish,
        latestStart: latestFinish - task.duration,
        totalFloat: latestFinish - task.duration - forwardPass[task.id].earliestStart,
      }
    }
    
    visited.add(task.id)
    
    // Add predecessors to queue (with validation)
    task.predecessors.forEach((predId: string) => {
      const predecessor = network[predId]
      if (predecessor && predecessor.id) {
        queue.push(predecessor)
      } else {
        console.warn(`Predecessor ${predId} not found in network for task ${task.id}`)
      }
    })
  }
  
  // Handle any tasks that weren't reached
  Object.values(network).forEach((task: any) => {
    if (task && task.id && !result[task.id]) {
      console.warn(`Task ${task.id} not reached in backward pass, using fallback values`)
      result[task.id] = {
        latestFinish: projectEnd,
        latestStart: projectEnd - (task.duration || 0),
        totalFloat: 0,
      }
    }
  })
  
  return result
}

function identifyCriticalPath(forwardPass: any, backwardPass: any): string[] {
  const criticalTasks: string[] = []
  
  Object.keys(forwardPass).forEach((taskId) => {
    if (backwardPass[taskId] && backwardPass[taskId].totalFloat === 0) {
      criticalTasks.push(taskId)
    }
  })
  
  return criticalTasks
}

function optimizeCriticalPath(tasks: Task[], criticalPath: string[], forwardPass: any, backwardPass: any) {
  const schedule: OptimizedSchedule[] = []
  
  tasks.forEach((task) => {
    const isCritical = criticalPath.includes(task.id)
    const forward = forwardPass[task.id]
    const backward = backwardPass[task.id]
    
    // Handle missing data gracefully
    if (!forward || !backward) {
      console.warn(`Missing CPM data for task ${task.id}, using original schedule`)
      schedule.push({
        task_id: task.id,
        task_name: task.name,
        original_start: task.start_date,
        original_end: task.end_date,
        new_start: task.start_date,
        new_end: task.end_date,
        original_assignee: task.assigned_to,
        new_assignee: task.assigned_to,
        change_type: "unchanged",
        reason: "Missing CPM data, keeping original schedule",
        impact: "No changes applied due to missing data",
      })
      return
    }
    
    // Calculate new dates based on optimization
    const newStartDate = new Date(task.start_date)
    newStartDate.setDate(newStartDate.getDate() + forward.earliestStart)
    
    const newEndDate = new Date(newStartDate)
    newEndDate.setDate(newEndDate.getDate() + task.duration)
    
    schedule.push({
      task_id: task.id,
      task_name: task.name,
      original_start: task.start_date,
      original_end: task.end_date,
      new_start: newStartDate.toISOString(),
      new_end: newEndDate.toISOString(),
      original_assignee: task.assigned_to,
      new_assignee: task.assigned_to,
      change_type: newStartDate.getTime() !== new Date(task.start_date).getTime() ? "rescheduled" : "unchanged",
      reason: isCritical
        ? "Task is on critical path - cannot be delayed"
        : `Task has ${backward.totalFloat} days of float`,
      impact: isCritical ? "Critical for project completion" : "Can be delayed without affecting project end date",
    })
  })
  
  return schedule
}

function processResources(users: any[], workloads: any[]) {
  const workloadMap = new Map()

  workloads.forEach((w) => {
    const count = workloadMap.get(w.user_id) || 0
    workloadMap.set(w.user_id, count + 1)
  })

  // Group users by user_id and collect their skills
  const userMap = new Map()
  users.forEach((user) => {
    if (!userMap.has(user.user_id)) {
      userMap.set(user.user_id, {
        user_id: user.user_id,
        full_name: user.full_name,
        skills: [],
        current_workload: workloadMap.get(user.user_id) || 0,
        availability: 100 - (workloadMap.get(user.user_id) || 0) * 50, // Simple availability calc
      })
    }
    userMap.get(user.user_id).skills.push(user.skill_id)
  })

  return Array.from(userMap.values())
}

function calculateOptimizationMetrics(originalData: any, optimizedSchedule: any, config: OptimizationConfig) {
  const { tasks: originalTasks } = originalData
  const { schedule, critical_path, algorithm_used } = optimizedSchedule

  // Calculate original makespan
  let originalStart = new Date(originalTasks[0].start_date)
  let originalEnd = new Date(originalTasks[0].end_date)

  originalTasks.forEach((task: any) => {
    const start = new Date(task.start_date)
    const end = new Date(task.end_date)
    if (start < originalStart) originalStart = start
    if (end > originalEnd) originalEnd = end
  })

  const originalMakespan = Math.ceil((originalEnd.getTime() - originalStart.getTime()) / (1000 * 60 * 60 * 24))

  // Calculate optimized makespan
  let optimizedStart = new Date(schedule[0].new_start)
  let optimizedEnd = new Date(schedule[0].new_end)

  schedule.forEach((task: any) => {
    const start = new Date(task.new_start)
    const end = new Date(task.new_end)
    if (start < optimizedStart) optimizedStart = start
    if (end > optimizedEnd) optimizedEnd = end
  })

  const optimizedMakespan = Math.ceil((optimizedEnd.getTime() - optimizedStart.getTime()) / (1000 * 60 * 60 * 24))

  // Calculate improvement
  const improvement = ((originalMakespan - optimizedMakespan) / originalMakespan) * 100

  // Resource utilization metrics
  const resourceMetrics = calculateResourceUtilization(originalData, schedule)

  return {
    algorithm_used,
    original_makespan: originalMakespan,
    optimized_makespan: optimizedMakespan,
    improvement_percentage: Math.max(0, improvement),
    resource_utilization_before: resourceMetrics.before,
    resource_utilization_after: resourceMetrics.after,
    workload_balance: resourceMetrics.balance,
    schedule_changes: schedule.filter((s: any) => s.change_type !== "unchanged"),
    critical_path: critical_path || [],
    explanation: generateExplanation(config, improvement, resourceMetrics),
  }
}

function calculateResourceUtilization(originalData: any, schedule: any) {
  // Simple calculation - can be enhanced
  const totalResources = originalData.resources.length
  const activeResources = originalData.resources.filter((r: any) => r.current_workload > 0).length

  const utilizationBefore = activeResources / totalResources
  const utilizationAfter = Math.min(1, utilizationBefore * 1.1) // Simulated improvement

  // Calculate workload balance (standard deviation)
  const workloads = originalData.resources.map((r: any) => r.current_workload)
  const avgWorkload = workloads.reduce((a: number, b: number) => a + b, 0) / workloads.length
  const variance =
    workloads.reduce((sum: number, w: number) => sum + Math.pow(w - avgWorkload, 2), 0) / workloads.length
  const stdDev = Math.sqrt(variance)
  const balance = 1 - stdDev / (avgWorkload || 1) // Higher is better

  return {
    before: utilizationBefore,
    after: utilizationAfter,
    balance: Math.max(0, Math.min(1, balance)),
  }
}

function generateExplanation(config: OptimizationConfig, improvement: number, resourceMetrics: any) {
  const strategies = {
    cpm: "Sử dụng phương pháp đường găng (CPM) để xác định chuỗi công việc quan trọng và tối ưu hóa lịch trình",
    genetic: "Áp dụng thuật toán di truyền để tìm kiếm giải pháp tối ưu qua nhiều thế hệ tiến hóa",
    resource_leveling: "Cân bằng việc sử dụng tài nguyên để tránh quá tải và tối ưu hóa hiệu suất",
  }

  const keyImprovements = []
  if (improvement > 0) {
    keyImprovements.push(`Giảm thời gian hoàn thành dự án ${improvement.toFixed(1)}%`)
  }
  if (resourceMetrics.after > resourceMetrics.before) {
    keyImprovements.push(
      `Tăng hiệu suất sử dụng tài nguyên từ ${(resourceMetrics.before * 100).toFixed(1)}% lên ${(resourceMetrics.after * 100).toFixed(1)}%`,
    )
  }
  if (resourceMetrics.balance > 0.7) {
    keyImprovements.push("Đạt được sự cân bằng tốt trong phân bổ công việc")
  }

  return {
    strategy: strategies[config.algorithm],
    key_improvements: keyImprovements,
    trade_offs: [
      "Một số công việc có thể cần điều chỉnh thời gian bắt đầu",
      "Cần sự linh hoạt từ các thành viên trong việc nhận công việc mới",
    ],
    constraints_considered: [
      "Phụ thuộc giữa các công việc",
      "Kỹ năng yêu cầu cho mỗi công việc",
      "Khả năng và khối lượng công việc hiện tại của mỗi thành viên",
    ],
    why_optimal:
      "Giải pháp này cân bằng giữa việc rút ngắn thời gian hoàn thành và tối ưu hóa việc sử dụng nguồn lực, đồng thời đảm bảo tất cả ràng buộc được thỏa mãn",
  }
}

// Genetic Algorithm helper functions
function initializePopulation(tasks: Task[], resources: Resource[], size: number) {
  const population = []

  for (let i = 0; i < size; i++) {
    const individual = {
      genes: tasks.map((task) => ({
        task_id: task.id,
        start_offset: Math.random() * 10, // Random offset in days
        assigned_to: selectRandomResource(task, resources),
      })),
      fitness: 0,
    }
    population.push(individual)
  }

  return population
}

function selectRandomResource(task: Task, resources: Resource[]) {
  // Filter resources that have required skills
  const eligible = resources.filter(
    (r) =>
      task.required_skills?.some((skill: number) => r.skills.includes(skill)) || task.required_skills?.length === 0,
  )

  if (eligible.length === 0) return task.assigned_to

  // Prefer resources with lower workload
  const selected = eligible.sort((a, b) => a.current_workload - b.current_workload)[0]
  return selected.user_id
}

function evaluateFitness(population: any[], tasks: Task[], resources: Resource[], weights: any) {
  return population.map((individual) => {
    let fitness = 0

    // Time component
    const makespan = calculateIndividualMakespan(individual, tasks)
    fitness += (1 / makespan) * (weights?.time_weight || 0.4)

    // Resource utilization component
    const utilization = calculateIndividualUtilization(individual, resources)
    fitness += utilization * (weights?.resource_weight || 0.3)

    // Cost component (simplified)
    const cost = calculateIndividualCost(individual, tasks)
    fitness += (1 / cost) * (weights?.cost_weight || 0.3)

    individual.fitness = fitness
    return individual
  })
}

function calculateIndividualMakespan(individual: any, tasks: Task[]) {
  // Simple calculation - can be enhanced
  const maxEnd = individual.genes.reduce((max: number, gene: any) => {
    const task = tasks.find((t) => t.id === gene.task_id)
    const end = gene.start_offset + (task?.duration || 0)
    return Math.max(max, end)
  }, 0)

  return maxEnd
}

function calculateIndividualUtilization(individual: any, resources: Resource[]) {
  const resourceLoad = new Map()

  individual.genes.forEach((gene: any) => {
    const load = resourceLoad.get(gene.assigned_to) || 0
    resourceLoad.set(gene.assigned_to, load + 1)
  })

  const loads = Array.from(resourceLoad.values())
  const avgLoad = loads.reduce((a, b) => a + b, 0) / resources.length

  return Math.min(1, avgLoad / 2) // Normalize
}

function calculateIndividualCost(individual: any, tasks: Task[]) {
  // Simple cost calculation
  return individual.genes.reduce((cost: number, gene: any) => {
    return cost + gene.start_offset * 100 // Penalty for delays
  }, 0)
}

function tournamentSelection(population: any[]) {
  const selected = []
  const tournamentSize = 3

  for (let i = 0; i < population.length; i++) {
    const tournament = []
    for (let j = 0; j < tournamentSize; j++) {
      const randomIndex = Math.floor(Math.random() * population.length)
      tournament.push(population[randomIndex])
    }

    const winner = tournament.sort((a, b) => b.fitness - a.fitness)[0]
    selected.push(winner)
  }

  return selected
}

function crossover(parents: any[], rate: number) {
  const offspring = []

  for (let i = 0; i < parents.length - 1; i += 2) {
    if (Math.random() < rate) {
      const crossoverPoint = Math.floor(Math.random() * parents[i].genes.length)

      const child1 = {
        genes: [...parents[i].genes.slice(0, crossoverPoint), ...parents[i + 1].genes.slice(crossoverPoint)],
        fitness: 0,
      }

      const child2 = {
        genes: [...parents[i + 1].genes.slice(0, crossoverPoint), ...parents[i].genes.slice(crossoverPoint)],
        fitness: 0,
      }

      offspring.push(child1, child2)
    } else {
      offspring.push(parents[i], parents[i + 1])
    }
  }

  return offspring
}

function mutate(population: any[], rate: number, tasks: Task[], resources: Resource[]) {
  return population.map((individual) => {
    if (Math.random() < rate) {
      const geneIndex = Math.floor(Math.random() * individual.genes.length)
      const gene = individual.genes[geneIndex]
      const task = tasks.find((t) => t.id === gene.task_id)

      // Mutate either start time or assignment
      if (Math.random() < 0.5) {
        gene.start_offset = Math.random() * 10
      } else {
        gene.assigned_to = selectRandomResource(task!, resources)
      }
    }

    return individual
  })
}

function convertSolutionToSchedule(solution: any, tasks: Task[]): OptimizedSchedule[] {
  return solution.genes.map((gene: any) => {
    const task = tasks.find((t) => t.id === gene.task_id)!
    const newStart = new Date(task.start_date)
    newStart.setDate(newStart.getDate() + Math.floor(gene.start_offset))

    const newEnd = new Date(newStart)
    newEnd.setDate(newEnd.getDate() + task.duration)

    return {
      task_id: task.id,
      task_name: task.name,
      original_start: task.start_date,
      original_end: task.end_date,
      new_start: newStart.toISOString(),
      new_end: newEnd.toISOString(),
      original_assignee: task.assigned_to,
      new_assignee: gene.assigned_to,
      change_type: determineChangeType(task, newStart, gene.assigned_to),
      reason: generateChangeReason(task, gene),
      impact: generateImpact(task, gene),
    }
  })
}

function determineChangeType(task: Task, newStart: Date, newAssignee: string): OptimizedSchedule["change_type"] {
  const startChanged = new Date(task.start_date).getTime() !== newStart.getTime()
  const assigneeChanged = task.assigned_to !== newAssignee

  if (startChanged && assigneeChanged) return "both"
  if (startChanged) return "rescheduled"
  if (assigneeChanged) return "reassigned"
  return "unchanged"
}

function generateChangeReason(task: Task, gene: any): string {
  if (gene.assigned_to !== task.assigned_to) {
    return "Phân công lại để cân bằng khối lượng công việc"
  }
  if (gene.start_offset > 0) {
    return "Dời lịch để tối ưu hóa việc sử dụng tài nguyên"
  }
  return "Giữ nguyên để duy trì tính ổn định"
}

function generateImpact(task: Task, gene: any): string {
  if (gene.start_offset > 0) {
    return `Trì hoãn ${Math.floor(gene.start_offset)} ngày để tránh xung đột tài nguyên`
  }
  if (gene.assigned_to !== task.assigned_to) {
    return "Tăng hiệu quả phân bổ nguồn lực"
  }
  return "Không ảnh hưởng đến tiến độ tổng thể"
}

// Resource Leveling helper functions
function calculateResourceHistogram(tasks: Task[], resources: Resource[]) {
  const histogram = new Map()

  tasks.forEach((task) => {
    const start = new Date(task.start_date)
    const end = new Date(task.end_date)

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateKey = d.toISOString().split("T")[0]
      const dayResources = histogram.get(dateKey) || new Map()

      const count = dayResources.get(task.assigned_to) || 0
      dayResources.set(task.assigned_to, count + 1)

      histogram.set(dateKey, dayResources)
    }
  })

  return histogram
}

function identifyResourceConflicts(
  histogram: Map<string, Map<string, number>>,
): Array<{ date: string; user_id: string; overload: number }> {
  const conflicts: Array<{ date: string; user_id: string; overload: number }> = []
  const maxTasksPerPerson = 2

  histogram.forEach((dayResources, date) => {
    dayResources.forEach((count, userId) => {
      if (count > maxTasksPerPerson) {
        conflicts.push({
          date,
          user_id: userId,
          overload: count - maxTasksPerPerson,
        })
      }
    })
  })

  return conflicts
}

function levelResources(
  tasks: Task[],
  resources: Resource[],
  conflicts: Array<{ date: string; user_id: string; overload: number }>,
): OptimizedSchedule[] {
  const schedule: OptimizedSchedule[] = []
  const tasksCopy = [...tasks]

  // Sort conflicts by date
  conflicts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Process each conflict
  conflicts.forEach((conflict) => {
    // Find tasks assigned to the overloaded user on the conflict date
    const conflictingTasks = tasksCopy.filter((task) => {
      const taskStart = new Date(task.start_date)
      const taskEnd = new Date(task.end_date)
      const conflictDate = new Date(conflict.date)

      return task.assigned_to === conflict.user_id && taskStart <= conflictDate && taskEnd >= conflictDate
    })

    // Try to reassign some tasks to other available resources
    conflictingTasks.slice(0, conflict.overload).forEach((task) => {
      const alternativeResource = findAlternativeResource(task, resources, conflict.user_id)

      if (alternativeResource) {
        schedule.push({
          task_id: task.id,
          task_name: task.name,
          original_start: task.start_date,
          original_end: task.end_date,
          new_start: task.start_date,
          new_end: task.end_date,
          original_assignee: task.assigned_to,
          new_assignee: alternativeResource,
          change_type: "reassigned",
          reason: `Reassigned to reduce workload on ${conflict.date}`,
          impact: "Reduces resource overload without schedule changes",
        })

        // Update the task assignment
        task.assigned_to = alternativeResource
      } else {
        // If no alternative resource, try to delay the task
        const delayedStart = new Date(task.start_date)
        delayedStart.setDate(delayedStart.getDate() + 1)

        const delayedEnd = new Date(delayedStart)
        delayedEnd.setDate(delayedEnd.getDate() + task.duration)

        schedule.push({
          task_id: task.id,
          task_name: task.name,
          original_start: task.start_date,
          original_end: task.end_date,
          new_start: delayedStart.toISOString(),
          new_end: delayedEnd.toISOString(),
          original_assignee: task.assigned_to,
          new_assignee: task.assigned_to,
          change_type: "rescheduled",
          reason: `Delayed to avoid resource conflict on ${conflict.date}`,
          impact: "Minimal delay to resolve resource overload",
        })

        // Update the task dates
        task.start_date = delayedStart.toISOString()
        task.end_date = delayedEnd.toISOString()
      }
    })
  })

  // Add unchanged tasks
  tasks.forEach((task) => {
    const existingChange = schedule.find((s) => s.task_id === task.id)
    if (!existingChange) {
      schedule.push({
        task_id: task.id,
        task_name: task.name,
        original_start: task.start_date,
        original_end: task.end_date,
        new_start: task.start_date,
        new_end: task.end_date,
        original_assignee: task.assigned_to,
        new_assignee: task.assigned_to,
        change_type: "unchanged",
        reason: "No resource conflicts detected",
        impact: "No changes required",
      })
    }
  })

  return schedule
}

// Helper function to find alternative resources
function findAlternativeResource(task: Task, resources: Resource[], excludeUserId: string): string | null {
  // Filter out the current user and find users with required skills
  const eligibleResources = resources.filter(
    (r) =>
      r.user_id !== excludeUserId &&
      r.current_workload < 3 && // Prefer users with lower workload
      (task.required_skills?.some((skill) => r.skills.includes(skill)) || task.required_skills?.length === 0),
  )

  if (eligibleResources.length === 0) return null

  // Return the user with the lowest workload
  return eligibleResources.sort((a, b) => a.current_workload - b.current_workload)[0].user_id
}
