export interface Task {
  id: number | string
  name: string
  start_date: string
  end_date: string
  dependencies: (number | string)[] | { id: string; progress_percentage: number; status: string }[]
  assigned_to?: string
  optimized_start?: string
  optimized_end?: string
  [key: string]: any
}

interface CriticalPathResult {
  tasks: Task[]
  criticalPath: (number | string)[]
  makespan: number
}

export function calculateCriticalPath(tasks: Task[]): CriticalPathResult {
  // Tạo bản sao của các công việc để không ảnh hưởng đến dữ liệu gốc
  const tasksCopy = tasks.map((task) => ({
    ...task,
    // Tính toán thời lượng dựa trên start_date và end_date
    duration:
      task.start_date && task.end_date
        ? Math.ceil((new Date(task.end_date).getTime() - new Date(task.start_date).getTime()) / (1000 * 60 * 60))
        : 0,
    // Khởi tạo các giá trị cho thuật toán CPM
    earlyStart: 0,
    earlyFinish: 0,
    lateStart: 0,
    lateFinish: 0,
    slack: 0,
    isCritical: false,
  }))

  // Tạo đồ thị phụ thuộc
  const graph: Record<string, string[]> = {}
  const reverseGraph: Record<string, string[]> = {}

  tasksCopy.forEach((task) => {
    const taskId = String(task.id)
    graph[taskId] = []
    reverseGraph[taskId] = []
  })

  tasksCopy.forEach((task) => {
    const taskId = String(task.id)
    task.dependencies.forEach((dep) => {
      // Xử lý cả dependencies cũ (string/number) và mới (object với progress)
      const depId = typeof dep === 'object' ? dep.id : String(dep)
      graph[depId].push(taskId)
      reverseGraph[taskId].push(depId)
    })
  })

  // Tìm các công việc không có phụ thuộc (công việc bắt đầu)
  const startTasks = tasksCopy.filter((task) => task.dependencies.length === 0).map((task) => String(task.id))

  // Tính toán Early Start và Early Finish
  const calculateEarly = () => {
    // Khởi tạo mảng công việc đã xử lý
    const processed: Record<string, boolean> = {}
    startTasks.forEach((taskId) => {
      processed[taskId] = true
      const task = tasksCopy.find((t) => String(t.id) === taskId)!
      task.earlyStart = 0
      task.earlyFinish = task.duration
    })

    // Xử lý các công việc theo thứ tự topo
    const queue = [...startTasks]
    while (queue.length > 0) {
      const currentId = queue.shift()!

      // Xử lý các công việc kế tiếp
      graph[currentId].forEach((nextId) => {
        const nextTask = tasksCopy.find((t) => String(t.id) === nextId)!
        const currentTask = tasksCopy.find((t) => String(t.id) === currentId)!

        // Tính toán thời gian hoàn thành của dependency dựa trên progress
        let dependencyFinishTime = currentTask.earlyFinish
        
        // Tìm dependency object để lấy progress percentage
        const dependencyInfo = nextTask.dependencies.find(dep => {
          const depId = typeof dep === 'object' ? dep.id : String(dep)
          return depId === currentId
        })
        
        if (typeof dependencyInfo === 'object' && dependencyInfo.progress_percentage < 100) {
          // Nếu dependency chưa hoàn thành 100%, điều chỉnh thời gian
          const progressFactor = dependencyInfo.progress_percentage / 100
          const remainingTime = currentTask.duration * (1 - progressFactor)
          dependencyFinishTime = currentTask.earlyStart + currentTask.duration * progressFactor + remainingTime
        }

        // Cập nhật Early Start và Early Finish
        nextTask.earlyStart = Math.max(nextTask.earlyStart, dependencyFinishTime)
        nextTask.earlyFinish = nextTask.earlyStart + nextTask.duration

        // Kiểm tra xem tất cả các phụ thuộc đã được xử lý chưa
        const allDependenciesProcessed = reverseGraph[nextId].every((depId) => processed[depId])

        if (allDependenciesProcessed && !processed[nextId]) {
          processed[nextId] = true
          queue.push(nextId)
        }
      })
    }
  }

  // Tính toán Late Start và Late Finish
  const calculateLate = () => {
    // Tìm các công việc không có công việc kế tiếp (công việc kết thúc)
    const endTasks = tasksCopy
      .filter((task) => {
        const taskId = String(task.id)
        return graph[taskId].length === 0
      })
      .map((task) => String(task.id))

    // Tìm thời gian hoàn thành dự án (makespan)
    const makespan = Math.max(...tasksCopy.map((task) => task.earlyFinish))

    // Khởi tạo Late Finish cho các công việc kết thúc
    endTasks.forEach((taskId) => {
      const task = tasksCopy.find((t) => String(t.id) === taskId)!
      task.lateFinish = makespan
      task.lateStart = task.lateFinish - task.duration
    })

    // Xử lý các công việc theo thứ tự ngược
    const processed: Record<string, boolean> = {}
    endTasks.forEach((taskId) => {
      processed[taskId] = true
    })

    const queue = [...endTasks]
    while (queue.length > 0) {
      const currentId = queue.shift()!

      // Xử lý các công việc phụ thuộc
      reverseGraph[currentId].forEach((prevId) => {
        const prevTask = tasksCopy.find((t) => String(t.id) === prevId)!
        const currentTask = tasksCopy.find((t) => String(t.id) === currentId)!

        // Cập nhật Late Finish và Late Start
        prevTask.lateFinish = Math.min(
          prevTask.lateFinish === 0 ? Number.POSITIVE_INFINITY : prevTask.lateFinish,
          currentTask.lateStart,
        )
        prevTask.lateStart = prevTask.lateFinish - prevTask.duration

        // Kiểm tra xem tất cả các công việc kế tiếp đã được xử lý chưa
        const allNextTasksProcessed = graph[prevId].every((nextId) => processed[nextId])

        if (allNextTasksProcessed && !processed[prevId]) {
          processed[prevId] = true
          queue.push(prevId)
        }
      })
    }
  }

  // Tính toán Slack và xác định đường găng
  const calculateSlackAndCriticalPath = () => {
    tasksCopy.forEach((task) => {
      task.slack = task.lateStart - task.earlyStart
      task.isCritical = task.slack === 0
    })

    // Xác định đường găng
    const criticalPath = tasksCopy.filter((task) => task.isCritical).map((task) => task.id)

    return criticalPath
  }

  // Thực hiện các bước tính toán
  calculateEarly()
  calculateLate()
  const criticalPath = calculateSlackAndCriticalPath()

  // Cập nhật ngày bắt đầu và kết thúc tối ưu cho các công việc
  const projectStart = new Date(
    Math.min(...tasksCopy.filter((t) => t.start_date).map((t) => new Date(t.start_date).getTime())),
  )

  tasksCopy.forEach((task) => {
    const optimizedStartDate = new Date(projectStart.getTime() + task.earlyStart * 60 * 60 * 1000)
    const optimizedEndDate = new Date(projectStart.getTime() + task.earlyFinish * 60 * 60 * 1000)

    task.optimized_start = optimizedStartDate.toISOString()
    task.optimized_end = optimizedEndDate.toISOString()
  })

  // Tính toán makespan (thời gian hoàn thành dự án)
  const makespan = Math.max(...tasksCopy.map((task) => task.earlyFinish))

  return {
    tasks: tasksCopy,
    criticalPath,
    makespan,
  }
}
