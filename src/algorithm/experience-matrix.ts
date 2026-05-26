import { createClient } from '@/lib/supabase/server'

/**
 * Experience scoring for the RACI auto-assigner.
 *
 * The old implementation was a step-function over `completed_tasks_count` —
 * essentially "5+ done tasks = expert, 4 = barely qualified". That's wrong:
 *  - It ignored recency (tasks finished 5 years ago count the same as last week)
 *  - It ignored actual hours spent (one trivial task and one 200-hour task
 *    counted the same)
 *  - It ignored delivery quality (on-time vs chronically late)
 *
 * The new model produces  E(u, s) = baseScore × recencyWeight × qualityWeight
 *
 * - baseScore       : continuous log-scale on total experience days (hours/8).
 *                     ~40 experience-days saturates to ≈1.0. Avoids the jagged
 *                     "4 tasks = 0.5, 5 = 0.7" cliff.
 * - recencyWeight   : exponential decay with a 6-month half-life on the user's
 *                     most recent worklog for that skill. Stale expertise fades.
 * - qualityWeight   : 0.5 + 0.5 × on-time rate, derived from task_progress
 *                     (planned_finish vs actual_finish). Chronic late finisher
 *                     scores at most ~0.5× of the same hours' on-time finisher.
 *
 * Skill-field fallback (see `getExperienceScoreWithFallback`) lets a user with
 * an "adjacent" skill in the same `skills.field` still pick up partial credit
 * (40% by default), instead of being scored zero.
 */

export interface ExperienceMatrix {
  [user_id: string]: {
    [skill_id: number]: number
  }
}

/** Per-skill diagnostic info, kept alongside `scores` for transparency in the UI. */
export interface ExperienceBreakdown {
  experienceDays: number
  lastActivityDate: string | null
  baseScore: number
  recencyWeight: number
  qualityWeight: number
  finalScore: number
}

export interface ExperienceMatrixData {
  /** [user_id][skill_id] -> 0..1 score (combined). Backward-compatible shape. */
  scores: ExperienceMatrix
  /** Optional detailed breakdown per (user, skill). */
  breakdown?: { [user_id: string]: { [skill_id: number]: ExperienceBreakdown } }
  /** Map skill_id -> field (used for the field-similarity fallback). */
  skillField: Map<number, string>
  /**
   * Map user_id -> field -> best raw score the user has in any skill of that
   * field. Used for the "adjacent skill" fallback.
   */
  userFieldBest: Map<string, Map<string, number>>
}

// ───── tunables (kept here so they're easy to find / configure later) ─────
/**
 * Half-life for the recency decay. 12 months is appropriate for the project-
 * management context here: people's skills don't actually evaporate after 6
 * months, they just need a little refresh. We used 6 months in the first cut
 * and it killed the headline scores for anyone whose worklogs were
 * 8-9 months old (typical for cross-fiscal-year projects).
 */
const RECENCY_HALF_LIFE_MONTHS = 12
const BASE_SATURATION_DAYS = 40 // ≈ one full month of focused work
const QUALITY_FLOOR = 0.5 // worst quality multiplier (chronic late finisher)
const FIELD_FALLBACK_FACTOR = 0.4 // adjacent-skill credit
const MS_PER_DAY = 86_400_000

// ────────────────────── pure math helpers ──────────────────────

/** Smooth, continuous "hours spent → expertise" curve (0..1). */
function continuousBaseScore(experienceDays: number): number {
  if (experienceDays <= 0) return 0
  // log1p so 0 days → 0 cleanly and ~40 days → ~1.0
  return Math.min(1, Math.log1p(experienceDays) / Math.log1p(BASE_SATURATION_DAYS))
}

/** Exponential decay, half-life 6 months by default. Null/unknown → 0.5. */
function recencyDecay(lastActivityISO: string | null, now: number = Date.now()): number {
  if (!lastActivityISO) return 0.5
  const last = new Date(lastActivityISO).getTime()
  if (!Number.isFinite(last)) return 0.5
  const monthsAgo = (now - last) / (30 * MS_PER_DAY)
  if (monthsAgo <= 0) return 1
  return Math.exp(-(monthsAgo * Math.LN2) / RECENCY_HALF_LIFE_MONTHS)
}

/** Map on-time rate (0..1) into a multiplier bounded by QUALITY_FLOOR. */
function qualityMultiplier(onTimeRate: number): number {
  const r = Math.max(0, Math.min(1, onTimeRate))
  return QUALITY_FLOOR + (1 - QUALITY_FLOOR) * r
}

// ────────────────────── public API ──────────────────────

/**
 * Backward-compatible builder: returns the same `ExperienceMatrix` shape the
 * pre-refactor code expects, but populated using the new continuous + recency
 * + quality scoring described at the top of the file.
 *
 * Prefer `buildExperienceMatrixData` for new code — it includes the field map
 * and per-skill breakdown that powers the adjacent-skill fallback and the
 * "why was I assigned this" tooltip.
 */
export async function buildExperienceMatrix(
  userIds: string[],
  skillIds: number[],
  // Accepted for backward compatibility — older callers passed taskId here but
  // it was never used. Silently ignored.
  _taskId?: string,
): Promise<ExperienceMatrix> {
  const data = await buildExperienceMatrixData(userIds, skillIds)
  return data.scores
}

/**
 * Build the experience matrix from `user_skill_matrix` (worklogs aggregate)
 * and `task_progress` (delivery quality). Skills are looked up so we know
 * their `field` for the adjacent-skill fallback.
 *
 * @param userIds  candidates to score (empty = nobody)
 * @param skillIds skills that any task needs (empty = nothing to score)
 */
export async function buildExperienceMatrixData(
  userIds: string[],
  skillIds: number[],
): Promise<ExperienceMatrixData> {
  const supabase = await createClient()
  const scores: ExperienceMatrix = {}
  const breakdown: ExperienceMatrixData['breakdown'] = {}
  const skillField = new Map<number, string>()
  const userFieldBest = new Map<string, Map<string, number>>()

  userIds.forEach((uid) => {
    scores[uid] = {}
    breakdown[uid] = {}
    userFieldBest.set(uid, new Map())
    skillIds.forEach((sid) => (scores[uid][sid] = 0))
  })

  if (userIds.length === 0 || skillIds.length === 0) {
    return { scores, breakdown, skillField, userFieldBest }
  }

  try {
    // 1) Pull aggregate experience days + last activity from the existing view.
    //    We intentionally select ALL skills a user has touched (not just the
    //    ones the current task needs), so we can compute the field-fallback
    //    for "user knows a sibling skill".
    const { data: matrixRows } = await supabase
      .from('user_skill_matrix')
      .select('user_id, skill_id, skill_field, total_experience_days, last_activity_date')
      .in('user_id', userIds)

    // 2) On-time rate per user, from task_progress + task_raci join.
    //    A row counts as "on time" if actual_finish <= planned_finish.
    const { data: progressRows } = await supabase
      .from('task_progress')
      .select(`
        actual_finish,
        planned_finish,
        tasks!inner(
          id,
          task_raci!inner(user_id, role)
        )
      `)
      .not('actual_finish', 'is', null)
      .not('planned_finish', 'is', null)

    // Aggregate on-time rates per user (across all their R tasks)
    const userTotal = new Map<string, number>()
    const userOnTime = new Map<string, number>()
    for (const row of (progressRows || []) as any[]) {
      const task = row?.tasks
      if (!task) continue
      const responsibles = (task.task_raci || []).filter((r: any) => r.role === 'R')
      const onTime = new Date(row.actual_finish).getTime() <= new Date(row.planned_finish).getTime()
      for (const r of responsibles) {
        if (!userIds.includes(r.user_id)) continue
        userTotal.set(r.user_id, (userTotal.get(r.user_id) || 0) + 1)
        if (onTime) userOnTime.set(r.user_id, (userOnTime.get(r.user_id) || 0) + 1)
      }
    }
    const onTimeRateOf = (uid: string): number => {
      const tot = userTotal.get(uid) || 0
      if (tot === 0) return 1 // unknown → assume good, don't punish newbies
      return (userOnTime.get(uid) || 0) / tot
    }

    // 3) Populate the matrix using base × recency × quality.
    for (const row of (matrixRows || []) as any[]) {
      const uid = row.user_id as string
      const sid = row.skill_id as number
      if (!scores[uid]) continue
      const expDays = Number(row.total_experience_days) || 0
      const base = continuousBaseScore(expDays)
      const rec = recencyDecay(row.last_activity_date as string | null)
      const qual = qualityMultiplier(onTimeRateOf(uid))
      const finalScore = Math.min(1, base * rec * qual)

      // Track best-in-field for fallback (use base × recency without quality,
      // so adjacent-skill credit doesn't double-punish for late delivery on
      // unrelated tasks).
      const field = row.skill_field as string | null
      if (field) {
        skillField.set(sid, field)
        const fmap = userFieldBest.get(uid) ?? new Map()
        const prev = fmap.get(field) || 0
        const fieldScore = Math.min(1, base * rec)
        if (fieldScore > prev) fmap.set(field, fieldScore)
        userFieldBest.set(uid, fmap)
      }

      // Only record into the matrix for skills we were asked about — anything
      // else is just used for the field aggregation above.
      if (skillIds.includes(sid)) {
        scores[uid][sid] = finalScore
        breakdown[uid][sid] = {
          experienceDays: expDays,
          lastActivityDate: row.last_activity_date as string | null,
          baseScore: base,
          recencyWeight: rec,
          qualityWeight: qual,
          finalScore,
        }
      }
    }

    // 4) Fill skillField for any required skills we didn't see in worklogs yet
    //    (so the fallback still works for brand-new skills).
    const unseenSkills = skillIds.filter((s) => !skillField.has(s))
    if (unseenSkills.length) {
      const { data: skillRows } = await supabase
        .from('skills')
        .select('id, field')
        .in('id', unseenSkills)
      for (const s of (skillRows || []) as any[]) {
        if (s.field) skillField.set(s.id, s.field)
      }
    }
  } catch (err) {
    console.error('[experience-matrix] build failed:', err)
  }

  return { scores, breakdown, skillField, userFieldBest }
}

/** Backward-compatible accessor — same signature as before. */
export function getExperienceScore(
  matrixOrData: ExperienceMatrix | ExperienceMatrixData,
  userId: string,
  skillId: number,
): number {
  const m = ('scores' in matrixOrData ? matrixOrData.scores : matrixOrData) as ExperienceMatrix
  return m[userId]?.[skillId] || 0
}

/**
 * Like `getExperienceScore` but if the user has zero credit for the exact
 * skill, look for any skill in the same `field` and return a fraction of that
 * (default 40%). Modelling assumption: someone who's done lots of "Triển khai
 * hạ tầng CNTT" should partially qualify for "Triển khai dịch vụ hợp đồng".
 */
export function getExperienceScoreWithFallback(
  data: ExperienceMatrixData,
  userId: string,
  skillId: number,
): number {
  const direct = data.scores[userId]?.[skillId]
  if (direct && direct > 0) return direct

  const field = data.skillField.get(skillId)
  if (!field) return 0
  const best = data.userFieldBest.get(userId)?.get(field) || 0
  return best * FIELD_FALLBACK_FACTOR
}

/** Top experts on a given skill (used by the smart C/I picker). */
export function getTopExperiencedUsers(
  data: ExperienceMatrixData | ExperienceMatrix,
  skillId: number,
  limit: number = 5,
): Array<{ user_id: string; experience_score: number }> {
  const matrix = ('scores' in data ? data.scores : data) as ExperienceMatrix
  return Object.keys(matrix)
    .map((uid) => ({ user_id: uid, experience_score: matrix[uid]?.[skillId] || 0 }))
    .filter((x) => x.experience_score > 0)
    .sort((a, b) => b.experience_score - a.experience_score)
    .slice(0, limit)
}
