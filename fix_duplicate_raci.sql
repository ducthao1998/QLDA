-- Fix duplicate RACI entries before creating unique index

-- Step 1: Find and show duplicates
SELECT task_id, role, COUNT(*) as count
FROM task_raci 
GROUP BY task_id, role 
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Step 2: Keep only the latest entry for each (task_id, role) combination
-- Delete older duplicates based on created_at or id
WITH ranked_raci AS (
  SELECT id,
         task_id,
         role,
         ROW_NUMBER() OVER (PARTITION BY task_id, role ORDER BY created_at DESC, id DESC) as rn
  FROM task_raci
)
DELETE FROM task_raci 
WHERE id IN (
  SELECT id FROM ranked_raci WHERE rn > 1
);

-- Step 3: Now create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS uniq_task_role ON task_raci(task_id, role);
