# Hướng dẫn khắc phục lỗi cơ sở dữ liệu

## Các lỗi đang gặp phải

### 1. Lỗi bảng `user_skills` không tồn tại (cần thiết cho API quản lý kỹ năng)
```
Error fetching user skills: {
  code: 'PGRST205',
  message: "Could not find the table 'public.user_skills' in the schema cache"
}
```

### 2. Lỗi cột `algorithm_used` không tồn tại trong bảng `schedule_runs`
```
Error creating schedule run: {
  code: 'PGRST204',
  message: "Could not find the 'algorithm_used' column of 'schedule_runs' in the schema cache"
}
```

## Cách khắc phục

### Bước 1: Chạy script migration

1. Mở **Supabase Dashboard**
2. Vào **SQL Editor**
3. Copy và paste toàn bộ nội dung từ file `fix_database_schema.sql`
4. Nhấn **Run** để thực thi script

### Bước 2: Kiểm tra kết quả

Sau khi chạy script, bạn sẽ có:

- ✅ Bảng `user_skills` cho API quản lý kỹ năng người dùng
- ✅ View `user_skill_matrix` cho việc đọc thông tin kỹ năng (đã tồn tại)
- ✅ Bảng `schedule_runs` với cột `algorithm_used`
- ✅ Bảng `schedule_details` để lưu chi tiết lịch trình
- ✅ Các index và trigger tự động
- ✅ Row Level Security (RLS) policies
- ✅ Permissions cho authenticated users

### Bước 3: Kiểm tra ứng dụng

1. Refresh trang web
2. Thử lại chức năng tối ưu hóa lịch trình
3. Kiểm tra console để đảm bảo không còn lỗi

## Cấu trúc bảng được tạo

### Bảng `user_skills` (cho quản lý kỹ năng)
```sql
- id: SERIAL PRIMARY KEY
- user_id: UUID (tham chiếu users.id)
- skill_id: INTEGER (tham chiếu skills.id)
- level: INTEGER (0-5, mức độ thành thạo)
- created_at, updated_at: TIMESTAMP
```

### View `user_skill_matrix` (đã tồn tại, cho đọc dữ liệu)
```sql
- user_id: UUID
- full_name: TEXT
- skill_id: INTEGER
- skill_name: TEXT
- skill_field: TEXT
- completed_tasks_count: INTEGER
- total_experience_days: NUMERIC
- last_activity_date: TIMESTAMP
```

### Bảng `schedule_runs`
```sql
- id: UUID PRIMARY KEY
- project_id: UUID (tham chiếu projects.id)
- algorithm_used: TEXT (genetic, cpm, resource_leveling)
- objective_type: TEXT
- status: TEXT (running, completed, failed)
- makespan_hours: NUMERIC
- resource_utilization: NUMERIC
- optimization_score: NUMERIC
- created_by: UUID (tham chiếu users.id)
- created_at, updated_at: TIMESTAMP
```

### Bảng `schedule_details`
```sql
- id: UUID PRIMARY KEY
- schedule_run_id: UUID (tham chiếu schedule_runs.id)
- task_id: TEXT (tham chiếu tasks.id)
- assigned_user: UUID (tham chiếu users.id)
- start_ts, finish_ts: TIMESTAMP
- resource_allocation: NUMERIC
- created_at: TIMESTAMP
```

## Lưu ý

- **Bảng `user_skills`**: Dùng cho API quản lý kỹ năng (INSERT, UPDATE, DELETE)
- **View `user_skill_matrix`**: Dùng cho việc đọc thông tin kỹ năng (SELECT)
- API optimize sẽ ưu tiên sử dụng view, fallback về bảng nếu cần
- Script tạo đầy đủ các bảng còn thiếu
- Các chức năng tối ưu hóa sẽ hoạt động bình thường sau khi chạy script

## Troubleshooting

Nếu vẫn gặp lỗi sau khi chạy script:

1. Kiểm tra quyền truy cập database
2. Đảm bảo đã đăng nhập vào Supabase với quyền admin
3. Kiểm tra log trong Supabase Dashboard
4. Restart ứng dụng nếu cần
