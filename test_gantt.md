# Test Gantt Chart

## Các bước kiểm tra

### 1. Kiểm tra API Gantt
```bash
# Test API Gantt trực tiếp
curl -X GET "http://localhost:3000/api/projects/[PROJECT_ID]/gantt" \
  -H "Authorization: Bearer [YOUR_TOKEN]"
```

### 2. Kiểm tra Console
1. Mở Developer Tools (F12)
2. Vào tab Console
3. Xem có lỗi gì không

### 3. Kiểm tra Network
1. Vào tab Network
2. Tìm request đến `/api/projects/[id]/gantt`
3. Xem response có dữ liệu không

### 4. Debug dữ liệu
Nếu API trả về lỗi, kiểm tra:
- Dự án có tồn tại không
- Dự án có tasks không
- Tasks có đủ dữ liệu không

### 5. Test với dữ liệu mẫu
Nếu không có dữ liệu, tạo:
- 1 project với start_date và end_date
- 2-3 tasks với duration_days
- Task RACI assignments
- Task skills

## Lỗi thường gặp

### Lỗi "Invalid optimization algorithm"
✅ Đã sửa: Thay đổi algorithm type trong types.ts

### Lỗi "column created_by does not exist"
✅ Đã sửa: Chạy script simple_fix.sql

### Bảng Gantt trắng
Có thể do:
- API không trả về dữ liệu
- Tasks không có start_date/end_date
- Canvas không render đúng

## Debug steps
1. Chạy script `simple_fix.sql`
2. Refresh trang
3. Kiểm tra Console
4. Kiểm tra Network tab
5. Test API trực tiếp
