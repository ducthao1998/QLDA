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
