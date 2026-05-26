# Hướng Dẫn: Quản Lý Team

## Mục Lục
1. [Tổng quan](#1-tổng-quan)
2. [Cấu trúc dữ liệu người dùng](#2-cấu-trúc-dữ-liệu-người-dùng)
3. [Các file liên quan](#3-các-file-liên-quan)
4. [Danh sách thành viên](#4-danh-sách-thành-viên)
5. [Thêm thành viên mới](#5-thêm-thành-viên-mới)
6. [Thống kê hiệu suất](#6-thống-kê-hiệu-suất)
7. [Quản lý khối lượng công việc](#7-quản-lý-khối-lượng-công-việc)
8. [Ma trận kỹ năng team](#8-ma-trận-kỹ-năng-team)
9. [API liên quan](#9-api-liên-quan)

---

## 1. Tổng quan

Quản lý Team cho phép:
- Xem danh sách và thông tin thành viên
- Thêm/sửa thông tin nhân sự
- Theo dõi hiệu suất làm việc
- Quản lý khối lượng công việc
- Xem ma trận kỹ năng của team

---

## 2. Cấu trúc dữ liệu người dùng

### 2.1. Bảng `users`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | uuid | Mã định danh (liên kết auth.users) |
| `full_name` | text | Họ và tên |
| `position` | text | Vị trí/Chức vụ |
| `org_unit` | text | Phòng/Ban/Đơn vị |
| `email` | text | Email công việc |
| `phone_number` | text | Số điện thoại |
| `max_concurrent_tasks` | integer | Số task tối đa cùng lúc |
| `created_at` | timestamp | Thời điểm tạo |

### 2.2. Các vị trí (position)

| Vị trí | Quyền hạn |
|--------|-----------|
| **Quản lý** | Toàn quyền: thêm/sửa/xóa user, quản lý skill |
| **Trưởng phòng** | Xem thống kê, quản lý dự án |
| **Chỉ huy** | Xem thống kê team, phân công task |
| **Cán bộ** | Xem thông tin, sửa profile cá nhân |

### 2.3. Interface TypeScript

```typescript
interface User {
  id: string
  full_name: string
  position: string
  org_unit: string
  email: string
  phone_number: string | null
  max_concurrent_tasks: number
  created_at: string
}
```

---

## 3. Các file liên quan

### 3.1. Trang

```
src/app/dashboard/team/
└── page.tsx                    ← Trang quản lý team

src/app/dashboard/profile/
└── page.tsx                    ← Trang profile cá nhân
```

### 3.2. Components

```
src/components/team/
├── team-list.tsx               ← Danh sách thành viên
├── add-user-dialog.tsx         ← Dialog thêm user
├── edit-user-dialog.tsx        ← Dialog sửa user
├── skill-matrix.tsx            ← Ma trận kỹ năng
├── user-performance.tsx        ← Biểu đồ hiệu suất
└── workload-dashboard.tsx      ← Dashboard khối lượng công việc
```

### 3.3. API Routes

```
src/app/api/
├── users/
│   ├── route.ts                ← GET (danh sách), POST (tạo mới)
│   └── [id]/
│       └── route.ts            ← PATCH (cập nhật)
├── user-performance/
│   └── route.ts                ← Lấy thống kê hiệu suất
├── workload/
│   └── route.ts                ← Lấy khối lượng công việc
├── team/
│   └── skill-matrix/
│       └── route.ts            ← Ma trận kỹ năng team
└── profile/
    ├── stats/
    │   └── route.ts            ← Thống kê cá nhân
    ├── skills/
    │   └── route.ts            ← Kỹ năng cá nhân
    └── update/
        └── route.ts            ← Cập nhật profile
```

---

## 4. Danh sách thành viên

**File:** `src/components/team/team-list.tsx`

### 4.1. Giao diện

```
┌────────────────────────────────────────────────────────────────┐
│  Quản Lý Nhân Sự                          [+ Thêm Nhân Sự]    │
├────────────────────────────────────────────────────────────────┤
│  ┌──────┬───────────────┬──────────┬──────────────┬─────────┐ │
│  │Avatar│ Tên           │ Vị trí   │ Phòng ban    │ Hành động│ │
│  ├──────┼───────────────┼──────────┼──────────────┼─────────┤ │
│  │ NA   │ Nguyễn Văn A  │ Quản lý  │ Phòng IT     │   ⋮     │ │
│  │ TB   │ Trần Thị B    │ Cán bộ   │ Phòng Kỹ thuật│   ⋮     │ │
│  │ LC   │ Lê Minh C     │ Chỉ huy  │ Phòng Dự án  │   ⋮     │ │
│  └──────┴───────────────┴──────────┴──────────────┴─────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### 4.2. Menu hành động (⋮)

- **Xem chi tiết:** Mở trang profile
- **Chỉnh sửa:** Mở dialog sửa thông tin
- **Xem công việc:** Xem danh sách task được gán
- **Xem dự án:** Xem các dự án tham gia
- **Vô hiệu hóa:** Đánh dấu không hoạt động

### 4.3. Phân quyền xem

| Quyền | Quản lý | Chỉ huy | Cán bộ |
|-------|---------|---------|--------|
| Xem danh sách | ✓ | ✓ | ✓ |
| Thêm thành viên | ✓ | ✗ | ✗ |
| Sửa thông tin | ✓ | ✗ | Chỉ bản thân |
| Vô hiệu hóa | ✓ | ✗ | ✗ |

---

## 5. Thêm thành viên mới

**File:** `src/components/team/add-user-dialog.tsx`

### 5.1. Form thêm thành viên

```
┌────────────────────────────────────────────┐
│  Thêm Nhân Sự Mới                          │
├────────────────────────────────────────────┤
│  Họ và tên: [________________________]     │
│                                            │
│  Vị trí:    [Quản lý ▼]                   │
│                                            │
│  Số điện thoại: [________________________] │
│                                            │
│  Email:    [________________________]      │
│                                            │
│  Phòng/Ban: [________________________]     │
│                                            │
│  [Hủy]                    [Thêm nhân sự]   │
└────────────────────────────────────────────┘
```

### 5.2. Quy trình thêm

```
[Nhấn "Thêm Nhân Sự"]
         ↓
[Điền form thông tin]
         ↓
[Nhấn "Thêm nhân sự"]
         ↓
[Hệ thống kiểm tra:]
- Người dùng có quyền không? (phải là Quản lý)
- Các trường bắt buộc đã điền?
- Email đã tồn tại chưa?
         ↓
[Tạo tài khoản:]
- Tạo auth account (Supabase Auth)
- Tạo profile trong bảng users
- Gửi email xác nhận
         ↓
[Hiện thông báo thành công]
[Làm mới danh sách]
```

### 5.3. Dữ liệu gửi lên

```typescript
{
  full_name: "Nguyễn Văn A",
  position: "Cán bộ",
  phone_number: "0123456789",
  email: "nguyen.a@company.vn",
  org_unit: "Phòng IT",
  password: "password123"  // Mật khẩu mặc định
}
```

**Lưu ý:** User sẽ đổi mật khẩu sau khi đăng nhập lần đầu.

---

## 6. Thống kê hiệu suất

**File:** `src/components/team/user-performance.tsx`

### 6.1. Các chỉ số

| Chỉ số | Mô tả | Phạm vi |
|--------|-------|---------|
| **Tỷ lệ đúng hạn** (pct_on_time) | % task hoàn thành đúng/trước hạn | 0-100% |
| **Điểm chất lượng** (avg_quality) | Chất lượng công việc trung bình | 1-5 |
| **Điểm hiệu suất** (perf_score) | Điểm tổng hợp | 0-100% |

### 6.2. Cách tính

#### Tỷ lệ đúng hạn
```
pct_on_time = (Số task đúng hạn / Tổng số task hoàn thành) × 100%

Ví dụ: 17 task đúng hạn / 20 task = 85%
```

#### Điểm chất lượng
```
avg_quality = Trung bình điểm đánh giá (1-5)

Ví dụ: (4 + 5 + 4 + 5 + 4) / 5 = 4.4
```

#### Điểm hiệu suất
```
perf_score = Kết hợp các yếu tố (tỷ lệ đúng hạn, chất lượng, v.v.)

Phân loại:
  80-100%: Xuất sắc
  60-80%:  Tốt
  40-60%:  Trung bình
  < 40%:   Cần cải thiện
```

### 6.3. Biểu đồ hiển thị

1. **Biểu đồ tròn:** Phân bố hiệu suất team
   - Xuất sắc: màu xanh
   - Tốt: màu vàng
   - Trung bình: màu cam
   - Cần cải thiện: màu đỏ

2. **Biểu đồ đường:** Top 10 nhân viên
   - Trục X: Tên nhân viên
   - Trục Y: Tỷ lệ đúng hạn và điểm chất lượng

3. **Bảng xếp hạng:** Chi tiết từng người
   - Thanh progress hiển thị trực quan
   - Có thể sắp xếp theo cột

---

## 7. Quản lý khối lượng công việc

**File:** `src/components/team/workload-dashboard.tsx`

### 7.1. Max Concurrent Tasks

**Định nghĩa:** Số task tối đa một người có thể làm cùng lúc.

**Mục đích:**
- Tránh quá tải cho nhân viên
- Đảm bảo chất lượng công việc
- Hỗ trợ phân công tự động

**Cách sử dụng:**
```typescript
// Khi phân công task
const freeUsers = availableUsers.filter(
  user => user.current_workload < user.max_concurrent_tasks
)

// Ví dụ:
// User A: max = 3, đang làm = 1 → Còn nhận được 2 task
// User B: max = 2, đang làm = 2 → Không nhận thêm được
```

### 7.2. Dashboard khối lượng

```
┌────────────────────────────────────────────────────────────────┐
│  Khối Lượng Công Việc        [Tuần ▼] [Tháng] [Quý]           │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Nguyễn Văn A                                                  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Capacity: ████████████░░░░░░░░ 60%                       │ │
│  │ Active Tasks: 3 | Hours: 45h                              │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Trần Thị B                                        [QUÁ TẢI]  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Capacity: ██████████████████████ 110%                    │ │
│  │ Active Tasks: 5 | Hours: 72h                              │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 7.3. Các chỉ số workload

| Chỉ số | Mô tả |
|--------|-------|
| **Capacity** | % sử dụng so với giới hạn |
| **Active Tasks** | Số task đang làm (todo, in_progress, blocked, review) |
| **Total Hours** | Tổng giờ dự kiến |
| **Overloaded** | Badge cảnh báo nếu vượt giới hạn |

### 7.4. Cách tính utilization

```
Utilization = (Số task đang làm / max_concurrent_tasks) × 100%

Ví dụ:
- Max = 3, đang làm = 2 → 66.7%
- Max = 2, đang làm = 3 → 150% (QUÁ TẢI)
```

### 7.5. Chọn khoảng thời gian

| Lựa chọn | Mô tả |
|----------|-------|
| Tuần | Task trong 7 ngày tới |
| Tháng | Task trong 30 ngày tới |
| Quý | Task trong 90 ngày tới |

---

## 8. Ma trận kỹ năng team

**File:** `src/components/team/skill-matrix.tsx`

### 8.1. Cấu trúc ma trận

```
┌──────────────────┬────────┬─────────┬─────────┬────────┐
│ Nhân sự          │ React  │ Node.js │ AutoCAD │ Python │
├──────────────────┼────────┼─────────┼─────────┼────────┤
│ Nguyễn Văn A     │ 5 task │    -    │    -    │ 2 task │
│ Trần Thị B       │ 8 task │ 6 task  │    -    │    -   │
│ Lê Minh C        │   -    │ 4 task  │ 3 task  │ 4 task │
└──────────────────┴────────┴─────────┴─────────┴────────┘
```

**Cách đọc:**
- Hàng = Thành viên
- Cột = Kỹ năng
- Giá trị = Số task đã hoàn thành với kỹ năng đó
- "-" = Chưa có kinh nghiệm

### 8.2. Mục đích sử dụng

1. **Xác định người phù hợp:** Ai có kinh nghiệm với skill cần thiết?
2. **Phát hiện thiếu hụt:** Skill nào team chưa có ai giỏi?
3. **Lập kế hoạch đào tạo:** Ai cần được đào tạo thêm?
4. **Phân công thông minh:** Hỗ trợ auto-assign

### 8.3. Tabs trong giao diện

**Tab 1: Quản lý kỹ năng**
- Danh sách tất cả skill
- Thêm/Sửa/Xóa skill
- Hiển thị lĩnh vực

**Tab 2: Ma trận kỹ năng team**
- Bảng ma trận đầy đủ
- Hiển thị kinh nghiệm từng người
- Nhận diện nhanh năng lực team

---

## 9. API liên quan

### 9.1. Quản lý người dùng

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/users` | Lấy danh sách user |
| POST | `/api/users` | Tạo user mới |
| PATCH | `/api/users/[id]` | Cập nhật user |

### 9.2. Thống kê và báo cáo

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/user-performance` | Thống kê hiệu suất |
| GET | `/api/workload?period=week` | Khối lượng công việc |
| GET | `/api/team/skill-matrix` | Ma trận kỹ năng team |

### 9.3. Profile cá nhân

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/profile/stats` | Thống kê cá nhân |
| GET | `/api/profile/skills` | Kỹ năng cá nhân |
| PATCH | `/api/profile/update` | Cập nhật profile |

### 9.4. Ví dụ Response

#### Danh sách user

```http
GET /api/users

Response:
{
  "users": [
    {
      "id": "uuid-1",
      "full_name": "Nguyễn Văn A",
      "position": "Quản lý",
      "org_unit": "Phòng IT",
      "email": "nguyen.a@company.vn",
      "phone_number": "0123456789",
      "max_concurrent_tasks": 3
    }
  ]
}
```

#### Thống kê hiệu suất

```http
GET /api/user-performance

Response:
{
  "performance": [
    {
      "id": "uuid-1",
      "full_name": "Nguyễn Văn A",
      "pct_on_time": 0.92,
      "avg_quality": 4.5,
      "perf_score": 0.88
    }
  ]
}
```

#### Khối lượng công việc

```http
GET /api/workload?period=month

Response:
{
  "workload": [
    {
      "user_id": "uuid-1",
      "full_name": "Nguyễn Văn A",
      "active_tasks": 3,
      "total_hours": 45,
      "max_concurrent_tasks": 5,
      "utilization": 0.6,
      "is_overloaded": false
    }
  ]
}
```

#### Ma trận kỹ năng

```http
GET /api/team/skill-matrix

Response:
[
  {
    "user_id": "uuid-1",
    "full_name": "Nguyễn Văn A",
    "position": "Senior Developer",
    "skills": [
      {
        "skill_id": 1,
        "skill_name": "React",
        "completed_tasks_count": 8,
        "last_activity_date": "2024-01-25"
      }
    ]
  }
]
```

---

## Workflow thường gặp

### Workflow 1: Thêm nhân sự mới

```
1. Manager vào Dashboard → Team
2. Nhấn "Thêm Nhân Sự"
3. Điền thông tin:
   - Họ tên: Nguyễn Văn D
   - Vị trí: Cán bộ
   - Phòng ban: Phòng Kỹ thuật
   - Email: nguyen.d@company.vn
   - SĐT: 0987654321
4. Nhấn "Thêm"
5. Hệ thống tạo tài khoản + gửi email
6. Danh sách tự động cập nhật
```

### Workflow 2: Kiểm tra năng lực team

```
1. Manager vào Dashboard → Team
2. Chuyển tab "Ma Trận Kỹ Năng"
3. Xem bảng ma trận:
   - Ai có kinh nghiệm React? → 3 người
   - Ai có thể làm AutoCAD? → Chỉ Lê C
   - Thiếu skill nào? → Docker (không ai có)
4. Quyết định:
   - Đào tạo thêm Docker cho team
   - Phân công React cho người kinh nghiệm
```

### Workflow 3: Cân bằng khối lượng công việc

```
1. Manager vào Dashboard → Team
2. Xem Workload Dashboard
3. Chọn khoảng thời gian: Tháng
4. Phát hiện:
   - Trần B: 110% (Quá tải!)
   - Nguyễn A: 40% (Còn rảnh)
5. Hành động:
   - Chuyển bớt task từ B sang A
   - Hoặc tăng max_concurrent_tasks của B
```

---

## Tóm tắt

1. **Danh sách team:** Xem, thêm, sửa thành viên
2. **Phân quyền:** Quản lý > Chỉ huy > Cán bộ
3. **Hiệu suất:** Theo dõi qua tỷ lệ đúng hạn, chất lượng, điểm tổng hợp
4. **Workload:** Kiểm soát số task tối đa, phát hiện quá tải
5. **Ma trận kỹ năng:** Nhìn nhanh năng lực cả team
6. **Dữ liệu tự động:** Kinh nghiệm tính từ task hoàn thành
