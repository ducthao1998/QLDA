import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { buildExperienceMatrixData } from '@/algorithm/experience-matrix'

/**
 * GET /api/team/skill-matrix
 *
 * Returns the team's skill matrix with the FULL experience score breakdown
 * (base × recency × quality), not just a raw completed-task count. The
 * `/dashboard/team` heatmap renders this directly.
 *
 * Response shape:
 *  {
 *    skills: Skill[],                 // every skill in the org
 *    users:  UserSkillProfile[]       // one entry per user, even if no logs
 *  }
 * where UserSkillProfile carries each skill's experience_days, last activity,
 * combined score and component weights so the UI can show a tooltip /
 * detailed profile dialog.
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Auth check — anyone logged in may view the team's skill matrix.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1) All users + all skills.
    const [{ data: usersData, error: usersError }, { data: skillsData, error: skillsError }] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, position, org_unit, max_concurrent_tasks')
        .order('full_name'),
      supabase.from('skills').select('id, name, field').order('id'),
    ])

    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })
    if (skillsError) return NextResponse.json({ error: skillsError.message }, { status: 500 })

    const users = (usersData as any[]) || []
    const skills = (skillsData as any[]) || []

    // 2) Build rich experience matrix across all users × all skills.
    const userIds = users.map((u) => u.id)
    const skillIds = skills.map((s) => s.id)
    const matrix = await buildExperienceMatrixData(userIds, skillIds)

    // 3) Project per-user view: for each skill, attach experience_days,
    //    last_activity_date, score + breakdown.
    const profiles = users.map((u: any) => {
      const userBreakdown = matrix.breakdown?.[u.id] || {}
      const userSkills = skills
        .map((s: any) => {
          const b = (userBreakdown as any)[s.id]
          const score = matrix.scores[u.id]?.[s.id] || 0
          // We always include the row so the UI can render an empty cell
          // explicitly (instead of "missing"). Down-stream we sort/filter by
          // score so zero-score rows naturally fall to the bottom.
          return {
            skill_id: s.id,
            skill_name: s.name,
            skill_field: s.field || null,
            experience_days: b?.experienceDays ?? 0,
            last_activity_date: b?.lastActivityDate ?? null,
            score,
            base_score: b?.baseScore ?? 0,
            recency_weight: b?.recencyWeight ?? 0,
            quality_weight: b?.qualityWeight ?? 0,
          }
        })
        // Hide zero-score skills from the row payload so the heatmap data
        // is lean; the UI can still show "-" for missing skills by joining
        // against the `skills` list.
        .filter((row) => row.score > 0 || row.experience_days > 0)

      // Top-N strongest skills for the "headline" view + a single overall
      // expert score (average of top 3 — rewards specialists, not breadth-only).
      const topSkills = [...userSkills]
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(({ skill_id, skill_name, score }) => ({ skill_id, skill_name, score }))
      const expertScore =
        topSkills.length > 0
          ? topSkills.reduce((sum, s) => sum + s.score, 0) / topSkills.length
          : 0

      return {
        user_id: u.id,
        full_name: u.full_name,
        position: u.position || null,
        org_unit: u.org_unit || null,
        max_concurrent_tasks: u.max_concurrent_tasks ?? 3,
        skills: userSkills,
        top_skills: topSkills,
        expert_score: expertScore,
      }
    })

    return NextResponse.json({
      skills: skills.map((s) => ({ id: s.id, name: s.name, field: s.field || null })),
      users: profiles,
    })
  } catch (err: any) {
    console.error('Error in GET /api/team/skill-matrix:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
