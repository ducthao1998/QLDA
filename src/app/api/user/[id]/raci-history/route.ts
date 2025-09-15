import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  
  try {
    const userId = (await params).id

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
      .limit(20) // Get last 20 assignments

    if (error) {
      console.error('Error fetching RACI history:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Accurate role counts using aggregation (not limited by 20)
    const roleCounts = { R: 0, A: 0, C: 0, I: 0 }
    const { data: countsAgg } = await supabase
      .from('task_raci')
      .select('role')
      .eq('user_id', userId)

    if (countsAgg) {
      for (const row of countsAgg as any[]) {
        const r = row.role as keyof typeof roleCounts
        if (roleCounts[r] !== undefined) roleCounts[r]++
      }
    }

    const processedHistory = raciHistory?.map((raci: any) => ({
      role: raci.role,
      task_name: raci.tasks?.name,
      project_name: raci.tasks?.projects?.name,
      task_id: raci.tasks?.id
    })) || []

    return NextResponse.json({
      user_id: userId,
      raci_history: processedHistory,
      role_counts: roleCounts,
      total_assignments: (roleCounts.R + roleCounts.A + roleCounts.C + roleCounts.I)
    })

  } catch (error: any) {
    console.error('Error in RACI history API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
