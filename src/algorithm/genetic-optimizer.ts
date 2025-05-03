import { Task } from "./critical-path"

interface GeneticOptimizerParams {
  initialSchedule: any
  tasks: any[]
  users: any[]
  objective: string
  projectStart: Date
  projectEnd: Date
}

export function geneticOptimizer({
  initialSchedule,
  tasks,
  users,
  objective,
  projectStart,
  projectEnd,
}: GeneticOptimizerParams) {
  // Tham số cho thuật toán di truyền
  const POPULATION_SIZE = 20 // Giảm kích thước quần thể
  const MAX_GENERATIONS = 10 // Giảm số thế hệ
  const MUTATION_RATE = 0.1
  const CROSSOVER_RATE = 0.8
  const MAX_TIME_MS = 30000 // Giới hạn thời gian 30 giây

  const startTime = Date.now()

  // Lấy kết quả ban đầu từ CPM
  const { tasks: cpmTasks, criticalPath, makespan: initialMakespan } = initialSchedule

  // Tạo quần thể ban đầu
  const population = initializePopulation(POPULATION_SIZE, cpmTasks, users)

  // Đánh giá quần thể ban đầu
  let evaluatedPopulation = evaluatePopulation(population, objective, users, criticalPath)

  // Lặp qua các thế hệ
  for (let generation = 0; generation < MAX_GENERATIONS; generation++) {
    // Kiểm tra thời gian
    if (Date.now() - startTime > MAX_TIME_MS) {
      console.log("Đạt giới hạn thời gian, dừng tối ưu hóa")
      break
    }

    console.log(`Thế hệ ${generation + 1}/${MAX_GENERATIONS}`)

    // Chọn lọc
    const selectedIndividuals = selection(evaluatedPopulation)

    // Lai ghép
    const offspring = crossover(selectedIndividuals, CROSSOVER_RATE)

    // Đột biến
    const mutatedOffspring = mutation(offspring, MUTATION_RATE, users)

    // Đánh giá thế hệ mới
    evaluatedPopulation = evaluatePopulation(mutatedOffspring, objective, users, criticalPath)

    // Kiểm tra điều kiện dừng
    if (checkTerminationCriteria(evaluatedPopulation, generation, MAX_GENERATIONS)) {
      console.log("Đạt điều kiện dừng sớm")
      break
    }
  }

  // Lấy cá thể tốt nhất
  const bestIndividual = getBestIndividual(evaluatedPopulation)
  console.log("Hoàn thành tối ưu hóa")

  // Cập nhật ngày bắt đầu và kết thúc tối ưu
  const optimizedTasks = updateTaskDates(bestIndividual.schedule, projectStart)

  return {
    tasks: optimizedTasks,
    criticalPath,
    makespan: bestIndividual.makespan,
    resourceUtilization: bestIndividual.resourceUtilization,
    workloadBalance: bestIndividual.workloadBalance,
  }
}

// Hàm khởi tạo quần thể
function initializePopulation(size: number, tasks: any[], users: any[]) {
  const population = []

  // Thêm lịch trình CPM vào quần thể
  population.push([...tasks])

  // Tạo các cá thể ngẫu nhiên khác
  for (let i = 1; i < size; i++) {
    const individual = createRandomSchedule(tasks, users)
    population.push(individual)
  }

  return population
}

// Tạo lịch trình ngẫu nhiên
function createRandomSchedule(tasks: any[], users: any[]) {
  const tasksCopy = [...tasks]

  // Sắp xếp ngẫu nhiên các công việc không nằm trên đường găng
  const criticalTasks = tasksCopy.filter((task) => task.isCritical)
  const nonCriticalTasks = tasksCopy.filter((task) => !task.isCritical)

  // Xáo trộn các công việc không nằm trên đường găng
  shuffleArray(nonCriticalTasks)

  // Phân công ngẫu nhiên người thực hiện
  const allTasks = [...criticalTasks, ...nonCriticalTasks]
  allTasks.forEach((task) => {
    // Chọn ngẫu nhiên một người dùng
    const randomUserIndex = Math.floor(Math.random() * users.length)
    task.assigned_to = users[randomUserIndex].id

    // Nếu không phải công việc trên đường găng, có thể thay đổi thời gian bắt đầu
    if (!task.isCritical && task.slack > 0) {
      const randomDelay = Math.floor(Math.random() * (task.slack + 1))
      task.earlyStart += randomDelay
      task.earlyFinish += randomDelay
    }
  })

  return allTasks
}

// Hàm xáo trộn mảng
function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

// Đánh giá quần thể
function evaluatePopulation(population: any[], objective: string, users: any[], criticalPath: any[]) {
  return population.map((individual) => {
    const fitness = calculateFitness(individual, objective, users, criticalPath)
    return {
      schedule: individual,
      fitness,
      makespan: fitness.makespan,
      resourceUtilization: fitness.resourceUtilization,
      workloadBalance: fitness.workloadBalance,
    }
  })
}

// Tính toán độ thích nghi
function calculateFitness(schedule: any[], objective: string, users: any[], criticalPath: any[]) {
  // Tính toán makespan
  const makespan = Math.max(...schedule.map((task) => task.earlyFinish))

  // Tính toán tỷ lệ sử dụng tài nguyên
  const userSchedules: Record<string, { busy: [number, number][] }> = {}
  users.forEach((user) => {
    userSchedules[user.id] = { busy: [] }
  })

  // Cập nhật lịch bận cho mỗi người dùng
  schedule.forEach((task) => {
    if (task.assigned_to) {
      userSchedules[task.assigned_to].busy.push([task.earlyStart, task.earlyFinish])
    }
  })

  // Tính toán tỷ lệ sử dụng tài nguyên
  const totalCapacity = users.reduce((sum, user) => sum + (user.capacity_hrs || 8) * makespan, 0)
  const totalUsed = Object.values(userSchedules).reduce(
    (sum, schedule) => sum + schedule.busy.reduce((total, [start, end]) => total + (end - start), 0),
    0,
  )

  const resourceUtilization = totalUsed / totalCapacity

  // Tính toán độ cân bằng workload
  const userWorkloads = users.map((user) => {
    const busyHours = userSchedules[user.id]?.busy.reduce((total, [start, end]) => total + (end - start), 0) || 0
    return busyHours / (makespan * (user.capacity_hrs || 8))
  })

  const avgWorkload = userWorkloads.reduce((sum, wl) => sum + wl, 0) / userWorkloads.length
  const workloadVariance =
    userWorkloads.reduce((sum, wl) => sum + Math.pow(wl - avgWorkload, 2), 0) / userWorkloads.length
  const workloadBalance = 1 - Math.sqrt(workloadVariance)

  // Tính toán độ thích nghi tổng hợp dựa trên mục tiêu
  let fitnessValue

  switch (objective) {
    case "time":
      fitnessValue = 1 / makespan
      break
    case "resource":
      fitnessValue = resourceUtilization
      break
    case "balance":
      fitnessValue = workloadBalance
      break
    case "multi":
    default:
      // Mục tiêu đa tiêu chí: kết hợp cả 3 yếu tố
      fitnessValue = (1 / makespan) * 0.5 + resourceUtilization * 0.3 + workloadBalance * 0.2
      break
  }

  return {
    fitnessValue,
    makespan,
    resourceUtilization,
    workloadBalance,
  }
}

// Chọn lọc
function selection(evaluatedPopulation: any[]) {
  // Sắp xếp theo độ thích nghi giảm dần
  evaluatedPopulation.sort((a, b) => b.fitness.fitnessValue - a.fitness.fitnessValue)

  // Chọn 50% cá thể tốt nhất
  const eliteCount = Math.floor(evaluatedPopulation.length * 0.5)
  const elites = evaluatedPopulation.slice(0, eliteCount)

  // Chọn ngẫu nhiên từ phần còn lại bằng phương pháp roulette wheel
  const restPopulation = evaluatedPopulation.slice(eliteCount)
  const selectedRest = rouletteWheelSelection(restPopulation, eliteCount)

  return [...elites, ...selectedRest]
}

// Chọn lọc bằng roulette wheel
function rouletteWheelSelection(population: any[], count: number) {
  const selected = []
  const totalFitness = population.reduce((sum, individual) => sum + individual.fitness.fitnessValue, 0)

  for (let i = 0; i < count; i++) {
    const randomValue = Math.random() * totalFitness
    let cumulativeFitness = 0

    for (const individual of population) {
      cumulativeFitness += individual.fitness.fitnessValue
      if (cumulativeFitness >= randomValue) {
        selected.push(individual)
        break
      }
    }

    // Nếu không chọn được (hiếm khi xảy ra), chọn ngẫu nhiên
    if (selected.length <= i) {
      const randomIndex = Math.floor(Math.random() * population.length)
      selected.push(population[randomIndex])
    }
  }

  return selected
}

// Lai ghép
function crossover(selectedIndividuals: any[], crossoverRate: number) {
  const offspring = []

  // Thêm các cá thể ưu tú vào thế hệ mới
  for (const individual of selectedIndividuals) {
    offspring.push([...individual.schedule])
  }

  // Lai ghép để tạo thêm cá thể mới
  for (let i = 0; i < selectedIndividuals.length / 2; i++) {
    if (Math.random() < crossoverRate) {
      const parent1 = selectedIndividuals[i].schedule
      const parent2 = selectedIndividuals[selectedIndividuals.length - 1 - i].schedule

      // Tạo bản sao của các công việc
      const child1 = parent1.map((task: Task) => ({ ...task }))
      const child2 = parent2.map((task: Task) => ({ ...task }))

      // Chọn điểm cắt ngẫu nhiên
      const cutPoint = Math.floor(Math.random() * parent1.length)

      // Hoán đổi thông tin phân công và thời gian bắt đầu của các công việc không nằm trên đường găng
      for (let i = cutPoint; i < parent1.length; i++) {
        const task1 = child1[i]
        const task2 = child2[i]

        if (!task1.isCritical && !task2.isCritical) {
          // Hoán đổi người được phân công
          ;[task1.assigned_to, task2.assigned_to] = [task2.assigned_to, task1.assigned_to]

          // Hoán đổi thời gian bắt đầu nếu có slack
          if (task1.slack > 0 && task2.slack > 0) {
            const delay1 = task1.earlyStart - (task1.lateStart - task1.slack)
            const delay2 = task2.earlyStart - (task2.lateStart - task2.slack)

            task1.earlyStart = task1.lateStart - task1.slack + delay2
            task1.earlyFinish = task1.earlyStart + task1.duration

            task2.earlyStart = task2.lateStart - task2.slack + delay1
            task2.earlyFinish = task2.earlyStart + task2.duration
          }
        }
      }

      offspring.push(child1, child2)
    }
  }

  return offspring
}

// Đột biến
function mutation(population: any[], mutationRate: number, users: any[]) {
  return population.map((individual) => {
    const mutatedIndividual = individual.map((task: Task) => ({ ...task }))

    // Đột biến từng công việc
    mutatedIndividual.forEach((task: Task) => {
      // Đột biến phân công người thực hiện
      if (Math.random() < mutationRate) {
        const randomUserIndex = Math.floor(Math.random() * users.length)
        task.assigned_to = users[randomUserIndex].id
      }

      // Đột biến thời gian bắt đầu nếu không nằm trên đường găng
      if (!task.isCritical && task.slack > 0 && Math.random() < mutationRate) {
        const randomDelay = Math.floor(Math.random() * (task.slack + 1))
        task.earlyStart = task.lateStart - task.slack + randomDelay
        task.earlyFinish = task.earlyStart + task.duration
      }
    })

    return mutatedIndividual
  })
}

// Kiểm tra điều kiện dừng
function checkTerminationCriteria(evaluatedPopulation: any[], generation: number, MAX_GENERATIONS: number) {
  // Dừng nếu đạt số thế hệ tối đa
  if (generation >= MAX_GENERATIONS - 1) {
    return true
  }

  // Dừng nếu độ thích nghi không cải thiện sau nhiều thế hệ
  // (Có thể triển khai thêm)

  return false
}

// Lấy cá thể tốt nhất
function getBestIndividual(evaluatedPopulation: any[]) {
  return evaluatedPopulation.reduce(
    (best, current) => (current.fitness.fitnessValue > best.fitness.fitnessValue ? current : best),
    evaluatedPopulation[0],
  )
}

// Cập nhật ngày bắt đầu và kết thúc tối ưu
function updateTaskDates(schedule: any[], projectStart: Date) {
  return schedule.map((task) => {
    const optimizedStartDate = new Date(projectStart.getTime() + task.earlyStart * 60 * 60 * 1000)
    const optimizedEndDate = new Date(projectStart.getTime() + task.earlyFinish * 60 * 60 * 1000)

    return {
      ...task,
      optimized_start: optimizedStartDate.toISOString(),
      optimized_end: optimizedEndDate.toISOString(),
    }
  })
}
