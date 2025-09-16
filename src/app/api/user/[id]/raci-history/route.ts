import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  
  try {
    const userId = (await params).id

    // Get user's RACI history (include task status for completed counting)
    const { data: raciHistory, error } = await supabase
      .from('task_raci')
      .select(`
        role,
        tasks!inner(
          id,
          name,
          status,
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

    // Completed role counts (R/A) robust: by tasks.status in done set OR task_progress.actual_finish not null
    const doneStatuses = ['done', 'completed', 'hoan_thanh']
    const completedRoleCounts = { R: 0, A: 0 }
    try {
      // 1) All tasks this user holds R/A on
      const { data: userTaskRoles } = await supabase
        .from('task_raci')
        .select('task_id, role')
        .eq('user_id', userId)
        .in('role', ['R','A'])

      const taskIdToRoles = new Map<string, Set<'R'|'A'>>()
      for (const r of (userTaskRoles as any[]) || []) {
        const tid = String(r.task_id)
        const role = String(r.role) as 'R' | 'A'
        if (!taskIdToRoles.has(tid)) taskIdToRoles.set(tid, new Set())
        taskIdToRoles.get(tid)!.add(role)
      }

      const taskIds = Array.from(taskIdToRoles.keys())
      const numericTaskIds = taskIds
        .map((tid) => {
          const n = Number(tid)
          return Number.isFinite(n) && !Number.isNaN(n) ? n : null
        })
        .filter((n): n is number => n !== null)
      if (taskIds.length > 0) {
        // 2) Completed by task status
        const completedSet = new Set<string>()
        // Query numeric ids if available
        if (numericTaskIds.length > 0) {
          const { data: doneByStatusNum } = await supabase
            .from('tasks')
            .select('id, status')
            .in('id', numericTaskIds)
            .in('status', doneStatuses as any)
          for (const r of (doneByStatusNum as any[]) || []) completedSet.add(String(r.id))
        }
        // Also try string ids in case ids are text
        const stringTaskIds = taskIds.filter(t => !numericTaskIds.includes(Number(t)))
        if (stringTaskIds.length > 0) {
          const { data: doneByStatusStr } = await supabase
            .from('tasks')
            .select('id, status')
            .in('id', stringTaskIds)
            .in('status', doneStatuses as any)
          for (const r of (doneByStatusStr as any[]) || []) completedSet.add(String(r.id))
        }

        // 3) Completed by task_progress actual_finish
        if (numericTaskIds.length > 0) {
          const { data: doneByProgressNum } = await supabase
            .from('task_progress')
            .select('task_id')
            .in('task_id', numericTaskIds)
            .not('actual_finish', 'is', null)
          for (const row of (doneByProgressNum as any[]) || []) completedSet.add(String(row.task_id))
        }
        const stringTaskIds2 = taskIds.filter(t => !numericTaskIds.includes(Number(t)))
        if (stringTaskIds2.length > 0) {
          const { data: doneByProgressStr } = await supabase
            .from('task_progress')
            .select('task_id')
            .in('task_id', stringTaskIds2)
            .not('actual_finish', 'is', null)
          for (const row of (doneByProgressStr as any[]) || []) completedSet.add(String(row.task_id))
        }

        // 4) Count per role for tasks in completedSet
        for (const tid of completedSet) {
          const roles = taskIdToRoles.get(tid)
          if (!roles) continue
          if (roles.has('R')) completedRoleCounts.R += 1
          if (roles.has('A')) completedRoleCounts.A += 1
        }
      }
    } catch (e) {
      console.warn('completed_role_counts compute failed:', e)
    }

    const processedHistory = raciHistory?.map((raci: any) => ({
      role: raci.role,
      task_name: raci.tasks?.name,
      project_name: raci.tasks?.projects?.name,
      task_id: raci.tasks?.id,
      status: raci.tasks?.status || null,
    })) || []

    return NextResponse.json({
      user_id: userId,
      raci_history: processedHistory,
      role_counts: roleCounts,
      completed_role_counts: completedRoleCounts,
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
