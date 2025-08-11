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
