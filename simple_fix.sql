-- Quick create for algorithm settings (minimal)
create table if not exists public.algorithm_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  algorithm text not null default 'multi_project_cpm',
  objective_type text not null default 'time',
  objective_weights jsonb not null default '{"time_weight":1, "resource_weight":0, "cost_weight":0}',
  constraints jsonb not null default '{"respect_dependencies":true, "respect_skills":true, "respect_availability":true}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

alter table public.algorithm_settings enable row level security;
create policy if not exists "settings_self"
  on public.algorithm_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Script đơn giản để tạo bảng schedule_runs và schedule_details
-- Chạy script này trong Supabase SQL Editor

-- 1. Tạo bảng schedule_runs
CREATE TABLE IF NOT EXISTS schedule_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  algorithm_used TEXT NOT NULL,
  objective_type TEXT NOT NULL,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  makespan_hours NUMERIC DEFAULT 0,
  resource_utilization NUMERIC DEFAULT 0,
  optimization_score NUMERIC DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tạo bảng schedule_details
CREATE TABLE IF NOT EXISTS schedule_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_run_id UUID REFERENCES schedule_runs(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  assigned_user UUID REFERENCES users(id),
  start_ts TIMESTAMP WITH TIME ZONE NOT NULL,
  finish_ts TIMESTAMP WITH TIME ZONE NOT NULL,
  resource_allocation NUMERIC DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tạo index
CREATE INDEX IF NOT EXISTS idx_schedule_runs_project_id ON schedule_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_schedule_runs_created_by ON schedule_runs(created_by);
CREATE INDEX IF NOT EXISTS idx_schedule_details_schedule_run_id ON schedule_details(schedule_run_id);
CREATE INDEX IF NOT EXISTS idx_schedule_details_task_id ON schedule_details(task_id);

-- 4. Thêm RLS policies đơn giản
ALTER TABLE schedule_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all authenticated users" ON schedule_runs
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow all authenticated users" ON schedule_details
  FOR ALL USING (auth.role() = 'authenticated');

-- 5. Grant permissions
GRANT ALL ON schedule_runs TO authenticated;
GRANT ALL ON schedule_details TO authenticated;
