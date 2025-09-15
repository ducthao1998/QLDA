import { Task } from "./types"

export const sortTasksByDependencies = (tasks: Task[], dependencies: any[]): Task[] => {
  if (!dependencies || dependencies.length === 0) {
    return tasks.map((task) => ({ ...task, level: 0, has_dependencies: false }))
  }

  const taskMap = new Map<string, Task>()
  const dependencyMap = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  const hasDependencies = new Map<string, boolean>()

  tasks.forEach((task) => {
    taskMap.set(task.id, task)
    const deps = dependencies.filter((dep: any) => dep.task_id === task.id).map((dep: any) => dep.depends_on_id)
    dependencyMap.set(task.id, deps)
    inDegree.set(task.id, deps.length)
    hasDependencies.set(task.id, deps.length > 0)
  })

  const sortedTasks: Task[] = []
  const queue: string[] = []
  let level = 0

  tasks.forEach((task) => {
    if ((inDegree.get(task.id) || 0) === 0) {
      queue.push(task.id)
    }
  })

  while (queue.length > 0) {
    const currentLevelTasks = [...queue]
    queue.length = 0

    currentLevelTasks.forEach((taskId) => {
      const currentTask = taskMap.get(taskId)!
      sortedTasks.push({
        ...currentTask,
        level,
        has_dependencies: hasDependencies.get(taskId) || false,
      })
    })

    currentLevelTasks.forEach((taskId) => {
      tasks.forEach((task) => {
        const deps = dependencyMap.get(task.id) || []
        if (deps.includes(taskId)) {
          const newInDegree = (inDegree.get(task.id) || 0) - 1
          inDegree.set(task.id, newInDegree)
          if (newInDegree === 0) {
            queue.push(task.id)
          }
        }
      })
    })
    level++
  }

  const remainingTasks = tasks.filter((task) => !sortedTasks.find((t) => t.id === task.id))
  remainingTasks.forEach((task) =>
    sortedTasks.push({ ...task, level, has_dependencies: hasDependencies.get(task.id) || false }),
  )

  return sortedTasks
}

export const calculateTaskDates = (tasks: Task[], dependencies: any[], projectStartDate: Date): Task[] => {
  const taskMap = new Map<string, Task>()
  const dependencyMap = new Map<string, string[]>()
  const taskEndDates = new Map<string, Date>()

  tasks.forEach((task) => {
    taskMap.set(task.id, { ...task, calculated_start_date: "", calculated_end_date: "" })
    const deps = dependencies.filter((dep: any) => dep.task_id === task.id).map((dep: any) => dep.depends_on_id)
    dependencyMap.set(task.id, deps)
  })

  const sortedTasks = sortTasksByDependencies(tasks, dependencies)

  sortedTasks.forEach((task) => {
    const deps = dependencyMap.get(task.id) || []
    let startDate = new Date(projectStartDate)

    if (deps.length > 0) {
      let latestEndDate = new Date(projectStartDate)
      let hasValidDependency = false
      deps.forEach((depId) => {
        const depEndDate = taskEndDates.get(depId)
        if (depEndDate) {
          hasValidDependency = true
          if (depEndDate > latestEndDate) latestEndDate = new Date(depEndDate)
        }
      })
      if (hasValidDependency) {
        latestEndDate.setDate(latestEndDate.getDate() + 1)
        startDate = latestEndDate
      }
    }

    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + (task.duration_days || 1) - 1)

    const updatedTask = taskMap.get(task.id)!
    updatedTask.calculated_start_date = startDate.toISOString()
    updatedTask.calculated_end_date = endDate.toISOString()
    taskMap.set(task.id, updatedTask)
    taskEndDates.set(task.id, endDate)
  })

  return Array.from(taskMap.values())
}

export const daysBetween = (a: Date, b: Date) => Math.max(0, Math.round((+b - +a) / 86400000))
export const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))


