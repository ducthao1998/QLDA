import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get all users with their skills from user_skill_matrix view
    const { data: matrixData, error } = await supabase
      .from('user_skill_matrix')
      .select(`
        user_id,
        full_name,
        skill_id,
        skill_name,
        completed_tasks_count,
        total_experience_days,
        last_activity_date
      `)
      .order('full_name')

    if (error) {
      console.error('Error fetching skill matrix:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group by user
    const userSkillMap = new Map()
    
    matrixData?.forEach(item => {
      if (!userSkillMap.has(item.user_id)) {
        userSkillMap.set(item.user_id, {
          user_id: item.user_id,
          full_name: item.full_name,
          skills: []
        })
      }
      
      const user = userSkillMap.get(item.user_id)
      user.skills.push({
        skill_id: item.skill_id,
        skill_name: item.skill_name,
        completed_tasks_count: item.completed_tasks_count,
        total_experience_days: item.total_experience_days,
        last_activity_date: item.last_activity_date
      })
    })

    const result = Array.from(userSkillMap.values())

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in GET /api/team/skill-matrix:', error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
