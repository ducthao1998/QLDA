import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  
  try {
    const userId = params.id

    // Get user's RACI history
    const { data: raciHistory, error } = await supabase
      .from('task_raci')
      .select(`
        role,
        tasks!inner(
          id,
          name,
          projects!inner(name)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20) // Get last 20 assignments

    if (error) {
      console.error('Error fetching RACI history:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Count role occurrences
    const roleCounts = {
      R: 0,
      A: 0,
      C: 0,
      I: 0
    }

    const processedHistory = raciHistory?.map(raci => {
      roleCounts[raci.role as keyof typeof roleCounts]++
      
      return {
        role: raci.role,
        task_name: raci.tasks.name,
        project_name: raci.tasks.projects.name,
        task_id: raci.tasks.id
      }
    }) || []

    return NextResponse.json({
      user_id: userId,
      raci_history: processedHistory,
      role_counts: roleCounts,
      total_assignments: processedHistory.length
    })

  } catch (error: any) {
    console.error('Error in RACI history API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
