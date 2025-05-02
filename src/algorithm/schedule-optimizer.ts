import { calculateCriticalPath } from "./critical-path"
import { balanceResources } from "./resource-balancer"
import { geneticOptimizer } from "./genetic-optimizer"

interface OptimizeScheduleParams {
  project: any
  tasks: any[]
  users: any[]
  algorithm: string
  objective: string
}

export function optimizeSchedule({
  project,
  tasks,
  users,
  algorithm = "cpm",
  objective = "time",
}: OptimizeScheduleParams) {
  // Bước 1: Tính toán đường găng (Critical Path)
  const criticalPathResult = calculateCriticalPath(tasks)

  // Bước 2: Tùy thuộc vào thuật toán được chọn
  let optimizedSchedule

  switch (algorithm) {
    case "cpm":
      // Chỉ sử dụng kết quả từ CPM
      optimizedSchedule = criticalPathResult
      break

    case "resource-leveling":
      // Cân bằng tài nguyên sau khi có CPM
      optimizedSchedule = balanceResources(criticalPathResult, users)
      break

    case "genetic":
      // Sử dụng thuật toán di truyền để tối ưu hóa đa mục tiêu
      optimizedSchedule = geneticOptimizer({
        initialSchedule: criticalPathResult,
        tasks,
        users,
        objective,
        projectStart: new Date(project.start_date),
        projectEnd: new Date(project.end_date),
      })
      break

    default:
      optimizedSchedule = criticalPathResult
  }

  return {
    project,
    tasks: optimizedSchedule.tasks,
    criticalPath: optimizedSchedule.criticalPath,
    makespan: optimizedSchedule.makespan,
    resourceUtilization: optimizedSchedule.resourceUtilization,
    workloadBalance: optimizedSchedule.workloadBalance,
  }
}
