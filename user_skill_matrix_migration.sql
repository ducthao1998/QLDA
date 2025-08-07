-- Migration script để tạo user_skill_matrix view
-- Chạy script này trong Supabase SQL Editor

-- Tạo view user_skill_matrix từ worklogs và task_skills
CREATE OR REPLACE VIEW user_skill_matrix AS
SELECT 
    w.user_id,
    u.full_name,
    ts.skill_id,
    s.name as skill_name,
    s.field as skill_field,
    COUNT(DISTINCT w.task_id) as completed_tasks_count,
    SUM(CEIL(w.spent_hours / 8.0)) as total_experience_days,
    MAX(w.log_date) as last_activity_date
FROM worklogs w
JOIN users u ON w.user_id = u.id
JOIN tasks t ON w.task_id = t.id
JOIN task_skills ts ON t.id = ts.task_id
JOIN skills s ON ts.skill_id = s.id
GROUP BY w.user_id, u.full_name, ts.skill_id, s.name, s.field
ORDER BY w.user_id, ts.skill_id;

-- Tạo function để refresh materialized view (nếu cần)
CREATE OR REPLACE FUNCTION refresh_user_skill_matrix()
RETURNS void AS $$
BEGIN
    -- Nếu sử dụng materialized view thì uncomment dòng dưới
    -- REFRESH MATERIALIZED VIEW user_skill_matrix;
    
    -- Với regular view, không cần refresh
    RAISE NOTICE 'User skill matrix view refreshed successfully';
END;
$$ LANGUAGE plpgsql;

-- Tạo trigger để tự động cập nhật khi có worklog mới
CREATE OR REPLACE FUNCTION trigger_refresh_user_skill_matrix()
RETURNS trigger AS $$
BEGIN
    -- Log the event
    RAISE NOTICE 'Worklog changed, user skill matrix will be automatically updated on next query';
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Tạo trigger trên bảng worklogs
DROP TRIGGER IF EXISTS trigger_worklog_user_skill_matrix ON worklogs;
CREATE TRIGGER trigger_worklog_user_skill_matrix
    AFTER INSERT OR UPDATE OR DELETE ON worklogs
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_user_skill_matrix();

-- Tạo trigger trên bảng task_skills
DROP TRIGGER IF EXISTS trigger_task_skills_user_skill_matrix ON task_skills;
CREATE TRIGGER trigger_task_skills_user_skill_matrix
    AFTER INSERT OR UPDATE OR DELETE ON task_skills
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_user_skill_matrix();

-- Thêm comment cho view
COMMENT ON VIEW user_skill_matrix IS 'View tính toán ma trận kỹ năng người dùng từ worklogs và task_skills';

-- Grant permissions
GRANT SELECT ON user_skill_matrix TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_user_skill_matrix() TO authenticated;
