-- Algorithm settings schema for Supabase
-- Run this in Supabase SQL editor

create table if not exists public.algorithm_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  algorithm text not null default 'multi_project_cpm',
  objective_type text not null default 'time',
  objective_weights jsonb not null default '{"time_weight":1, "resource_weight":0, "cost_weight":0}',
  constraints jsonb not null default '{"respect_dependencies":true, "respect_skills":true, "respect_availability":true}',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (user_id, project_id)
);

-- Ensure extension for triggers is available
create extension if not exists pgcrypto;

-- Updated at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_algorithm_settings_updated_at on public.algorithm_settings;
create trigger set_algorithm_settings_updated_at
before update on public.algorithm_settings
for each row execute function public.set_updated_at();

-- RLS policies
alter table public.algorithm_settings enable row level security;

do $$ begin
  perform 1 from pg_policies where schemaname = 'public' and tablename = 'algorithm_settings' and policyname = 'Allow user to manage own settings';
  if not found then
    create policy "Allow user to manage own settings"
      on public.algorithm_settings
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Optional: allow reading project-level defaults without user match (comment out if not needed)
-- create policy "Allow read project defaults"
--   on public.algorithm_settings
--   for select
--   using (project_id is null or auth.uid() = user_id);

-- Script để tạo các bảng còn thiếu cho tối ưu hóa lịch trình
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

-- Tạo index cho schedule_runs
CREATE INDEX IF NOT EXISTS idx_schedule_runs_project_id ON schedule_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_schedule_runs_created_by ON schedule_runs(created_by);

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

-- Tạo index cho schedule_details
CREATE INDEX IF NOT EXISTS idx_schedule_details_schedule_run_id ON schedule_details(schedule_run_id);
CREATE INDEX IF NOT EXISTS idx_schedule_details_task_id ON schedule_details(task_id);

-- 3. Tạo trigger để tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tạo trigger cho schedule_runs
DROP TRIGGER IF EXISTS trigger_update_schedule_runs_updated_at ON schedule_runs;
CREATE TRIGGER trigger_update_schedule_runs_updated_at
  BEFORE UPDATE ON schedule_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Thêm RLS (Row Level Security) policies
ALTER TABLE schedule_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_details ENABLE ROW LEVEL SECURITY;

-- Policy cho schedule_runs - cho phép tất cả authenticated users
CREATE POLICY "Authenticated users can manage schedule runs" ON schedule_runs
  FOR ALL USING (auth.role() = 'authenticated');

-- Policy cho schedule_details - cho phép tất cả authenticated users
CREATE POLICY "Authenticated users can manage schedule details" ON schedule_details
  FOR ALL USING (auth.role() = 'authenticated');

-- 5. Thêm comments
COMMENT ON TABLE schedule_runs IS 'Bảng lưu trữ các lần chạy tối ưu hóa lịch trình';
COMMENT ON COLUMN schedule_runs.algorithm_used IS 'Thuật toán được sử dụng (genetic, cpm, resource_leveling)';
COMMENT ON COLUMN schedule_runs.objective_type IS 'Loại mục tiêu tối ưu hóa';

COMMENT ON TABLE schedule_details IS 'Bảng lưu trữ chi tiết lịch trình sau tối ưu hóa';

-- 6. Grant permissions
GRANT ALL ON schedule_runs TO authenticated;
GRANT ALL ON schedule_details TO authenticated;
