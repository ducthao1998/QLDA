import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch all users
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, position')
      .order('full_name')

    if (usersError) {
      console.error('Error fetching users for skill matrix:', usersError)
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    // Get skill aggregations from user_skill_matrix view (may be empty for some users)
    const { data: matrixData, error } = await supabase
      .from('user_skill_matrix')
      .select(`
        user_id,
        full_name,
        skill_id,
        skill_name,
        completed_tasks_count,
        last_activity_date
      `)
      .order('full_name')

    if (error) {
      console.error('Error fetching skill matrix:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Initialize all users with empty skills, then merge matrix rows
    const userIdToUser: Record<string, any> = {}
    usersData?.forEach(u => {
      userIdToUser[u.id] = {
        user_id: u.id,
        full_name: u.full_name,
        position: u.position,
        skills: [] as Array<{
          skill_id: number
          skill_name: string
          completed_tasks_count: number
          last_activity_date: string | null
        }>
      }
    })

    matrixData?.forEach(item => {
      const user = userIdToUser[item.user_id]
      if (!user) {
        // Fallback if user not present in users table for some reason
        userIdToUser[item.user_id] = {
          user_id: item.user_id,
          full_name: item.full_name,
          position: undefined,
          skills: []
        }
      }
      const target = userIdToUser[item.user_id]
      target.skills.push({
        skill_id: item.skill_id,
        skill_name: item.skill_name,
        completed_tasks_count: item.completed_tasks_count,
        last_activity_date: item.last_activity_date
      })
    })

    // Fallback aggregation: derive skills from completed tasks when worklogs are missing
    // Count done tasks per (user, skill) via task_raci (role R) and task_skills
    const { data: raciAgg, error: raciError } = await supabase
      .from('task_raci')
      .select(`
        user_id,
        tasks!inner(
          id,
          status,
          task_skills!inner(
            skill_id,
            skills!inner(name)
          )
        )
      `)
      .eq('role', 'R')

    if (!raciError && raciAgg) {
      // Build counts for users that still have empty skills
      const fallbackCounts: Record<string, Record<number, { name: string; count: number }>> = {}
      raciAgg.forEach((row: any) => {
        const userId = row.user_id as string
        const task = row.tasks as any
        if (!task) return
        const status = String(task.status || '').toLowerCase()
        // Treat these statuses as completed
        const isCompleted = status === 'done' || status === 'completed' || status === 'hoan_thanh'
        if (!isCompleted) return
        const tskills = (task.task_skills as any[]) || []
        if (!fallbackCounts[userId]) fallbackCounts[userId] = {}
        tskills.forEach(ts => {
          const skillId = ts.skill_id as number
          const skillName = ts.skills?.name as string
          if (!fallbackCounts[userId][skillId]) {
            fallbackCounts[userId][skillId] = { name: skillName, count: 0 }
          }
          fallbackCounts[userId][skillId].count += 1
        })
      })

      Object.entries(fallbackCounts).forEach(([userId, skillsMap]) => {
        const user = userIdToUser[userId]
        if (!user) return
        if ((user.skills?.length || 0) > 0) return // already has data from view
        user.skills = Object.entries(skillsMap).map(([skillId, info]) => ({
          skill_id: Number(skillId),
          skill_name: info.name,
          completed_tasks_count: info.count,
          last_activity_date: null
        }))
      })
    }

    const result = Object.values(userIdToUser)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in GET /api/team/skill-matrix:', error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
