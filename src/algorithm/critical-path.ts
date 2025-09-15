import type { TaskStatus } from "@/app/types/table-types"

type TSecs = number

interface TaskNode {
  id: string
  d: TSecs
  ES: TSecs
  EF: TSecs
  LS: TSecs
  LF: TSecs
  slack: TSecs
  free: TSecs
  dependencies: string[]
}

export interface CriticalPathResult {
  criticalPath: string[]
  totalDuration: number // days
  criticalPathDuration: number // days
  explanation: string
  taskDetails: Array<{
    taskId: string
    taskName: string
    duration: number // days
    slack: number // days (Total Float)
    freeFloat: number // days (Free Float)
    isCritical: boolean // slack <= 0
    reason: string
    drivingPredecessorIds: string[]
    deadlineSlack?: number // days, negative if beyond deadline
    esHours?: number
    efHours?: number
  }>
}

export interface CPMTaskInput {
  id: string
  project_id?: string
  name: string
  status: TaskStatus
  note?: string | null
  duration_days?: number | null
  template_id?: number | null
  start_date: string
  end_date: string
}

export interface CPMDependencyInput {
  task_id: string
  depends_on_id: string
}

export function calculateCriticalPath(
  tasks: CPMTaskInput[],
  dependencies: CPMDependencyInput[],
  projectEndISO?: string,
): CriticalPathResult {
  const T = tasks.map(t => ({ ...t, id: String(t.id), duration_days: t.duration_days ?? 1 }))
  const edges = (dependencies || []).map(d => ({ task_id: String(d.task_id), depends_on_id: String(d.depends_on_id) }))

  const nodes = new Map<string, TaskNode>()
  const preds = new Map<string, string[]>()
  const succs = new Map<string, string[]>()

  T.forEach(t => {
    nodes.set(t.id, { id: t.id, d: (t.duration_days || 1) * 24, ES:0, EF:0, LS:0, LF:0, slack:0, free:0, dependencies: [] })
    preds.set(t.id, [])
    succs.set(t.id, [])
  })

  const taskIdSet = new Set(Array.from(nodes.keys()))
  const clean = edges
    .filter(e => e.task_id && e.depends_on_id)
    .filter(e => e.task_id !== e.depends_on_id)
    .filter(e => taskIdSet.has(e.task_id) && taskIdSet.has(e.depends_on_id))
  const removed = edges.length - clean.length
  if (removed > 0) console.warn(`[CPM] Loại ${removed} dependency không hợp lệ (mồ côi/tự tham chiếu/null)`)
  clean.forEach(e => {
    preds.get(e.task_id)!.push(e.depends_on_id)
    succs.get(e.depends_on_id)!.push(e.task_id)
    nodes.get(e.task_id)!.dependencies.push(e.depends_on_id)
  })

  const indeg = new Map<string, number>()
  nodes.forEach((_, id) => indeg.set(id, preds.get(id)!.length))
  const q: string[] = []
  indeg.forEach((v, id) => { if (v === 0) q.push(id) })
  const topo: string[] = []
  while (q.length) {
    const u = q.shift()!
    topo.push(u)
    for (const v of succs.get(u)!) {
      indeg.set(v, indeg.get(v)! - 1)
      if (indeg.get(v) === 0) q.push(v)
    }
  }
  if (topo.length !== nodes.size) {
    return {
      criticalPath: [], totalDuration: 0, criticalPathDuration: 0,
      explanation: 'Đồ thị có chu trình – không thể tính CPM.',
      taskDetails: T.map(t => ({
        taskId: t.id, taskName: t.name, duration: (t.duration_days || 1), slack: 0, freeFloat: 0, isCritical: false, reason: 'Chu trình trong phụ thuộc', drivingPredecessorIds: []
      }))
    }
  }

  for (const id of topo) {
    const n = nodes.get(id)!
    const ps = preds.get(id)!
    n.ES = ps.length ? Math.max(...ps.map(p => nodes.get(p)!.EF)) : 0
    n.EF = n.ES + n.d
  }
  const networkEnd = Math.max(...Array.from(nodes.values()).map(n => n.EF))
  const projectEndTS: TSecs | null = projectEndISO ? Math.max(0, Math.round(new Date(projectEndISO).getTime() / 1000 / 3600)) : null
  const projectEnd = projectEndTS ?? networkEnd

  for (let i = topo.length - 1; i >= 0; i--) {
    const id = topo[i]
    const n = nodes.get(id)!
    const ss = succs.get(id)!
    n.LF = ss.length ? Math.min(...ss.map(s => nodes.get(s)!.LS)) : projectEnd
    n.LS = n.LF - n.d
    n.slack = n.LS - n.ES
  }

  for (const id of topo) {
    const n = nodes.get(id)!
    const ss = succs.get(id)!
    if (ss.length === 0) {
      n.free = projectEnd - n.EF
    } else {
      const minSuccES = Math.min(...ss.map(s => nodes.get(s)!.ES))
      n.free = minSuccES - n.EF
    }
  }

  const ends = topo.filter(id => nodes.get(id)!.EF === networkEnd)
  const memo = new Map<string, string[]>()
  const buildPath = (id: string): string[] => {
    if (memo.has(id)) return memo.get(id)!
    const n = nodes.get(id)!
    const driving = preds.get(id)!.filter(p => nodes.get(p)!.EF === n.ES && nodes.get(p)!.slack <= 0)
    if (!driving.length) { const one = [id]; memo.set(id, one); return one }
    const bestPrev = driving.map(p => buildPath(p)).sort((a,b)=>b.length-a.length)[0]
    const res = [...bestPrev, id]; memo.set(id, res); return res
  }
  let bestPath: string[] = []
  for (const end of ends) {
    const path = buildPath(end)
    if (path.length > bestPath.length) bestPath = path
  }
  if (bestPath.length === 0) {
    const anyZero = topo.filter(id => nodes.get(id)!.slack <= 0)
    if (anyZero.length) bestPath = [anyZero[0]]
  }

  const toDays = (h: TSecs) => h / 24
  const totalDurationDays = toDays(networkEnd)
  const criticalPathDurationDays = bestPath.reduce((s, id) => s + toDays(nodes.get(id)!.d), 0)

  const taskDetails = T.map(t => {
    const n = nodes.get(t.id)!
    const isCritical = n.slack <= 0
    const drivingPredecessorIds = preds.get(t.id)!.filter(p => nodes.get(p)!.EF === n.ES)
    const deadlineSlack = projectEndTS ? toDays(n.LF - n.EF) : undefined
    const reason = isCritical
      ? (n.slack < 0
          ? 'Critical do deadline dự án siết (Total Float âm).'
          : (drivingPredecessorIds.length
              ? 'Critical do bị predecessor “đẩy” sát (EF tiền nhiệm = ES hiện tại).'
              : 'Critical vì là điểm khởi/đích quyết định tiến độ.'))
      : (n.free > 0
          ? `Không critical: Free Float ≈ ${Math.round(toDays(n.free))} ngày.`
          : 'Không critical nhưng ít/không dư địa.')

    return {
      taskId: t.id,
      taskName: t.name,
      duration: toDays(n.d),
      slack: toDays(n.slack),
      freeFloat: toDays(n.free),
      deadlineSlack,
      isCritical,
      reason,
      drivingPredecessorIds,
      esHours: n.ES,
      efHours: n.EF,
    }
  })

  return {
    criticalPath: bestPath,
    totalDuration: totalDurationDays,
    criticalPathDuration: criticalPathDurationDays,
    explanation:
      `Đường găng gồm ${bestPath.length} công việc (≈ ${criticalPathDurationDays.toFixed(1)} ngày). ` +
      `Thời gian hoàn thành theo mạng: ${totalDurationDays.toFixed(1)} ngày` +
      (projectEndTS ? `; deadline dự án: ${toDays(projectEnd).toFixed(1)} ngày (tính từ mốc 0).` : '.'),
    taskDetails,
  }
}
