interface Task {
    id: number | string
    earlyStart: number
    earlyFinish: number
    lateStart: number
    lateFinish: number
    slack: number
    isCritical: boolean
    assigned_to?: string
    optimized_start: string
    optimized_end: string
    [key: string]: any
  }
  
  interface User {
    id: string
    capacity_hrs: number
    [key: string]: any
  }
  
  interface ResourceBalanceResult {
    tasks: Task[]
    criticalPath: (number | string)[]
    makespan: number
    resourceUtilization: number
    workloadBalance: number
  }
  
  export function balanceResources(criticalPathResult: any, users: User[]): ResourceBalanceResult {
    const { tasks, criticalPath, makespan } = criticalPathResult
  
    // Tạo bản sao của các công việc để không ảnh hưởng đến dữ liệu gốc
    const tasksCopy = [...tasks]
  
    // Sắp xếp các công việc theo thứ tự ưu tiên:
    // 1. Công việc trên đường găng
    // 2. Công việc có slack thấp
    // 3. Công việc có early start sớm
    tasksCopy.sort((a, b) => {
      if (a.isCritical && !b.isCritical) return -1
      if (!a.isCritical && b.isCritical) return 1
      if (a.slack !== b.slack) return a.slack - b.slack
      return a.earlyStart - b.earlyStart
    })
  
    // Tạo lịch làm việc cho mỗi người dùng
    const userSchedules: Record<string, { busy: [number, number][] }> = {}
    users.forEach((user) => {
      userSchedules[user.id] = { busy: [] }
    })
  
    // Hàm kiểm tra xem người dùng có rảnh trong khoảng thời gian không
    const isUserAvailable = (userId: string, start: number, end: number) => {
      if (!userSchedules[userId]) return false
  
      for (const [busyStart, busyEnd] of userSchedules[userId].busy) {
        // Kiểm tra xem có giao nhau không
        if (!(end <= busyStart || start >= busyEnd)) {
          return false
        }
      }
  
      return true
    }
  
    // Hàm thêm lịch bận cho người dùng
    const addUserBusyTime = (userId: string, start: number, end: number) => {
      if (!userSchedules[userId]) return
  
      userSchedules[userId].busy.push([start, end])
      // Sắp xếp lại lịch bận theo thời gian bắt đầu
      userSchedules[userId].busy.sort((a, b) => a[0] - b[0])
    }
  
    // Hàm tìm người dùng phù hợp nhất cho công việc
    const findBestUserForTask = (task: Task) => {
      // Nếu công việc đã được gán, kiểm tra xem người đó có rảnh không
      if (task.assigned_to && isUserAvailable(task.assigned_to, task.earlyStart, task.earlyFinish)) {
        return task.assigned_to
      }
  
      // Tìm người dùng rảnh và có workload thấp nhất
      const availableUsers = users.filter((user) => isUserAvailable(user.id, task.earlyStart, task.earlyFinish))
  
      if (availableUsers.length === 0) {
        // Không có ai rảnh, tìm người có thể làm muộn nhất trong phạm vi slack
        if (task.slack > 0) {
          for (let delay = 1; delay <= task.slack; delay++) {
            const delayedStart = task.earlyStart + delay
            const delayedEnd = task.earlyFinish + delay
  
            for (const user of users) {
              if (isUserAvailable(user.id, delayedStart, delayedEnd)) {
                // Cập nhật thời gian bắt đầu và kết thúc
                task.earlyStart = delayedStart
                task.earlyFinish = delayedEnd
                return user.id
              }
            }
          }
        }
  
        // Vẫn không tìm được ai, trả về người được gán ban đầu hoặc người đầu tiên
        return task.assigned_to || users[0]?.id
      }
  
      // Tính toán workload hiện tại của mỗi người
      const userWorkloads = availableUsers.map((user) => {
        const busyHours = userSchedules[user.id].busy.reduce((total, [start, end]) => total + (end - start), 0)
        return {
          userId: user.id,
          workload: busyHours / (makespan * user.capacity_hrs),
        }
      })
  
      // Sắp xếp theo workload tăng dần
      userWorkloads.sort((a, b) => a.workload - b.workload)
  
      // Trả về người có workload thấp nhất
      return userWorkloads[0]?.userId || task.assigned_to || users[0]?.id
    }
  
    // Phân công lại công việc để cân bằng tài nguyên
    tasksCopy.forEach((task) => {
      const bestUserId = findBestUserForTask(task)
      task.assigned_to = bestUserId
  
      // Cập nhật lịch bận cho người dùng
      addUserBusyTime(bestUserId, task.earlyStart, task.earlyFinish)
  
      // Cập nhật ngày bắt đầu và kết thúc tối ưu
      const projectStart = new Date(
        Math.min(...tasksCopy.filter((t) => t.optimized_start).map((t) => new Date(t.optimized_start).getTime())),
      )
  
      const optimizedStartDate = new Date(projectStart.getTime() + task.earlyStart * 60 * 60 * 1000)
      const optimizedEndDate = new Date(projectStart.getTime() + task.earlyFinish * 60 * 60 * 1000)
  
      task.optimized_start = optimizedStartDate.toISOString()
      task.optimized_end = optimizedEndDate.toISOString()
    })
  
    // Tính toán các chỉ số hiệu suất
    // 1. Tỷ lệ sử dụng tài nguyên
    const totalCapacity = users.reduce((sum, user) => sum + user.capacity_hrs * makespan, 0)
    const totalUsed = Object.values(userSchedules).reduce(
      (sum, schedule) => sum + schedule.busy.reduce((total, [start, end]) => total + (end - start), 0),
      0,
    )
  
    const resourceUtilization = totalUsed / totalCapacity
  
    // 2. Độ cân bằng workload
    const userWorkloads = users.map((user) => {
      const busyHours = userSchedules[user.id]?.busy.reduce((total, [start, end]) => total + (end - start), 0) || 0
      return busyHours / (makespan * user.capacity_hrs)
    })
  
    const avgWorkload = userWorkloads.reduce((sum, wl) => sum + wl, 0) / userWorkloads.length
    const workloadVariance =
      userWorkloads.reduce((sum, wl) => sum + Math.pow(wl - avgWorkload, 2), 0) / userWorkloads.length
    const workloadBalance = 1 - Math.sqrt(workloadVariance) // 1 là hoàn toàn cân bằng, 0 là hoàn toàn mất cân bằng
  
    return {
      tasks: tasksCopy,
      criticalPath,
      makespan,
      resourceUtilization,
      workloadBalance,
    }
  }
  