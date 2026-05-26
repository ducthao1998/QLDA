/**
 * Shared scheduling primitives — topological sort + earliest-start CPM.
 *
 * Used by:
 *  - /api/projects/[id]/gantt              (compute display dates)
 *  - /api/projects/[id]/optimize           (compute optimized schedule)
 *  - components/gantt/utils.ts             (frontend recompute)
 *
 * Dependency convention: `task_dependencies(task_id, depends_on_id)` means
 * `depends_on_id` MUST finish before `task_id` can start (finish-to-start).
 */

export interface SchedulingTask {
  id: string | number
  duration_days?: number | null
}

export interface SchedulingDependency {
  task_id: string | number
  depends_on_id: string | number
}

export interface ScheduledTask {
  id: string
  start_date: string // ISO
  end_date: string // ISO
  duration_days: number
  level: number // depth in DAG, 0 = no predecessors
  has_dependencies: boolean
  // Predecessors that drive its start (whose finish equals our start - lag)
  driving_predecessors: string[]
}

export interface SchedulingOptions {
  /** Default duration when task.duration_days is null/undefined (days). */
  defaultDurationDays?: number
  /** Add 1-day gap after each predecessor finish. Default true (matches legacy behaviour). */
  startNextDayAfterDependency?: boolean
}

/**
 * Kahn's topological sort with cycle detection.
 *
 * @returns object with:
 *   - `order`: task ids in valid topological order
 *   - `levels`: map id -> depth (longest path from a root)
 *   - `cycle`: ids involved in a cycle if one was detected, otherwise null
 */
export function topologicalSort(
  tasks: SchedulingTask[],
  dependencies: SchedulingDependency[],
): { order: string[]; levels: Map<string, number>; cycle: string[] | null } {
  const ids = new Set(tasks.map((t) => String(t.id)))
  // Build predecessor / successor maps, ignoring dangling or self-referential edges.
  const preds = new Map<string, string[]>()
  const succs = new Map<string, string[]>()
  ids.forEach((id) => {
    preds.set(id, [])
    succs.set(id, [])
  })
  for (const dep of dependencies || []) {
    const a = String(dep.task_id)
    const b = String(dep.depends_on_id)
    if (!a || !b || a === b) continue
    if (!ids.has(a) || !ids.has(b)) continue
    preds.get(a)!.push(b)
    succs.get(b)!.push(a)
  }

  const indeg = new Map<string, number>()
  ids.forEach((id) => indeg.set(id, preds.get(id)!.length))

  const queue: string[] = []
  indeg.forEach((v, id) => {
    if (v === 0) queue.push(id)
  })

  const order: string[] = []
  const levels = new Map<string, number>()
  ids.forEach((id) => levels.set(id, 0))

  while (queue.length) {
    const u = queue.shift()!
    order.push(u)
    const lvU = levels.get(u)!
    for (const v of succs.get(u)!) {
      indeg.set(v, indeg.get(v)! - 1)
      levels.set(v, Math.max(levels.get(v)!, lvU + 1))
      if (indeg.get(v) === 0) queue.push(v)
    }
  }

  if (order.length !== ids.size) {
    // Cycle present — report which nodes remain unresolved.
    const stuck: string[] = []
    indeg.forEach((v, id) => {
      if (v > 0) stuck.push(id)
    })
    return { order, levels, cycle: stuck }
  }
  return { order, levels, cycle: null }
}

/**
 * Earliest-start schedule (forward pass of CPM).
 *
 * Each task starts the day after the latest predecessor finishes
 * (or `startNextDayAfterDependency=false` to start the same day).
 * Tasks with no predecessors start at `projectStart`.
 *
 * @returns map of task id to ScheduledTask in DAG order.
 */
export function computeEarliestSchedule(
  tasks: SchedulingTask[],
  dependencies: SchedulingDependency[],
  projectStart: Date,
  options: SchedulingOptions = {},
): Map<string, ScheduledTask> {
  const defaultDur = Math.max(1, options.defaultDurationDays ?? 1)
  const gap = options.startNextDayAfterDependency ?? true ? 1 : 0

  const { order, levels, cycle } = topologicalSort(tasks, dependencies)
  if (cycle && cycle.length) {
    console.warn(
      `[scheduling] Dependency cycle detected involving ${cycle.length} task(s); ` +
        `those tasks fall back to projectStart.`,
    )
  }

  // Build predecessor lookup once.
  const ids = new Set(tasks.map((t) => String(t.id)))
  const preds = new Map<string, string[]>()
  tasks.forEach((t) => preds.set(String(t.id), []))
  for (const dep of dependencies || []) {
    const a = String(dep.task_id)
    const b = String(dep.depends_on_id)
    if (!a || !b || a === b) continue
    if (!ids.has(a) || !ids.has(b)) continue
    preds.get(a)!.push(b)
  }

  const durations = new Map<string, number>()
  tasks.forEach((t) => {
    const d = t.duration_days
    durations.set(String(t.id), d && d > 0 ? d : defaultDur)
  })

  const result = new Map<string, ScheduledTask>()
  const projectStartMs = projectStart.getTime()
  const oneDayMs = 86_400_000

  // Process in topo order so predecessors are always resolved first.
  // Tasks involved in a cycle (not in `order`) are scheduled last at projectStart.
  const processed = new Set<string>()
  for (const id of order) {
    scheduleOne(id)
    processed.add(id)
  }
  // Cycle stragglers fall through with projectStart as the floor.
  tasks.forEach((t) => {
    const id = String(t.id)
    if (!processed.has(id)) scheduleOne(id)
  })

  return result

  function scheduleOne(id: string) {
    const dur = durations.get(id)!
    const myPreds = preds.get(id) || []
    let startMs = projectStartMs
    const driving: string[] = []

    if (myPreds.length) {
      let latestEnd = -Infinity
      for (const p of myPreds) {
        const pSched = result.get(p)
        if (!pSched) continue
        const pEnd = new Date(pSched.end_date).getTime()
        if (pEnd > latestEnd) {
          latestEnd = pEnd
          driving.length = 0
          driving.push(p)
        } else if (pEnd === latestEnd) {
          driving.push(p)
        }
      }
      if (latestEnd > -Infinity) {
        startMs = latestEnd + gap * oneDayMs
      }
    }
    if (startMs < projectStartMs) startMs = projectStartMs
    const endMs = startMs + (dur - 1) * oneDayMs // inclusive: dur=1 means same day

    result.set(id, {
      id,
      start_date: new Date(startMs).toISOString(),
      end_date: new Date(endMs).toISOString(),
      duration_days: dur,
      level: levels.get(id) ?? 0,
      has_dependencies: myPreds.length > 0,
      driving_predecessors: driving,
    })
  }
}

/**
 * Compute the project makespan in whole days from a scheduled task map.
 * Returns 0 when the map is empty.
 */
export function computeMakespanDays(scheduled: Map<string, ScheduledTask>): number {
  if (scheduled.size === 0) return 0
  let minStart = Infinity
  let maxEnd = -Infinity
  scheduled.forEach((s) => {
    const a = new Date(s.start_date).getTime()
    const b = new Date(s.end_date).getTime()
    if (a < minStart) minStart = a
    if (b > maxEnd) maxEnd = b
  })
  return Math.max(0, Math.round((maxEnd - minStart) / 86_400_000) + 1)
}
