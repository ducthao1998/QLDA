import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user: authUser } } = await supabase.auth.getUser()

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get tasks with related data for optimization
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select(`
        *,
        project:project_id (
          name
        ),
        users:assigned_to (
          full_name,
          avatar_url
        ),
        task_progress (
          planned_start,
          planned_finish,
          actual_start,
          actual_finish,
          status_snapshot
        ),
        user_task_perf (
          planned_hours,
          actual_hours,
          on_time,
          qual_score
        )
      `)
      .order("weight", { ascending: false })

    if (error) {
      console.error("Error fetching tasks:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(tasks)
  } catch (error) {
    console.error("Error in GET /api/tasks:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

// SQL commands for Supabase
export const TASKS_TABLE_SQL = `
-- Disable RLS for tasks table
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Project members can view tasks" ON tasks;
DROP POLICY IF EXISTS "Project members can create tasks" ON tasks;
DROP POLICY IF EXISTS "Project admins can manage tasks" ON tasks;

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  min_duration_hours INTEGER NOT NULL,
  max_duration_hours INTEGER NOT NULL,
  due_date DATE,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  assigned_to UUID REFERENCES users(id),
  max_retries INTEGER DEFAULT 3,
  dependencies JSONB DEFAULT '[]'::jsonb,
  optimization_score NUMERIC DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  is_imported BOOLEAN DEFAULT FALSE,
  import_date TIMESTAMP WITH TIME ZONE
);
`; 