# Hướng Dẫn: Quản Lý Profile

## Mục Lục
1. [Tổng quan](#1-tổng-quan)
2. [Các file liên quan](#2-các-file-liên-quan)
3. [Thông tin profile](#3-thông-tin-profile)
4. [Thống kê cá nhân](#4-thống-kê-cá-nhân)
5. [Cập nhật thông tin](#5-cập-nhật-thông-tin)
6. [Đổi mật khẩu](#6-đổi-mật-khẩu)
7. [API liên quan](#7-api-liên-quan)

---

## 1. Tổng quan

Trang Profile cho phép người dùng:
- Xem thông tin cá nhân
- Xem thống kê công việc
- Xem kỹ năng và kinh nghiệm
- Cập nhật thông tin
- Đổi mật khẩu

---

## 2. Các file liên quan

### 2.1. Trang

```
src/app/dashboard/profile/
└── page.tsx                    ← Trang profile chính
```

### 2.2. API Routes

```
src/app/api/profile/
├── update/
│   └── route.ts                ← GET info, PUT cập nhật
├── stats/
│   └── route.ts                ← Thống kê cá nhân
├── skills/
│   └── route.ts                ← Kỹ năng cá nhân
├── projects/
│   └── route.ts                ← Dự án tham gia
└── change-password/
    └── route.ts                ← Đổi mật khẩu
```

---

## 3. Thông tin profile

### 3.1. Cấu trúc dữ liệu

```typescript
interface UserProfile {
  id: string
  full_name: string
  email: string
  phone_number: string | null
  position: string
  org_unit: string
  max_concurrent_tasks: number
  created_at: string
}
```

### 3.2. Giao diện

```
┌────────────────────────────────────────────────────────────────┐
│  Profile                                         [Chỉnh sửa]   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────┐                                                   │
│  │  Avatar │  Nguyễn Văn A                                    │
│  │   NA    │  Quản lý - Phòng IT                              │
│  └─────────┘  nguyen.a@company.vn                             │
│               0123456789                                       │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  Thống kê công việc                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Dự án   │ │ Task     │ │ Hoàn thành│ │ Đúng hạn │         │
│  │    5    │ │   45     │ │   38     │ │   92%    │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  Kỹ năng                                                       │
│  React (8 task) | Node.js (5 task) | Database (3 task)        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Thống kê cá nhân

### 4.1. Các chỉ số

| Chỉ số | Mô tả |
|--------|-------|
| **Số dự án** | Dự án đang tham gia |
| **Tổng task** | Task được gán (vai trò R) |
| **Task hoàn thành** | Task có status = done |
| **Task đang làm** | Task có status = in_progress |
| **Tỷ lệ hoàn thành** | % done / tổng |
| **Tỷ lệ đúng hạn** | % hoàn thành đúng deadline |
| **Workload** | Số task đang làm / max_concurrent |

### 4.2. Kỹ năng

Hiển thị từ `user_skill_matrix`:
- Tên kỹ năng
- Số task đã hoàn thành với skill đó
- Ngày hoạt động gần nhất

---

## 5. Cập nhật thông tin

### 5.1. Các trường có thể sửa

| Trường | Có thể sửa | Ghi chú |
|--------|------------|---------|
| Họ tên | ✓ | |
| Email | ✓ | Phải unique |
| Số điện thoại | ✓ | |
| Vị trí | ✗ | Chỉ admin sửa |
| Phòng ban | ✗ | Chỉ admin sửa |

### 5.2. Quy trình

```
[Nhấn "Chỉnh sửa"]
         ↓
[Hiện form với dữ liệu hiện tại]
         ↓
[Sửa thông tin]
         ↓
[Nhấn "Lưu"]
         ↓
[Gọi API PUT /api/profile/update]
         ↓
[Cập nhật database]
         ↓
[Hiện thông báo thành công]
```

---

## 6. Đổi mật khẩu

### 6.1. Giao diện

```
┌────────────────────────────────────────────┐
│  Đổi mật khẩu                              │
├────────────────────────────────────────────┤
│  Mật khẩu hiện tại: [__________________]   │
│                                            │
│  Mật khẩu mới:      [__________________]   │
│                                            │
│  Xác nhận mật khẩu: [__________________]   │
│                                            │
│  [Hủy]                    [Đổi mật khẩu]   │
└────────────────────────────────────────────┘
```

### 6.2. Validation

```typescript
// Mật khẩu mới:
- Tối thiểu 8 ký tự
- Phải khớp với xác nhận

// Mật khẩu hiện tại:
- Phải đúng với password trong database
```

### 6.3. Quy trình

```
[Nhập mật khẩu hiện tại]
         ↓
[Nhập mật khẩu mới + xác nhận]
         ↓
[Nhấn "Đổi mật khẩu"]
         ↓
[Gọi API POST /api/profile/change-password]
         ↓
[Supabase kiểm tra mật khẩu cũ]
         ↓
[Nếu đúng] → Cập nhật mật khẩu mới → Thành công
[Nếu sai] → Hiện lỗi "Mật khẩu hiện tại không đúng"
```

---

## 7. API liên quan

### 7.1. Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/profile/update` | Lấy thông tin profile |
| PUT | `/api/profile/update` | Cập nhật profile |
| GET | `/api/profile/stats` | Lấy thống kê cá nhân |
| GET | `/api/profile/skills` | Lấy kỹ năng cá nhân |
| GET | `/api/profile/projects` | Lấy dự án tham gia |
| POST | `/api/profile/change-password` | Đổi mật khẩu |

### 7.2. Ví dụ Response

#### Lấy thông tin profile

```http
GET /api/profile/update

Response:
{
  "profile": {
    "id": "uuid-123",
    "full_name": "Nguyễn Văn A",
    "email": "nguyen.a@company.vn",
    "phone_number": "0123456789",
    "position": "Quản lý",
    "org_unit": "Phòng IT",
    "max_concurrent_tasks": 3,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

#### Cập nhật profile

```http
PUT /api/profile/update
Content-Type: application/json

{
  "full_name": "Nguyễn Văn A (đã sửa)",
  "phone_number": "0987654321"
}

Response:
{
  "success": true,
  "message": "Cập nhật thành công"
}
```

#### Lấy thống kê

```http
GET /api/profile/stats

Response:
{
  "stats": {
    "total_projects": 5,
    "total_tasks": 45,
    "completed_tasks": 38,
    "in_progress_tasks": 5,
    "completion_rate": 0.844,
    "on_time_rate": 0.92,
    "current_workload": 2,
    "max_workload": 3
  }
}
```

#### Lấy kỹ năng

```http
GET /api/profile/skills

Response:
{
  "skills": [
    {
      "skill_id": 1,
      "skill_name": "React",
      "completed_tasks_count": 8,
      "last_activity_date": "2024-01-25"
    },
    {
      "skill_id": 2,
      "skill_name": "Node.js",
      "completed_tasks_count": 5,
      "last_activity_date": "2024-01-20"
    }
  ]
}
```

#### Đổi mật khẩu

```http
POST /api/profile/change-password
Content-Type: application/json

{
  "current_password": "oldpassword123",
  "new_password": "newpassword456"
}

Response (thành công):
{
  "success": true,
  "message": "Đổi mật khẩu thành công"
}

Response (thất bại):
{
  "success": false,
  "error": "Mật khẩu hiện tại không đúng"
}
```

---

## Workflow

### Xem profile

```
1. Vào Dashboard
2. Click avatar góc phải → "Profile"
3. Hoặc vào /dashboard/profile
4. Xem thông tin cá nhân
5. Xem thống kê công việc
6. Xem danh sách kỹ năng
```

### Cập nhật thông tin

```
1. Vào trang Profile
2. Nhấn "Chỉnh sửa"
3. Sửa các trường cần thiết
4. Nhấn "Lưu"
5. Xem thông báo thành công
```

### Đổi mật khẩu

```
1. Vào trang Profile
2. Nhấn "Đổi mật khẩu"
3. Nhập mật khẩu hiện tại
4. Nhập mật khẩu mới (2 lần)
5. Nhấn "Đổi mật khẩu"
6. Đăng nhập lại với mật khẩu mới
```

---

## Tóm tắt

1. **Thông tin cơ bản:** Tên, email, SĐT, vị trí, phòng ban
2. **Thống kê:** Số dự án, task, tỷ lệ hoàn thành, đúng hạn
3. **Kỹ năng:** Tự động cập nhật từ task đã hoàn thành
4. **Cập nhật:** Chỉ sửa được tên, email, SĐT
5. **Đổi mật khẩu:** Cần nhập mật khẩu cũ đúng
