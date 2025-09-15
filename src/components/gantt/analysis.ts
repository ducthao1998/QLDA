import { Task } from "./types"

export const analyzeTaskIssues = (tasks: Task[], dependencies: any[]) => {
  const analysis: Record<string, any> = {}
  const dependencyMap = new Map<string, string[]>()
  const reverseDependencyMap = new Map<string, string[]>()

  dependencies.forEach((dep: any) => {
    if (!dependencyMap.has(dep.task_id)) dependencyMap.set(dep.task_id, [])
    dependencyMap.get(dep.task_id)!.push(dep.depends_on_id)
    if (!reverseDependencyMap.has(dep.depends_on_id)) reverseDependencyMap.set(dep.depends_on_id, [])
    reverseDependencyMap.get(dep.depends_on_id)!.push(dep.task_id)
  })

  tasks.forEach((task) => {
    const issues: any[] = []

    if (task.is_overdue) issues.push(analyzeOverdueTask(task, tasks, dependencies))
    if (task.is_critical_path) issues.push(analyzeCriticalTask(task, tasks, dependencies))

    const dependencyIssues = analyzeDependencyIssues(task, tasks, dependencyMap)
    issues.push(...dependencyIssues)

    if (issues.length > 0) {
      const realIssues = issues.filter((issue) => issue.hasRealProblem !== false)
      if (realIssues.length > 0) {
        analysis[task.id] = {
          taskId: task.id,
          taskName: task.name,
          issues: realIssues,
          severity: calculateSeverity(realIssues),
          impact: calculateDetailedImpact(task, reverseDependencyMap, tasks),
          currentStatus: getTaskCurrentStatus(task),
          nextActions: generateNextActions(task, realIssues, tasks, dependencies),
        }
      }
    }
  })

  return analysis
}

export const analyzeOverdueTask = (task: Task, allTasks: Task[], dependencies: any[]) => {
  const today = new Date()
  const endDate = task.calculated_end_date ? new Date(task.calculated_end_date) : new Date()
  const daysOverdue = Math.ceil((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24))
  const hasRealProblem = daysOverdue > 1
  return {
    type: "overdue",
    severity: daysOverdue > 7 ? "critical" : daysOverdue > 3 ? "high" : "medium",
    title: `Task bị trễ ${daysOverdue} ngày`,
    description: `Dự kiến hoàn thành: ${endDate.toLocaleDateString("vi-VN")} | Thực tế: ${today.toLocaleDateString("vi-VN")}`,
    rootCause: determineOverdueRootCause(task, allTasks, dependencies),
    affectedTasks: findAffectedTasks(task.id, dependencies),
    recommendations: generateOverdueRecommendations(daysOverdue),
    hasRealProblem,
    daysOverdue,
  }
}

export const analyzeCriticalTask = (task: Task, _allTasks: Task[], dependencies: any[]) => {
  return {
    type: "critical",
    severity: "critical",
    title: "Task thuộc Critical Path",
    description:
      "Task này nằm trên đường găng - bất kỳ sự chậm trễ nào sẽ ảnh hưởng đến toàn bộ dự án",
    rootCause: "Task có thời gian dài nhất trong chuỗi dependency",
    affectedTasks: findAffectedTasks(task.id, dependencies),
    recommendations: [
      "Ưu tiên cao nhất cho task này",
      "Tăng cường tài nguyên nếu cần thiết",
      "Theo dõi tiến độ hàng ngày",
      "Có kế hoạch dự phòng",
    ],
  }
}

export const analyzeDependencyIssues = (
  task: Task,
  allTasks: Task[],
  dependencyMap: Map<string, string[]>,
) => {
  const issues: any[] = []
  const taskDependencies = dependencyMap.get(task.id) || []
  taskDependencies.forEach((depId) => {
    const depTask = allTasks.find((t) => t.id === depId)
    if (depTask && (depTask.is_overdue || depTask.status !== "done")) {
      issues.push({
        type: "dependency",
        severity: depTask.is_overdue ? "high" : "medium",
        title: `Phụ thuộc vào task bị trễ: ${depTask.name}`,
        description: "Task này không thể bắt đầu vì task phụ thuộc chưa hoàn thành",
        rootCause: `Task "${depTask.name}" ${depTask.is_overdue ? "bị trễ hạn" : "chưa hoàn thành"}`,
        affectedTasks: [task.id],
        recommendations: [
          "Đẩy nhanh tiến độ task phụ thuộc",
          "Xem xét thay đổi thứ tự thực hiện nếu có thể",
          "Phân bổ thêm tài nguyên cho task phụ thuộc",
        ],
      })
    }
  })
  return issues
}

export const determineOverdueRootCause = (task: Task, allTasks: Task[], dependencies: any[]) => {
  const taskDependencies = dependencies.filter((dep: any) => dep.task_id === task.id)
  if (taskDependencies.length > 0) {
    const delayedDeps = taskDependencies.filter((dep: any) => {
      const depTask = allTasks.find((t) => t.id === dep.depends_on_id)
      return depTask && depTask.is_overdue
    })
    if (delayedDeps.length > 0) {
      const depTask = allTasks.find((t) => t.id === delayedDeps[0].depends_on_id)
      return `Task phụ thuộc "${depTask?.name}" bị trễ, kéo theo task này trễ`
    }
  }
  return "Thời gian ước tính ban đầu không chính xác hoặc thiếu tài nguyên"
}

export const findAffectedTasks = (taskId: string, dependencies: any[]) => {
  const affected: string[] = []
  const queue = [taskId]
  const visited = new Set<string>()
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    const dependentTasks = dependencies.filter((dep: any) => dep.depends_on_id === current)
    dependentTasks.forEach((dep: any) => {
      affected.push(dep.task_id)
      queue.push(dep.task_id)
    })
  }
  return affected
}

export const generateOverdueRecommendations = (daysOverdue: number) => {
  const recommendations: string[] = []
  if (daysOverdue > 7) recommendations.push("Cần can thiệp khẩn cấp - task đã trễ quá 1 tuần")
  recommendations.push("Tăng cường tài nguyên cho task này")
  recommendations.push("Làm việc thêm giờ nếu cần thiết")
  recommendations.push("Xem xét chia nhỏ task thành các phần nhỏ hơn")
  return recommendations
}

export const calculateSeverity = (issues: any[]) => {
  if (issues.some((issue) => issue.severity === "critical")) return "critical"
  if (issues.some((issue) => issue.severity === "high")) return "high"
  if (issues.some((issue) => issue.severity === "medium")) return "medium"
  return "low"
}

export const calculateDetailedImpact = (
  task: Task,
  reverseDependencyMap: Map<string, string[]>,
  allTasks: Task[],
) => {
  const affectedTaskIds = reverseDependencyMap.get(task.id) || []
  const affectedTasks = affectedTaskIds
    .map((id) => allTasks.find((t) => t.id === id))
    .filter(Boolean) as Task[]
  const criticalAffected = affectedTasks.filter((t) => t.is_critical_path).length
  const overdueAffected = affectedTasks.filter((t) => t.is_overdue).length
  return {
    directImpact: affectedTaskIds.length,
    totalImpact: affectedTaskIds.length + 1,
    affectedTaskIds,
    criticalAffected,
    overdueAffected,
    impactDescription: generateImpactDescription(
      affectedTaskIds.length,
      criticalAffected,
      overdueAffected,
    ),
  }
}

export const generateImpactDescription = (
  totalAffected: number,
  criticalAffected: number,
  overdueAffected: number,
) => {
  if (criticalAffected > 0) return `Ảnh hưởng đến ${criticalAffected} task Critical Path - có thể làm trễ toàn bộ dự án`
  if (overdueAffected > 0) return `Làm trễ thêm ${overdueAffected} task đã bị trễ`
  if (totalAffected > 0) return `Có thể làm trễ ${totalAffected} task khác`
  return "Không ảnh hưởng đến task khác"
}

export const getTaskCurrentStatus = (task: Task) => {
  const today = new Date()
  const startDate = task.calculated_start_date ? new Date(task.calculated_start_date) : new Date()
  const endDate = task.calculated_end_date ? new Date(task.calculated_end_date) : new Date()
  if (task.status === "done") return { status: "completed", description: "Task đã hoàn thành", color: "green" }
  if (task.is_overdue) {
    const daysOverdue = Math.ceil((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24))
    return { status: "overdue", description: `Đã trễ ${daysOverdue} ngày`, color: "red" }
  }
  if (today < startDate) return { status: "not_started", description: "Chưa đến thời gian bắt đầu", color: "gray" }
  if (today >= startDate && today <= endDate) {
    const progress = task.progress || 0
    return { status: "in_progress", description: `Đang thực hiện (${progress}%)`, color: "blue" }
  }
  return { status: "unknown", description: "Trạng thái không xác định", color: "gray" }
}

export const generateNextActions = (
  task: Task,
  _issues: any[],
  allTasks: Task[],
  dependencies: any[],
) => {
  const actions: any[] = []
  const taskDependencies = dependencies.filter((dep: any) => dep.task_id === task.id)
  const blockingTasks = taskDependencies
    .map((dep: any) => allTasks.find((t) => t.id === dep.depends_on_id))
    .filter((t) => t && t.status !== "done")

  if (blockingTasks.length > 0) {
    actions.push({
      priority: "high",
      action: "Giải quyết task phụ thuộc",
      description: `Cần hoàn thành ${blockingTasks.length} task trước: ${blockingTasks
        .map((t) => t?.name)
        .join(", ")}`,
      deadline: "Ngay lập tức",
    })
  }

  if (task.is_critical_path) {
    actions.push({
      priority: "critical",
      action: "Ưu tiên cao nhất",
      description:
        "Task này thuộc Critical Path - bất kỳ sự chậm trễ nào sẽ ảnh hưởng toàn dự án",
      deadline: "Hôm nay",
    })
  }

  if (task.is_overdue) {
    const today = new Date()
    const endDate = task.calculated_end_date ? new Date(task.calculated_end_date) : new Date()
    const daysOverdue = Math.ceil((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24))
    actions.push({
      priority: "high",
      action: "Khẩn cấp hoàn thành",
      description: `Task đã trễ ${daysOverdue} ngày - cần tăng cường tài nguyên`,
      deadline: "Trong 24h",
    })
  }

  if (task.status === "in_progress") {
    actions.push({
      priority: "medium",
      action: "Theo dõi tiến độ hàng ngày",
      description: "Cập nhật progress và báo cáo vấn đề nếu có",
      deadline: "Hàng ngày",
    })
  }

  return actions
}


