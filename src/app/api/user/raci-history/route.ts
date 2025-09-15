import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  try {
    const url = new URL(request.url)
    const userIdsParam = url.searchParams.get('user_ids') || ''
    const userIds = userIdsParam.split(',').map(s => s.trim()).filter(Boolean)

    if (userIds.length === 0) {
      return NextResponse.json({ error: 'Thiếu tham số user_ids' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('task_raci')
      .select(`
        user_id,
        role,
        tasks!inner(
          id,
          name,
          projects!inner(name)
        )
      `)
      .in('user_id', userIds)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const histories: Record<string, any> = {}
    for (const uid of userIds) {
      histories[uid] = { user_id: uid, raci_history: [], role_counts: { R: 0, A: 0, C: 0, I: 0 }, total_assignments: 0 }
    }

    for (const rowAny of data || []) {
      const row: any = rowAny
      const uid = String(row.user_id)
      if (!histories[uid]) continue
      const role = row.role as 'R' | 'A' | 'C' | 'I'
      histories[uid].role_counts[role] += 1
      histories[uid].raci_history.push({
        role,
        task_name: row.tasks?.name,
        project_name: row.tasks?.projects?.name,
        task_id: row.tasks?.id
      })
    }

    for (const uid of userIds) {
      const c = histories[uid].role_counts
      histories[uid].total_assignments = (c.R + c.A + c.C + c.I)
    }

    return NextResponse.json({ histories })
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


