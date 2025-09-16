-- Migration script để tạo bảng task_dependencies
-- Chạy script này trong Supabase SQL Editor

-- === Algorithm assignment preferences ===
-- 1) Add assignment_prefs JSONB with defaults (idempotent)
alter table if exists public.algorithm_settings
add column if not exists assignment_prefs jsonb
default jsonb_build_object(
  'enabled', true,
  'priority_mode', 'weighted',
  'default_max_concurrent_tasks', 2,
  'respect_user_caps', true,
  'min_confidence_R', 0.35,
  'unassigned_cost', 0.5,
  'allow_same_RA', false,
  'min_accountable_score', 0.6,
  'min_accountable_skill_fit', 0.3
);

-- 2) Optional GIN index for JSONB queries
create index if not exists algorithm_settings_assignment_prefs_gin
on public.algorithm_settings using gin(assignment_prefs jsonb_path_ops);

-- 3) Ensure a unique key on (user_id, project_id) for upsert
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'algorithm_settings_user_project_key'
  ) then
    create unique index algorithm_settings_user_project_key
    on public.algorithm_settings (user_id, project_id);
  end if;
end$$;

-- === CPM preferences ===
-- Add cpm_prefs JSONB with defaults to algorithm_settings (idempotent)
alter table if exists public.algorithm_settings
add column if not exists cpm_prefs jsonb
default jsonb_build_object(
  'criticality_threshold_days', 0,            -- slack <= threshold => critical
  'default_task_duration_days', 1,            -- fallback when task has no duration
  'allow_start_next_day', true,               -- start one day after the latest predecessor
  'free_float_warn_ratio', 0.25,              -- warn if free float < 25% of task duration
  'at_risk_ratio', 0.7,                       -- milestone at-risk threshold
  'delayed_ratio', 0.5,                       -- milestone delayed threshold
  'buffer_days_default', 0,                   -- default project buffer
  'objective_weights', jsonb_build_object(
    'time_weight', 1,
    'resource_weight', 0,
    'cost_weight', 0
  )
);

create index if not exists algorithm_settings_cpm_prefs_gin
on public.algorithm_settings using gin(cpm_prefs jsonb_path_ops);

-- === Global vs Project-scoped settings support ===
-- Allow NULL project_id for per-user global settings
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='algorithm_settings'
      and column_name='project_id' and is_nullable='NO'
  ) then
    alter table public.algorithm_settings alter column project_id drop not null;
  end if;
exception when others then null;
end$$;

-- Ensure unique rows: one per (user_id, project_id) when project-specific, and one per user when global
do $$
begin
  -- Drop previous broad unique index if present to avoid conflicts
  if exists (
    select 1 from pg_indexes where schemaname='public' and indexname='algorithm_settings_user_project_key'
  ) then
    drop index public.algorithm_settings_user_project_key;
  end if;
exception when others then null;
end$$;

-- Unique for project-scoped rows (project_id not null)
create unique index if not exists algorithm_settings_user_project_unique
on public.algorithm_settings (user_id, project_id)
where project_id is not null;

-- Unique for global rows (project_id null)
create unique index if not exists algorithm_settings_user_global_unique
on public.algorithm_settings (user_id)
where project_id is null;

-- === Per-user global settings table (no FK to projects) ===
create table if not exists public.algorithm_global_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  algorithm text not null default 'multi_project_cpm',
  objective_type text not null default 'time',
  objective_weights jsonb not null default jsonb_build_object('time_weight',1,'resource_weight',0,'cost_weight',0),
  constraints jsonb not null default jsonb_build_object('respect_dependencies', true, 'respect_skills', true, 'respect_availability', true),
  assignment_prefs jsonb null,
  cpm_prefs jsonb null,
  updated_at timestamptz not null default now()
);

-- Tạo bảng task_dependencies
CREATE TABLE IF NOT EXISTS task_dependencies (
  id SERIAL PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Đảm bảo không có dependency trùng lặp
  UNIQUE(task_id, depends_on_id),
  
  -- Đảm bảo task không thể phụ thuộc vào chính nó
  CHECK (task_id != depends_on_id)
);

-- Tạo index để tối ưu hóa query
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on_id ON task_dependencies(depends_on_id);

-- Tạo trigger để tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_task_dependencies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_task_dependencies_updated_at
  BEFORE UPDATE ON task_dependencies
  FOR EACH ROW
  EXECUTE FUNCTION update_task_dependencies_updated_at();

-- Thêm RLS (Row Level Security) policies nếu cần
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

-- Policy cho phép users xem dependencies của tasks trong cùng org_unit
CREATE POLICY "Users can view task dependencies in same org_unit" ON task_dependencies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t1
      JOIN projects p1 ON t1.project_id = p1.id
      JOIN users u1 ON p1.created_by = u1.id
      WHERE t1.id = task_dependencies.task_id
      AND u1.org_unit = (
        SELECT org_unit FROM users WHERE id = auth.uid()
      )
    )
  );

-- Policy cho phép users tạo dependencies cho tasks trong cùng org_unit
CREATE POLICY "Users can create task dependencies in same org_unit" ON task_dependencies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t1
      JOIN projects p1 ON t1.project_id = p1.id
      JOIN users u1 ON p1.created_by = u1.id
      WHERE t1.id = task_dependencies.task_id
      AND u1.org_unit = (
        SELECT org_unit FROM users WHERE id = auth.uid()
      )
    )
  );

-- Policy cho phép users cập nhật dependencies của tasks trong cùng org_unit
CREATE POLICY "Users can update task dependencies in same org_unit" ON task_dependencies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tasks t1
      JOIN projects p1 ON t1.project_id = p1.id
      JOIN users u1 ON p1.created_by = u1.id
      WHERE t1.id = task_dependencies.task_id
      AND u1.org_unit = (
        SELECT org_unit FROM users WHERE id = auth.uid()
      )
    )
  );

-- Policy cho phép users xóa dependencies của tasks trong cùng org_unit
CREATE POLICY "Users can delete task dependencies in same org_unit" ON task_dependencies
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tasks t1
      JOIN projects p1 ON t1.project_id = p1.id
      JOIN users u1 ON p1.created_by = u1.id
      WHERE t1.id = task_dependencies.task_id
      AND u1.org_unit = (
        SELECT org_unit FROM users WHERE id = auth.uid()
      )
    )
  );

-- Thêm comment cho bảng
COMMENT ON TABLE task_dependencies IS 'Bảng lưu trữ mối quan hệ phụ thuộc giữa các công việc';
COMMENT ON COLUMN task_dependencies.task_id IS 'ID của công việc phụ thuộc';
COMMENT ON COLUMN task_dependencies.depends_on_id IS 'ID của công việc mà task_id phụ thuộc vào'; 

-- ================================
-- Schedule Runs & Details (Draft → Approved → Active)
-- ================================

-- 1) Bảng schedule_runs: đại diện cho một lần tối ưu hóa lịch
create table if not exists public.schedule_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null default 'Lịch tối ưu',
  algorithm_used text not null,
  status text not null default 'draft' check (status in ('draft','approved','archived')),
  is_active boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  parameters jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  explanation text
);

-- Đảm bảo mỗi project chỉ có 1 run đang active
create unique index if not exists schedule_runs_one_active_per_project
  on public.schedule_runs(project_id) where (is_active);

create index if not exists schedule_runs_project_status_idx
  on public.schedule_runs(project_id, status, created_at desc);

-- 2) Bảng schedule_details: chi tiết lịch từng task trong một run
create table if not exists public.schedule_details (
  id uuid primary key default gen_random_uuid(),
  schedule_run_id uuid not null references public.schedule_runs(id) on delete cascade,
  task_id text not null references public.tasks(id) on delete cascade,
  assigned_user uuid null references public.users(id) on delete set null,
  start_ts timestamptz not null,
  finish_ts timestamptz not null,
  confidence numeric not null default 0,
  experience_score numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists schedule_details_run_idx on public.schedule_details(schedule_run_id);
create index if not exists schedule_details_task_idx on public.schedule_details(task_id);
create index if not exists schedule_details_user_idx on public.schedule_details(assigned_user);

-- 3) (tuỳ chọn) cột trỏ nhanh run active trên projects
alter table public.projects
  add column if not exists active_schedule_run_id uuid
  references public.schedule_runs(id) on delete set null;

-- 4) Bật RLS và policy cơ bản
alter table public.schedule_runs enable row level security;
alter table public.schedule_details enable row level security;

-- Người tạo run xem/sửa run; mọi user đăng nhập được xem run active
create policy if not exists "run_select_creator_or_active"
on public.schedule_runs
for select
using (
  is_active = true OR created_by = auth.uid()
);

create policy if not exists "run_insert_creator_only"
on public.schedule_runs
for insert
with check (created_by = auth.uid());

create policy if not exists "run_update_creator_only"
on public.schedule_runs
for update
using (created_by = auth.uid());

create policy if not exists "run_delete_creator_only"
on public.schedule_runs
for delete
using (created_by = auth.uid());

-- Details: xem nếu run active hoặc là creator; CUD nếu là creator
create policy if not exists "details_select_by_run_visibility"
on public.schedule_details
for select
using (
  exists (
    select 1 from public.schedule_runs r
    where r.id = schedule_details.schedule_run_id
      and (r.is_active = true or r.created_by = auth.uid())
  )
);

create policy if not exists "details_cud_creator_only"
on public.schedule_details
for all
using (
  exists (
    select 1 from public.schedule_runs r
    where r.id = schedule_details.schedule_run_id
      and r.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.schedule_runs r
    where r.id = schedule_details.schedule_run_id
      and r.created_by = auth.uid()
  )
);

-- ================================
-- DEV OVERRIDE: Tắt RLS cho schedule tables (để tránh lỗi trong môi trường dev)
-- Bật lại bằng cách đổi DISABLE -> ENABLE khi cần siết bảo mật
-- ================================
create extension if not exists pgcrypto;
alter table if exists public.schedule_runs disable row level security;
alter table if exists public.schedule_details disable row level security;