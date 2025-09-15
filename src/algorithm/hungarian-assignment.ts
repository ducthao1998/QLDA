import { ExperienceMatrix, getExperienceScore } from './experience-matrix'

export interface AlgoTask {
  id: string
  name: string
  required_skills: number[]
  priority: number
  estimated_hours: number
}

export interface AlgoUser {
  id: string
  name: string
  current_workload: number
  max_concurrent_tasks: number
}

export interface Assignment {
  task_id: string
  user_id: string
  confidence_score: number
  experience_score: number
}

// ===========================
//  Accountable (A) scoring helpers
// ===========================

export interface AccountableMetrics {
  a_count?: number
  a_on_time_rate?: number // 0..1
  a_overdue_count?: number
  a_avg_delay?: number // days (positive worse)
}

export interface AccountableContext {
  // user attributes
  userOrgUnit?: Map<string, string>
  userManagerId?: Map<string, string | null>
  userPositionLevel?: Map<string, number>
  userMetrics?: Map<string, AccountableMetrics>
  // dynamic runtime attributes
  userWorkload?: Map<string, { current: number; max: number }>
  // selection flags
  allowSameRA?: boolean
  minAccountableScore?: number
  minAccountableSkillFit?: number
}

export interface AccountableScoreExplain {
  experience: number
  workload: number
  coverage: number
  specialization: number
  weights: { experience: number; workload: number; coverage: number; specialization: number }
}

export function calculateAccountableScore(
  userId: string,
  task: AlgoTask,
  experienceMatrix: ExperienceMatrix,
  context: AccountableContext
): { score: number; explain: AccountableScoreExplain } {
  const wl = context.userWorkload?.get(userId) ?? { current: 0, max: 1 }
  const user: AlgoUser = {
    id: userId,
    name: userId,
    current_workload: wl.current ?? 0,
    max_concurrent_tasks: Math.max(1, wl.max ?? 1)
  }

  // Recompute components same as calculateUserTaskScore
  const experienceScores = task.required_skills.map(skillId =>
    getExperienceScore(experienceMatrix, user.id, skillId)
  )
  const avgExperience = experienceScores.length > 0
    ? experienceScores.reduce((s, v) => s + v, 0) / experienceScores.length
    : 0
  const experienceBonus = avgExperience > 0.7 ? 0.2 : avgExperience > 0.5 ? 0.1 : 0
  const experience = Math.min(1, avgExperience + experienceBonus)

  const maxWorkload = Math.max(1, user.max_concurrent_tasks)
  const workloadRatio = user.current_workload / maxWorkload
  let workload = 0
  if (workloadRatio === 0)      workload = 1.0
  else if (workloadRatio <= .33) workload = 0.8
  else if (workloadRatio <= .66) workload = 0.5
  else                           workload = 0.2

  const covered = task.required_skills.filter(skillId =>
    getExperienceScore(experienceMatrix, user.id, skillId) > 0
  ).length
  const coverage = task.required_skills.length > 0
    ? covered / task.required_skills.length
    : 1

  const hasHighExpertise = experienceScores.some(s => s > 0.8)
  const specialization = hasHighExpertise ? 1 : 0.5

  const weights = { experience: 0.5, workload: 0.35, coverage: 0.1, specialization: 0.05 }
  let total = (
    experience * weights.experience +
    workload * weights.workload +
    coverage * weights.coverage +
    specialization * weights.specialization
  )

  if (avgExperience === 0 && coverage === 0) {
    total = workload * 0.4 + (user.current_workload === 0 ? 0.1 : 0.05)
    if (total === 0) total = 0.01
  }

  // Strong penalty for zero coverage if task has required skills
  if ((task.required_skills?.length ?? 0) > 0 && coverage === 0) {
    total = Math.max(0, total - 0.3)
  }

  return {
    score: Math.min(1, total),
    explain: { experience, workload, coverage, specialization, weights }
  }
}

export function pickAccountableForTask(
  task: AlgoTask,
  rUserId: string,
  candidateUserIds: string[],
  experienceMatrix: ExperienceMatrix,
  context: AccountableContext
): { userId: string; score: number; explain: AccountableScoreExplain } | null {
  const allowSame = context.allowSameRA ?? false
  const minScore = context.minAccountableScore ?? 0.5
  const minSkillFit = context.minAccountableSkillFit ?? 0.3

  const filtered = candidateUserIds.filter(uid => (allowSame ? true : uid !== rUserId))
  if (filtered.length === 0) return null

  const scored = filtered.map(uid => {
    const res = calculateAccountableScore(uid, task, experienceMatrix, context)
    return { userId: uid, score: res.score, explain: res.explain }
  })

  // Prefer candidates with minimum coverage if task has skills
  const hasSkills = (task.required_skills?.length ?? 0) > 0
  let pool = scored
  if (hasSkills) {
    const covered = scored.filter(s => (s.explain.coverage ?? 0) >= minSkillFit)
    if (covered.length > 0) pool = covered
  }

  const wlMap = context.userWorkload ?? new Map<string, { current: number; max: number }>()
  pool.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    // Tie-breaker: coverage desc, then workload asc, then id asc
    const aCov = a.explain.coverage ?? 0
    const bCov = b.explain.coverage ?? 0
    if (bCov !== aCov) return bCov - aCov
    const aW = wlMap.get(a.userId)?.current ?? 0
    const bW = wlMap.get(b.userId)?.current ?? 0
    if (aW !== bW) return aW - bW
    return String(a.userId).localeCompare(String(b.userId))
  })

  const best = pool[0]
  if (!best || best.score < minScore) return null
  return best
}

function seededRandom(seed: number) {
  // Simple LCG
  let state = seed >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

function hashStringToInt(str: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

export function pickConsultedInformedRandom(
  task: AlgoTask,
  users: { id: string }[],
  rUserId: string,
  aUserId: string | null,
  capacity: Map<string, { current: number; max: number }>,
  countC: number = 1,
  countI: number = 1
): { C: string[]; I: string[] } {
  const exclude = new Set<string>([rUserId])
  if (aUserId) exclude.add(aUserId)

  const canTake = (uid: string) => {
    const wl = capacity.get(uid)
    if (!wl) return true
    return (wl.current ?? 0) < Math.max(1, wl.max ?? 1)
  }

  const pool = users.map(u => u.id).filter(uid => !exclude.has(uid) && canTake(uid))

  // Deterministic seeds per role
  const seedC = hashStringToInt(`${task.id}:C`)
  const seedI = hashStringToInt(`${task.id}:I`)
  const randC = seededRandom(seedC)
  const randI = seededRandom(seedI)

  const pickOne = (rnd: () => number, arr: string[]): string | null => {
    if (arr.length === 0) return null
    const idx = Math.floor(rnd() * arr.length)
    return arr[idx] ?? null
  }

  const picks = (rnd: () => number, arr: string[], k: number) => {
    const selected: string[] = []
    const available = [...arr]
    for (let t = 0; t < k && available.length > 0; t++) {
      const idx = Math.floor(rnd() * available.length)
      const uid = available.splice(idx, 1)[0]
      if (uid) selected.push(uid)
    }
    return selected
  }

  const cUsers = picks(randC, pool, Math.max(0, countC))
  const remaining = pool.filter(uid => !cUsers.includes(uid))
  const iUsers = picks(randI, remaining, Math.max(0, countI))

  return { C: cUsers, I: iUsers }
}

/* ===========================
 *  Hungarian (min-cost) core
 *  Input: cost matrix vuông n x n
 *  Output: match[j] = i  (col j nhận row i)
 * =========================== */
function hungarian(cost: number[][]): number[] {
  const n = cost.length
  const u = Array(n + 1).fill(0)
  const v = Array(n + 1).fill(0)
  const p = Array(n + 1).fill(0)
  const way = Array(n + 1).fill(0)

  for (let i = 1; i <= n; i++) {
    p[0] = i
    let j0 = 0
    const minv = Array(n + 1).fill(Infinity)
    const used = Array(n + 1).fill(false)
    do {
      used[j0] = true
      const i0 = p[j0]
      let delta = Infinity
      let j1 = 0
      for (let j = 1; j <= n; j++) if (!used[j]) {
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j]
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0 }
        if (minv[j] < delta) { delta = minv[j]; j1 = j }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta }
        else { minv[j] -= delta }
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]
      p[j0] = p[j1]
      j0 = j1
    } while (j0 !== 0)
  }

  const match = Array(n).fill(-1) // col -> row
  for (let j = 1; j <= n; j++) if (p[j] > 0) match[j - 1] = p[j] - 1
  return match
}

/* ===========================
 *  Score phù hợp user-task (0..1)
 *  Ưu tiên kinh nghiệm & cân bằng workload
 * =========================== */
export function calculateUserTaskScore(
  user: AlgoUser,
  task: AlgoTask,
  experienceMatrix: ExperienceMatrix
): number {
  // 1) Field Experience (50%)
  const experienceScores = task.required_skills.map(skillId =>
    getExperienceScore(experienceMatrix, user.id, skillId)
  )
  const avgExperience = experienceScores.length > 0
    ? experienceScores.reduce((s, v) => s + v, 0) / experienceScores.length
    : 0

  const experienceBonus = avgExperience > 0.7 ? 0.2 : avgExperience > 0.5 ? 0.1 : 0
  const fieldExperienceScore = Math.min(1, avgExperience + experienceBonus)

  // 2) Workload Balance (35%)
  const maxWorkload = Math.max(1, user.max_concurrent_tasks) // bỏ hard-code 3
  const workloadRatio = user.current_workload / maxWorkload
  let workloadScore = 0
  if (workloadRatio === 0)      workloadScore = 1.0
  else if (workloadRatio <= .33) workloadScore = 0.8
  else if (workloadRatio <= .66) workloadScore = 0.5
  else                           workloadScore = 0.2

  // 3) Skill Coverage (10%)
  const skillCoverage = task.required_skills.filter(skillId =>
    getExperienceScore(experienceMatrix, user.id, skillId) > 0
  ).length
  const skillCoverageScore = task.required_skills.length > 0
    ? skillCoverage / task.required_skills.length
    : 1

  // 4) Specialization (5%)
  const hasHighExpertise = experienceScores.some(s => s > 0.8)
  const specializationScore = hasHighExpertise ? 1 : 0.5

  let total = (
    fieldExperienceScore * 0.5 +
    workloadScore * 0.35 +
    skillCoverageScore * 0.1 +
    specializationScore * 0.05
  )

  // Fallback: không có dữ liệu kinh nghiệm - vẫn ưu tiên experience hơn workload
  if (avgExperience === 0 && skillCoverageScore === 0) {
    // Giảm trọng số workload để không ưu tiên quá mức người rảnh không có kinh nghiệm
    total = workloadScore * 0.4 + (user.current_workload === 0 ? 0.1 : 0.05)
    if (total === 0) total = 0.01 // Điểm rất thấp cho người không có kinh nghiệm
  }

  return Math.min(1, total)
}

/* ===========================
 *  Hungarian + Capacity bằng slot
 *  - Biến mỗi user thành nhiều "slot" theo capacity còn lại
 *  - Thêm slot giả "UNASSIGNED" để cho phép không gán
 *  - Tối ưu toàn cục theo tổng điểm
 * =========================== */

/**
 * Thuật toán Hungarian Assignment với ràng buộc (tối ưu toàn cục)
 *
 * Input: Tasks cần phân công, users (kèm workload hiện tại), ma trận kinh nghiệm
 * Output: Phân công tối ưu task -> user (có thể "không gán" nếu điểm thấp)
 * Ràng buộc: Mỗi người tối đa `min(maxConcurrentTasks, user.max_concurrent_tasks)` công việc đồng thời
 */
export function constrainedHungarianAssignment(
  tasks: AlgoTask[],
  users: AlgoUser[],
  experienceMatrix: ExperienceMatrix,
  maxConcurrentTasks: number = 2,
  options?: {
    minConfidence?: number   // ngưỡng tự tin tối thiểu để chấp nhận gán
    unassignedCost?: number  // chi phí gán “không ai” (0..1), càng thấp càng dễ bỏ qua
    bigPenalty?: number      // phạt lớn để cấm gán
  }
): Assignment[] {
  const minConfidence = options?.minConfidence ?? 0.4
  const unassignedCost = options?.unassignedCost ?? 0.45
  const bigPenalty = options?.bigPenalty ?? 1e6

  // 1) Tạo slots theo capacity còn lại của mỗi user
  type Slot = { userId: string; slotIndex: number; isDummy?: boolean }
  const slots: Slot[] = []
  for (const u of users) {
    const capUser = Math.min(maxConcurrentTasks, u.max_concurrent_tasks)
    const remaining = Math.max(0, capUser - u.current_workload)
    for (let k = 0; k < remaining; k++) {
      slots.push({ userId: u.id, slotIndex: k })
    }
  }

  // Nếu không ai còn slot → không có gán
  const totalRealSlots = slots.length
  if (totalRealSlots === 0 && tasks.length > 0) {
    return []
  }

  // 2) Pad để thành ma trận vuông
  const n = Math.max(tasks.length, slots.length)
  // Thêm slot giả (UNASSIGNED) nếu thiếu
  while (slots.length < n) slots.push({ userId: 'UNASSIGNED', slotIndex: slots.length, isDummy: true })

  // Thêm task giả để vuông (không ảnh hưởng kết quả)
  const padTasks: AlgoTask[] = [...tasks]
  while (padTasks.length < n) {
    padTasks.push({
      id: `DUMMY_TASK_${padTasks.length}`,
      name: 'DUMMY',
      required_skills: [],
      priority: 0,
      estimated_hours: 0
    })
  }

  // 3) Xây ma trận chi phí (Hungarian minimize)
  const cost: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    const task = padTasks[i]
    const isDummyTask = task.name === 'DUMMY'

    for (let j = 0; j < n; j++) {
      const slot = slots[j]

      if (isDummyTask) {
        // DUMMY task: cost 0 cho mọi slot để không ảnh hưởng tối ưu
        cost[i][j] = 0
        continue
      }

      if (slot.isDummy) {
        // Gán task thật vào slot "không ai"
        cost[i][j] = unassignedCost
        continue
      }

      const user = users.find(u => u.id === slot.userId)!
      // (Phòng hờ) Nếu capacity đã hết (không nên xảy ra vì đã tạo slot), cấm gán
      const capUser = Math.min(maxConcurrentTasks, user.max_concurrent_tasks)
      if (user.current_workload >= capUser) {
        cost[i][j] = bigPenalty
        continue
      }

      // Tính coverage ratio thay vì chặn cứng
      const totalReq = task.required_skills.length
      const covered = totalReq === 0 ? 0 : task.required_skills
        .reduce((acc, sid) => acc + (getExperienceScore(experienceMatrix, user.id, sid) > 0 ? 1 : 0), 0)
      
      const coverageRatio = totalReq === 0 ? 1 : covered / totalReq

      // Điểm cơ sở theo hàm calculateUserTaskScore
      let baseScore = calculateUserTaskScore(user, task, experienceMatrix)

      // Nếu không phủ kỹ năng nào (coverageRatio = 0) thì giảm điểm một chút (phạt mềm),
      // nhưng không về 0 để thuật toán vẫn có thể đề xuất dựa vào workload:
      if (totalReq > 0 && coverageRatio === 0) {
        baseScore = Math.max(0, baseScore - 0.15) // phạt 0.15
      }

      // Score -> cost
      cost[i][j] = 1 - Math.max(0, Math.min(1, baseScore))
    }
  }

  // 4) Chạy Hungarian để tối ưu toàn cục
  const matchColToRow = hungarian(cost) // col j -> row i

  // 5) Convert về Assignment + áp ngưỡng minConfidence
  const results: Assignment[] = []
  for (let j = 0; j < n; j++) {
    const row = matchColToRow[j]
    if (row < 0) continue

    const task = padTasks[row]
    if (task.name === 'DUMMY') continue // bỏ task giả

    const slot = slots[j]
    if (slot.isDummy || slot.userId === 'UNASSIGNED') continue // “không gán ai”

    const user = users.find(u => u.id === slot.userId)!
    const score = 1 - cost[row][j]
    if (score < minConfidence) continue

    // experience_score trung bình trên required_skills
    const exps = task.required_skills.map(sid => getExperienceScore(experienceMatrix, user.id, sid))
    const expAvg = exps.length ? exps.reduce((a, b) => a + b, 0) / exps.length : 0

    results.push({
      task_id: task.id,
      user_id: user.id,
      confidence_score: score,
      experience_score: expAvg
    })
  }

  return results
}

/**
 * Phân công tối ưu cho một task đơn lẻ (dùng Hungarian với 1 hàng)
 */
export async function assignSingleTask(
  taskId: string,
  requiredSkills: number[],
  availableUsers: AlgoUser[],
  experienceMatrix: ExperienceMatrix,
  maxConcurrentTasks: number = 2
): Promise<Assignment | null> {
  const task: AlgoTask = {
    id: taskId,
    name: `Task ${taskId}`,
    required_skills: requiredSkills,
    priority: 1,
    estimated_hours: 8
  }

  const assignments = constrainedHungarianAssignment(
    [task],
    availableUsers,
    experienceMatrix,
    maxConcurrentTasks
  )

  return assignments.length > 0 ? assignments[0] : null
}

/**
 * Validate assignment constraints:
 * - Tính cả workload nền (current_workload) + assignments mới
 * - Không vượt quá min(maxConcurrentTasks, user.max_concurrent_tasks)
 */
export function validateAssignments(
  assignments: Assignment[],
  users: AlgoUser[],
  maxConcurrentTasks: number = 2
): { isValid: boolean; violations: string[] } {
  const violations: string[] = []
  const userAddCounts = new Map<string, number>()
  const userById = new Map(users.map(u => [u.id, u]))

  // Đếm số task mới gán cho mỗi user
  for (const a of assignments) {
    userAddCounts.set(a.user_id, (userAddCounts.get(a.user_id) || 0) + 1)
  }

  // Kiểm tra trần dựa trên workload nền + số lượng mới
  for (const [userId, add] of userAddCounts.entries()) {
    const u = userById.get(userId)
    const maxTasks = u ? Math.min(maxConcurrentTasks, u.max_concurrent_tasks) : maxConcurrentTasks
    const base = u?.current_workload ?? 0
    if (base + add > maxTasks) {
      violations.push(`User ${userId} sẽ có tổng ${base + add}/${maxTasks} công việc (vượt trần).`)
    }
  }

  return {
    isValid: violations.length === 0,
    violations
  }
}
