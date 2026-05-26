import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const projectId = params.id

  try {
    // 1) Get all task ids of this project
    const { data: tasks, error: tasksErr } = await supabase
      .from('tasks')
      .select('id')
      .eq('project_id', projectId)

    if (tasksErr) {
      return NextResponse.json({ error: tasksErr.message }, { status: 500 })
    }

    const taskIds = (tasks || []).map(t => t.id)
    if (taskIds.length === 0) {
      return NextResponse.json({ success: true, message: 'Không có công việc nào trong dự án', cleared: 0 })
    }

    // 2) Delete all RACI entries for these tasks
    const { error: delErr, count } = await supabase
      .from('task_raci')
      .delete({ count: 'exact' })
      .in('task_id', taskIds)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Đã gỡ phân công cho toàn bộ dự án', cleared: count || 0 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}


