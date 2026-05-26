# Hướng Dẫn: Quản Lý Kỹ Năng (Skills)

## Mục Lục
1. [Tổng quan](#1-tổng-quan)
2. [Cấu trúc dữ liệu](#2-cấu-trúc-dữ-liệu)
3. [Các file liên quan](#3-các-file-liên-quan)
4. [Tạo và quản lý kỹ năng](#4-tạo-và-quản-lý-kỹ-năng)
5. [Gán kỹ năng cho người dùng](#5-gán-kỹ-năng-cho-người-dùng)
6. [Gán kỹ năng cho công việc](#6-gán-kỹ-năng-cho-công-việc)
7. [Theo dõi kinh nghiệm](#7-theo-dõi-kinh-nghiệm)
8. [Ma trận kỹ năng](#8-ma-trận-kỹ-năng)
9. [API liên quan](#9-api-liên-quan)

---

## 1. Tổng quan

Hệ thống quản lý kỹ năng cho phép:
- Tạo danh sách kỹ năng theo lĩnh vực
- Gán kỹ năng yêu cầu cho từng công việc
- Tự động theo dõi kinh nghiệm người dùng
- Hỗ trợ phân công tự động dựa trên kỹ năng

---

## 2. Cấu trúc dữ liệu

### 2.1. Bảng `skills` - Danh sách kỹ năng

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | integer | Mã định danh |
| `name` | varchar | Tên kỹ năng (VD: "React", "AutoCAD") |
| `field` | varchar | Lĩnh vực (VD: "CNTT", "Xây dựng") |
| `created_at` | timestamp | Thời điểm tạo |

**Ví dụ dữ liệu:**
```
| id | name              | field          |
|----|-------------------|----------------|
| 1  | React             | CNTT           |
| 2  | Quản lý dự án     | Quản lý        |
| 3  | AutoCAD           | Xây dựng       |
| 4  | Thiết kế UI       | Thiết kế       |
```

### 2.2. Bảng `task_skills` - Kỹ năng yêu cầu của công việc

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `task_id` | text | Mã công việc |
| `skill_id` | integer | Mã kỹ năng |

**Ví dụ:**
```
Task "Xây dựng API" cần: skill_id = 1 (Backend), skill_id = 5 (Database)
Task "Thiết kế giao diện" cần: skill_id = 4 (UI), skill_id = 6 (CSS)
```

### 2.3. Bảng `user_skills` - Kỹ năng của người dùng (tùy chọn)

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `user_id` | uuid | Mã người dùng |
| `skill_id` | integer | Mã kỹ năng |
| `level` | integer | Mức độ thành thạo (1-5) |

**Mức độ thành thạo:**
```
1 = Mới bắt đầu
2 = Cơ bản
3 = Trung bình
4 = Thành thạo
5 = Chuyên gia
```

### 2.4. View `user_skill_matrix` - Ma trận kỹ năng tự động

View này tự động tính toán kinh nghiệm từ công việc đã hoàn thành:

| Cột | Mô tả |
|-----|-------|
| `user_id` | Người dùng |
| `full_name` | Tên đầy đủ |
| `skill_id` | Mã kỹ năng |
| `skill_name` | Tên kỹ năng |
| `skill_field` | Lĩnh vực |
| `completed_tasks_count` | Số task đã hoàn thành với skill này |
| `total_experience_days` | Tổng số ngày kinh nghiệm |
| `last_activity_date` | Ngày hoạt động gần nhất |

---

## 3. Các file liên quan

### 3.1. API Routes

```
src/app/api/skills/
├── route.ts                    ← GET (danh sách), POST (tạo mới)
├── [id]/
│   └── route.ts                ← PUT (cập nhật), DELETE (xóa)
└── fields/
    ├── route.ts                ← Quản lý lĩnh vực
    └── [id]/
        └── route.ts

src/app/api/tasks/[id]/skills/
└── route.ts                    ← Quản lý skill của task

src/app/api/team/
└── skill-matrix/
    └── route.ts                ← Lấy ma trận kỹ năng team

src/app/api/profile/
└── skills/
    └── route.ts                ← Lấy kỹ năng cá nhân
```

### 3.2. Components

```
src/components/team/
└── skill-matrix.tsx            ← Giao diện quản lý kỹ năng
```

### 3.3. Thuật toán

```
src/algorithm/
└── experience-matrix.ts        ← Tính điểm kinh nghiệm
```

---

## 4. Tạo và quản lý kỹ năng

### 4.1. Tạo kỹ năng mới

**Cách 1: Qua giao diện**

1. Vào Dashboard → Team → Quản lý kỹ năng
2. Nhấn "Thêm kỹ năng"
3. Điền thông tin:
   - Tên kỹ năng
   - Lĩnh vực
4. Nhấn "Lưu"

**Cách 2: Qua API**

```http
POST /api/skills
Content-Type: application/json

{
  "name": "Python",
  "field": "Backend"
}

Response (201):
{
  "data": {
    "id": 5,
    "name": "Python",
    "field": "Backend",
    "created_at": "2024-01-26T10:00:00Z"
  }
}
```

### 4.2. Cập nhật kỹ năng

```http
PUT /api/skills/5
Content-Type: application/json

{
  "name": "Python 3",
  "field": "Lập trình"
}
```

### 4.3. Xóa kỹ năng

```http
DELETE /api/skills/5
```

**Lưu ý:** Không thể xóa kỹ năng nếu:
- Đang được gán cho công việc nào đó
- Đang được gán cho người dùng nào đó

**Kiểm tra trước khi xóa:**
```typescript
// Kiểm tra task_skills
const { data: taskSkills } = await supabase
  .from('task_skills')
  .select('id')
  .eq('skill_id', skillId)
  .limit(1)

if (taskSkills && taskSkills.length > 0) {
  // Không cho xóa
  return { error: "Kỹ năng đang được sử dụng trong công việc" }
}
```

### 4.4. Lấy danh sách kỹ năng

```http
GET /api/skills

Response:
{
  "data": [
    { "id": 1, "name": "React", "field": "CNTT" },
    { "id": 2, "name": "AutoCAD", "field": "Xây dựng" },
    ...
  ]
}
```

---

## 5. Gán kỹ năng cho người dùng

### 5.1. Cách tự động (Khuyên dùng)

Hệ thống **tự động theo dõi** kỹ năng của người dùng dựa trên:
- Công việc đã hoàn thành
- Thời gian làm việc (worklog)

**Quy trình:**
```
[Người dùng được gán làm task có skill X]
                ↓
[Người dùng hoàn thành task]
                ↓
[Ghi worklog (số giờ làm)]
                ↓
[Hệ thống tự động cập nhật user_skill_matrix]
                ↓
[Kinh nghiệm với skill X tăng lên]
```

### 5.2. Cách thủ công (Tùy chọn)

Nếu muốn gán kỹ năng thủ công với mức độ:

```typescript
// Thêm kỹ năng cho user
await supabase.from('user_skills').insert({
  user_id: 'uuid-123',
  skill_id: 1,
  level: 3  // Trung bình
})
```

### 5.3. Quy đổi kinh nghiệm → Điểm

Hệ thống tự động quy đổi số task hoàn thành thành điểm kinh nghiệm:

| Số task hoàn thành | Điểm kinh nghiệm | Mức độ |
|--------------------|------------------|--------|
| 0 | 0.0 | Chưa có |
| 1-2 | 0.3 | Mới bắt đầu |
| 3-4 | 0.5 | Cơ bản |
| 5-6 | 0.7 | Trung bình |
| 7-9 | 0.8 | Thành thạo |
| 10+ | 0.9 | Chuyên gia |

**Ví dụ:**
```
Nguyễn Văn A hoàn thành 8 task có skill "React"
→ Điểm kinh nghiệm React = 0.8 (Thành thạo)

Trần Thị B hoàn thành 2 task có skill "React"
→ Điểm kinh nghiệm React = 0.3 (Mới bắt đầu)
```

---

## 6. Gán kỹ năng cho công việc

### 6.1. Mục đích

Gán kỹ năng yêu cầu cho công việc giúp:
- Xác định người phù hợp để phân công
- Theo dõi kỹ năng được sử dụng
- Cập nhật kinh nghiệm khi hoàn thành

### 6.2. Giao diện

Trong trang chỉnh sửa công việc, tab "Chi tiết":

```
┌────────────────────────────────────────────────┐
│  Kỹ năng yêu cầu:                              │
│                                                │
│  [React]  [Node.js]  [Database]  [Docker]     │
│   (chọn)  (chọn)     (chưa)      (chưa)       │
│                                                │
│  Nhấn vào badge để chọn/bỏ chọn               │
└────────────────────────────────────────────────┘
```

### 6.3. API

#### Lấy kỹ năng của task

```http
GET /api/tasks/task-123/skills

Response:
{
  "skills": [
    { "skill_id": 1, "skills": { "id": 1, "name": "React" } },
    { "skill_id": 2, "skills": { "id": 2, "name": "Node.js" } }
  ]
}
```

#### Thêm kỹ năng

```http
POST /api/tasks/task-123/skills
Content-Type: application/json

{
  "skill_ids": [1, 2, 3]
}
```

#### Cập nhật (thay thế toàn bộ)

```http
PUT /api/tasks/task-123/skills
Content-Type: application/json

{
  "skills": [1, 3, 5]
}
```

Quy trình:
1. Xóa tất cả skill cũ của task
2. Thêm các skill mới

#### Xóa tất cả kỹ năng

```http
DELETE /api/tasks/task-123/skills
```

---

## 7. Theo dõi kinh nghiệm

### 7.1. Luồng dữ liệu

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  [Hoàn thành task]                                         │
│        ↓                                                    │
│  [Ghi worklog: user_id, task_id, spent_hours]              │
│        ↓                                                    │
│  [task_skills: task có những skill nào]                    │
│        ↓                                                    │
│  [user_skill_matrix VIEW tự động tính:]                    │
│     - completed_tasks_count: Số task đã làm                │
│     - total_experience_days: Tổng số ngày                  │
│     - last_activity_date: Ngày gần nhất                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.2. View user_skill_matrix

**Định nghĩa SQL:**
```sql
CREATE VIEW user_skill_matrix AS
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
```

**Cách đọc:**
```
| user_id | full_name    | skill_name | completed_tasks | experience_days |
|---------|--------------|------------|-----------------|-----------------|
| uuid-1  | Nguyễn A     | React      | 8               | 45              |
| uuid-1  | Nguyễn A     | Node.js    | 5               | 30              |
| uuid-2  | Trần B       | React      | 3               | 20              |
```

Nguyễn A:
- Đã hoàn thành 8 task có skill React
- Tổng 45 ngày kinh nghiệm với React
- Đã hoàn thành 5 task có skill Node.js

### 7.3. Trigger tự động

View được cập nhật tự động khi:
- Thêm/sửa/xóa worklog
- Thêm/sửa/xóa task_skills

```sql
-- Trigger khi worklog thay đổi
CREATE TRIGGER trigger_worklog_user_skill_matrix
    AFTER INSERT OR UPDATE OR DELETE ON worklogs
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_user_skill_matrix();

-- Trigger khi task_skills thay đổi
CREATE TRIGGER trigger_task_skills_user_skill_matrix
    AFTER INSERT OR UPDATE OR DELETE ON task_skills
    FOR EACH ROW
    EXECUTE FUNCTION trigger_refresh_user_skill_matrix();
```

---

## 8. Ma trận kỹ năng

### 8.1. Xem ma trận team

**API:** `GET /api/team/skill-matrix`

**Response:**
```json
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
      },
      {
        "skill_id": 2,
        "skill_name": "Node.js",
        "completed_tasks_count": 5,
        "last_activity_date": "2024-01-20"
      }
    ]
  },
  {
    "user_id": "uuid-2",
    "full_name": "Trần Thị B",
    "position": "Designer",
    "skills": [
      {
        "skill_id": 4,
        "skill_name": "UI Design",
        "completed_tasks_count": 12,
        "last_activity_date": "2024-01-24"
      }
    ]
  }
]
```

### 8.2. Xem kỹ năng cá nhân

**API:** `GET /api/profile/skills`

Trả về kỹ năng của người dùng hiện tại, sắp xếp theo số task hoàn thành.

### 8.3. Làm mới ma trận

Nếu cần cập nhật thủ công:

```http
POST /api/user-skills/refresh

Response:
{
  "success": true,
  "message": "Đã làm mới ma trận kỹ năng"
}
```

---

## 9. API liên quan

### 9.1. Quản lý kỹ năng

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/skills` | Lấy danh sách kỹ năng |
| POST | `/api/skills` | Tạo kỹ năng mới |
| PUT | `/api/skills/[id]` | Cập nhật kỹ năng |
| DELETE | `/api/skills/[id]` | Xóa kỹ năng |

### 9.2. Lĩnh vực kỹ năng

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/skills/fields` | Lấy danh sách lĩnh vực |
| POST | `/api/skills/fields` | Tạo lĩnh vực mới |

### 9.3. Kỹ năng của công việc

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/tasks/[id]/skills` | Lấy kỹ năng của task |
| POST | `/api/tasks/[id]/skills` | Thêm kỹ năng |
| PUT | `/api/tasks/[id]/skills` | Cập nhật (thay thế) |
| DELETE | `/api/tasks/[id]/skills` | Xóa tất cả kỹ năng |

### 9.4. Ma trận kỹ năng

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/team/skill-matrix` | Ma trận kỹ năng team |
| GET | `/api/profile/skills` | Kỹ năng cá nhân |
| POST | `/api/user-skills/refresh` | Làm mới ma trận |

### 9.5. Đề xuất người phù hợp

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/projects/[id]/tasks/[taskId]/recommended-users` | Đề xuất người theo skill |

---

## Workflow hoàn chỉnh

### Ví dụ: Người dùng tích lũy kinh nghiệm React

```
Bước 1: Quản lý tạo skill "React" với field "CNTT"

Bước 2: Tạo task "Xây dựng Dashboard"
         Gán skill yêu cầu: React

Bước 3: Phân công Nguyễn A làm task (vai trò R)

Bước 4: Nguyễn A hoàn thành task
         → Đánh dấu status = "done"

Bước 5: Hệ thống tự động:
         → Tạo worklog cho Nguyễn A
         → Cập nhật user_skill_matrix
         → Nguyễn A: completed_tasks_count +1 với React

Bước 6: Lần sau có task React mới:
         → Hệ thống đề xuất Nguyễn A (vì có kinh nghiệm)
         → Điểm confidence cao hơn người chưa làm React

Sau 10 task:
         → Nguyễn A trở thành "Chuyên gia" React (điểm 0.9)
         → Luôn được đề xuất đầu tiên cho task React
```

---

## Tóm tắt

1. **Skills:** Danh sách kỹ năng được nhóm theo lĩnh vực
2. **Task Skills:** Mỗi công việc có thể yêu cầu nhiều kỹ năng
3. **Kinh nghiệm tự động:** Hệ thống theo dõi qua worklog và task hoàn thành
4. **Điểm kinh nghiệm:** 0-0.9, dựa trên số task đã làm
5. **Ma trận kỹ năng:** View tổng hợp kinh nghiệm của cả team
6. **Phân công thông minh:** Dùng kinh nghiệm để đề xuất người phù hợp
