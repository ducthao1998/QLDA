-- Migration script để tạo bảng task_dependencies
-- Chạy script này trong Supabase SQL Editor

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