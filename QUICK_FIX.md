# Khắc phục nhanh lỗi Gantt Chart

## Vấn đề
- Bảng Gantt không hiển thị
- Lỗi `column "created_by" does not exist`
- API optimize không hoạt động

## Giải pháp nhanh

### Bước 1: Chạy script migration đơn giản

1. Mở **Supabase Dashboard** → **SQL Editor**
2. Copy toàn bộ nội dung từ file `simple_fix.sql`
3. Paste và Run

### Bước 2: Kiểm tra kết quả

Sau khi chạy script, bạn sẽ có:
- ✅ Bảng `schedule_runs` với cột `algorithm_used`
- ✅ Bảng `schedule_details` 
- ✅ Permissions cho authenticated users

### Bước 3: Test Gantt Chart

1. Refresh trang web
2. Vào **Dashboard** → **Gantt**
3. Chọn một dự án
4. Kiểm tra xem biểu đồ có hiển thị không

## Nếu vẫn không hiển thị

### Kiểm tra Console
1. Mở Developer Tools (F12)
2. Vào tab Console
3. Xem có lỗi gì không

### Kiểm tra Network
1. Vào tab Network
2. Tìm request đến `/api/projects/[id]/gantt`
3. Xem response có dữ liệu không

### Debug API
Nếu API trả về lỗi, kiểm tra:
- Dự án có tasks không
- Tasks có `start_date` và `end_date` không
- Database có đủ dữ liệu không

## Lưu ý
- Chỉ sử dụng `user_skill_matrix` view (không cần bảng `user_skills`)
- API đã được sửa để xử lý lỗi gracefully
- Script migration đơn giản, không ảnh hưởng dữ liệu hiện có
