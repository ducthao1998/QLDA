-- Create unique index for task_raci table to support upsert operations
-- This ensures that each task can only have one user per role
CREATE UNIQUE INDEX IF NOT EXISTS uniq_task_role ON task_raci(task_id, role);
