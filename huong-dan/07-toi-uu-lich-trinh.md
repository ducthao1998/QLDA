# Hướng Dẫn: Tối Ưu Hóa Lịch Trình

## Mục Lục
1. [Tổng quan](#1-tổng-quan)
2. [Các file liên quan](#2-các-file-liên-quan)
3. [Thuật toán CPM (Đường găng)](#3-thuật-toán-cpm-đường-găng)
4. [Thuật toán Hungary (Phân công)](#4-thuật-toán-hungary-phân-công)
5. [Quy trình tối ưu hóa](#5-quy-trình-tối-ưu-hóa)
6. [Quản lý schedule run](#6-quản-lý-schedule-run)
7. [Tham số cài đặt](#7-tham-số-cài-đặt)
8. [Kết quả tối ưu hóa](#8-kết-quả-tối-ưu-hóa)
9. [API liên quan](#9-api-liên-quan)

---

## 1. Tổng quan

Tối ưu hóa lịch trình là tính năng tự động tạo lịch trình tối ưu bằng các thuật toán:
- **CPM (Critical Path Method):** Tìm đường găng, giảm thời gian dự án
- **Hungarian Algorithm:** Phân công tối ưu người thực hiện
- **Experience Matrix:** Đánh giá kinh nghiệm phù hợp

**Kết quả:**
- Giảm thời gian hoàn thành dự án
- Cân bằng khối lượng công việc team
- Tôn trọng phụ thuộc và kỹ năng yêu cầu

---

## 2. Các file liên quan

### 2.1. Thuật toán

```
src/algorithm/
├── schedule-optimizer.ts       ← Engine tối ưu chính
├── critical-path.ts            ← Thuật toán CPM
├── hungarian-assignment.ts     ← Thuật toán phân công
├── experience-matrix.ts        ← Ma trận kinh nghiệm
├── project-schedule.ts         ← Tính lịch dự án
└── types.ts                    ← Định nghĩa kiểu dữ liệu
```

### 2.2. API

```
src/app/api/
├── projects/[id]/
│   ├── schedule/
│   │   ├── optimize/
│   │   │   └── route.ts        ← Chạy tối ưu
│   │   └── active/
│   │       └── route.ts        ← Lấy schedule đang hoạt động
│   └── optimize/
│       └── route.ts            ← API tối ưu thay thế
└── schedules/
    └── [runId]/
        └── accept/
            └── route.ts        ← Chấp nhận schedule
```

### 2.3. Giao diện

```
src/app/dashboard/schedule/
├── page.tsx                    ← Trang xem lịch
└── layout.tsx                  ← Layout wrapper
```

---

## 3. Thuật toán CPM (Đường găng)

**File:** `src/algorithm/critical-path.ts`

### 3.1. Đường găng là gì?

```
Đường găng = Chuỗi công việc DÀI NHẤT từ đầu đến cuối dự án

Ví dụ:
Task A (2 ngày) → Task C (3 ngày) → Task D (4 ngày) = 9 ngày
Task B (1 ngày) ↗                                    = 1 ngày

Đường găng: A → C → D (9 ngày)
Task B không nằm trên đường găng (có thể trễ mà không ảnh hưởng)
```

### 3.2. Các khái niệm

| Khái niệm | Viết tắt | Ý nghĩa |
|-----------|----------|---------|
| **Earliest Start** | ES | Ngày sớm nhất có thể bắt đầu |
| **Earliest Finish** | EF | ES + Thời gian = Ngày sớm nhất kết thúc |
| **Latest Start** | LS | Ngày muộn nhất được phép bắt đầu |
| **Latest Finish** | LF | Ngày muộn nhất được phép kết thúc |
| **Slack/Float** | - | LS - ES = Thời gian đệm |
| **Critical** | - | Slack = 0 (không có đệm) |

### 3.3. Ví dụ tính toán

```
Task X:
- Thời gian: 2 ngày
- Tiền nhiệm kết thúc: Ngày 5
- Deadline dự án: Ngày 10

Tính toán:
ES = 5 (chờ tiền nhiệm)
EF = 5 + 2 = 7
LF = 10 (deadline dự án)
LS = 10 - 2 = 8
Slack = 8 - 5 = 3 ngày (có thể trễ 3 ngày)

→ Task X KHÔNG critical (vì Slack > 0)
```

### 3.4. Ý nghĩa thực tế

- **Task critical (Slack = 0):** Phải đúng tiến độ, trễ sẽ trễ cả dự án
- **Task không critical (Slack > 0):** Có độ linh hoạt, có thể điều chỉnh
- **Song song hóa:** Task không phụ thuộc nhau có thể chạy đồng thời

---

## 4. Thuật toán Hungary (Phân công)

**File:** `src/algorithm/hungarian-assignment.ts`

### 4.1. Mục đích

Tìm cách phân công **tối ưu toàn cục** task cho người, dựa trên:
- Kỹ năng phù hợp
- Kinh nghiệm
- Khối lượng công việc hiện tại

### 4.2. Cách tính điểm

Mỗi cặp (Task, User) được tính điểm theo công thức:

```
Điểm = 0.50 × Kinh nghiệm
     + 0.35 × Khối lượng
     + 0.10 × Độ phủ kỹ năng
     + 0.05 × Chuyên môn cao

Trong đó:
- Kinh nghiệm: Trung bình điểm skill yêu cầu (0-1)
- Khối lượng: Còn bao nhiêu capacity (0=bận, 1=rảnh)
- Độ phủ kỹ năng: % skill yêu cầu mà user có
- Chuyên môn cao: Bonus nếu có skill > 0.8
```

### 4.3. Ví dụ tính điểm

```
Task: "Phát triển API Backend"
Yêu cầu: Node.js, PostgreSQL

User A:
- Node.js: 0.9
- PostgreSQL: 0.7
- Kinh nghiệm TB: (0.9 + 0.7) / 2 = 0.8
- Khối lượng: 0.5 (đang làm 50% capacity)
- Độ phủ: 100% (có cả 2 skill)
- Chuyên môn: 1.0 (Node.js > 0.8)

Điểm A = 0.50×0.8 + 0.35×0.5 + 0.10×1.0 + 0.05×1.0
       = 0.40 + 0.175 + 0.10 + 0.05
       = 0.725

User B:
- Node.js: 0.3
- PostgreSQL: 0 (không có)
- Kinh nghiệm TB: 0.15
- Khối lượng: 1.0 (hoàn toàn rảnh)
- Độ phủ: 50% (chỉ có Node.js)
- Chuyên môn: 0 (không skill nào > 0.8)

Điểm B = 0.50×0.15 + 0.35×1.0 + 0.10×0.5 + 0.05×0
       = 0.075 + 0.35 + 0.05 + 0
       = 0.475

Kết quả: User A được gán (0.725 > 0.475)
```

### 4.4. Hệ thống Slot

```
Mỗi user có "slot" = Số task còn nhận được

User A: max = 3, đang làm = 1 → Còn 2 slot
User B: max = 2, đang làm = 2 → Còn 0 slot

Ma trận chi phí:
                Task 1    Task 2    Task 3
User A (slot 1)  0.275    0.525     0.425
User A (slot 2)  0.275    0.525     0.425
User B           ---      ---       ---     (không có slot)
UNASSIGNED       0.5      0.5       0.5     (fallback)

Thuật toán Hungary tìm matching tối ưu toàn cục
```

### 4.5. Đặc điểm

- **Tối ưu toàn cục:** Xét tất cả task và user cùng lúc
- **Không tham lam:** Không gán tuần tự mà tìm giải pháp tốt nhất
- **Tôn trọng capacity:** Tự động dừng khi user đầy

---

## 5. Quy trình tối ưu hóa

### 5.1. Sơ đồ tổng quan

```
[Nhấn "Tối ưu lịch trình"]
         ↓
┌─────────────────────────────────────────┐
│ 1. Tải dữ liệu dự án                    │
│    - Danh sách task và thuộc tính       │
│    - Thành viên team và capacity        │
│    - Phụ thuộc giữa các task            │
│    - Kỹ năng yêu cầu cho mỗi task       │
│    - Kinh nghiệm của từng người         │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 2. Tính chỉ số ban đầu                  │
│    - Makespan gốc (thời gian dự án)     │
│    - Tỷ lệ sử dụng nguồn lực            │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 3. Chạy CPM                             │
│    - Xây dựng đồ thị phụ thuộc          │
│    - Tính đường găng                    │
│    - Sắp xếp task (critical trước)      │
│    - Gán ngày bắt đầu sớm nhất          │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 4. Chạy Hungarian Assignment            │
│    - Xây dựng ma trận kinh nghiệm       │
│    - Tính điểm cho từng cặp (task,user) │
│    - Tìm matching tối ưu                │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 5. Tính chỉ số sau tối ưu               │
│    - Makespan mới                       │
│    - Tỷ lệ sử dụng mới                  │
│    - So sánh với ban đầu                │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 6. Tạo báo cáo chi tiết                 │
│    - Các thay đổi lịch trình            │
│    - Chi tiết đường găng                │
│    - Phân tích nguồn lực                │
│    - Phát hiện bottleneck               │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 7. Lưu Schedule Run (Draft)             │
│    - Tạo bản ghi schedule_runs          │
│    - Lưu schedule_details               │
│    - Trạng thái: "draft"                │
└─────────────────────────────────────────┘
         ↓
[Trả về kết quả cho người dùng]
```

### 5.2. Ưu tiên sắp xếp task

```
1. Task trên đường găng (critical) → Làm trước
2. Task ít phụ thuộc hơn → Làm trước
3. Task thời gian dài hơn → Làm trước
```

### 5.3. Tính ngày bắt đầu

```typescript
if (task có phụ thuộc) {
  earliestStart = Max(ngày kết thúc của tất cả tiền nhiệm) + 1 ngày
} else {
  earliestStart = ngày bắt đầu dự án
}
```

---

## 6. Quản lý Schedule Run

### 6.1. Các trạng thái

```
        ┌─────────────────────────────────┐
        │           DRAFT                 │
        │  (Vừa tối ưu, chờ xác nhận)    │
        └──────────────┬──────────────────┘
                       │
                       ↓ (Nhấn "Chấp nhận")
        ┌─────────────────────────────────┐
        │          APPROVED               │
        │  (Đã chấp nhận, sẵn sàng)      │
        └──────────────┬──────────────────┘
                       │
                       ↓ (Kích hoạt)
        ┌─────────────────────────────────┐
        │           ACTIVE                │
        │  (Đang áp dụng)                 │
        │  (Chỉ 1 per dự án)             │
        └──────────────┬──────────────────┘
                       │
                       ↓ (Schedule mới được chấp nhận)
        ┌─────────────────────────────────┐
        │          ARCHIVED               │
        │  (Lịch sử, không dùng nữa)     │
        └─────────────────────────────────┘
```

### 6.2. Cấu trúc database

**Bảng `schedule_runs`:**

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | uuid | Mã định danh |
| `project_id` | text | Dự án |
| `name` | text | Tên schedule |
| `algorithm_used` | text | Thuật toán đã dùng |
| `status` | text | draft, approved, active, archived |
| `is_active` | boolean | Có đang được dùng không |
| `created_by` | text | Người tạo |
| `parameters` | jsonb | Tham số cài đặt |
| `metrics` | jsonb | Kết quả tối ưu |

**Bảng `schedule_details`:**

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | uuid | Mã định danh |
| `schedule_run_id` | uuid | Thuộc schedule nào |
| `task_id` | text | Công việc |
| `assigned_user` | text | Người được gán |
| `start_ts` | timestamp | Ngày bắt đầu |
| `finish_ts` | timestamp | Ngày kết thúc |
| `confidence` | number | Độ tin cậy phân công |
| `experience_score` | number | Điểm kinh nghiệm |

### 6.3. Quy trình chấp nhận

```
POST /api/schedules/{runId}/accept
         ↓
1. Tải schedule_run cần chấp nhận
         ↓
2. Vô hiệu hóa schedule cũ (nếu có)
   - is_active = false
   - status = "archived"
         ↓
3. Kích hoạt schedule mới
   - is_active = true
   - status = "approved"
         ↓
4. Cập nhật project.active_schedule_run_id
         ↓
5. Trả về thành công
```

---

## 7. Tham số cài đặt

### 7.1. Mục tiêu tối ưu

| Loại | Mô tả | Khi nào dùng |
|------|-------|--------------|
| `time` | Giảm thời gian | Khi cần hoàn thành nhanh nhất |
| `resource` | Cân bằng workload | Khi muốn phân bổ đều |
| `cost` | Giảm chi phí | Khi hạn chế ngân sách |
| `multi` | Kết hợp | Cân bằng nhiều yếu tố |

### 7.2. Trọng số (cho `multi`)

```typescript
{
  time_weight: 0.5,      // 50% ưu tiên thời gian
  resource_weight: 0.3,  // 30% ưu tiên nguồn lực
  cost_weight: 0.2       // 20% ưu tiên chi phí
}
```

### 7.3. Tham số phân công

| Tham số | Mặc định | Ý nghĩa |
|---------|----------|---------|
| `min_confidence_R` | 0.35 | Ngưỡng điểm tối thiểu để phân công |
| `default_max_concurrent_tasks` | 2 | Số task tối đa/người |
| `unassigned_cost` | 0.5 | Chi phí để lại task không gán |
| `priority_mode` | weighted | weighted hoặc lexi |

### 7.4. Tham số CPM

| Tham số | Mặc định | Ý nghĩa |
|---------|----------|---------|
| `default_task_duration_days` | 1 | Thời gian mặc định nếu không có |
| `allow_start_next_day` | true | Cho phép bắt đầu ngày hôm sau |
| `criticality_threshold_days` | 0 | Slack <= ngưỡng này = critical |

---

## 8. Kết quả tối ưu hóa

### 8.1. Các chỉ số chính

| Chỉ số | Mô tả |
|--------|-------|
| `original_makespan` | Thời gian dự án trước tối ưu |
| `optimized_makespan` | Thời gian dự án sau tối ưu |
| `improvement_percentage` | % cải thiện |
| `resource_utilization_before` | Tỷ lệ sử dụng nguồn lực trước |
| `resource_utilization_after` | Tỷ lệ sử dụng nguồn lực sau |
| `workload_balance` | Độ cân bằng workload |

### 8.2. Ví dụ kết quả

```json
{
  "algorithm_used": "Hungarian+Weighted",
  "original_makespan": 45,
  "optimized_makespan": 30,
  "improvement_percentage": 33.3,
  "resource_utilization_before": 0.65,
  "resource_utilization_after": 0.82,

  "explanation": {
    "strategy": "Multi-Project CPM Optimization",
    "key_improvements": [
      "Giảm từ 45 xuống 30 ngày (33.3%)",
      "Tăng sử dụng nguồn lực từ 65% lên 82%"
    ]
  },

  "critical_path": ["task_1", "task_3", "task_5", "task_7"],

  "duration_analysis": {
    "total_task_duration": 80,
    "original_parallel_duration": 45,
    "optimized_parallel_duration": 30,
    "duration_reduction": 15,
    "parallel_tasks_count": 4
  },

  "resource_analysis": {
    "total_users": 5,
    "assigned_users": 4,
    "average_workload": 20,
    "max_workload": 30,
    "min_workload": 12
  }
}
```

### 8.3. Các thay đổi lịch trình

```json
{
  "schedule_changes": [
    {
      "task_id": "task_2",
      "task_name": "Thiết kế Database",
      "change_type": "moved",
      "original_start": "2024-01-10",
      "new_start": "2024-01-08",
      "reason": "Song song hóa với task độc lập",
      "impact": "Sớm hơn 2 ngày"
    },
    {
      "task_id": "task_3",
      "task_name": "Xây dựng API",
      "change_type": "reassigned",
      "original_assignee": "User A",
      "new_assignee": "User B",
      "reason": "User B có kinh nghiệm cao hơn (0.9 vs 0.6)"
    }
  ]
}
```

---

## 9. API liên quan

### 9.1. Tối ưu hóa

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/projects/[id]/schedule/optimize` | Chạy tối ưu |
| POST | `/api/projects/[id]/optimize` | API thay thế |

### 9.2. Quản lý schedule

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/projects/[id]/schedule/active` | Lấy schedule đang dùng |
| POST | `/api/schedules/[runId]/accept` | Chấp nhận schedule |

### 9.3. Ví dụ Request/Response

#### Chạy tối ưu

```http
POST /api/projects/project-123/schedule/optimize
Content-Type: application/json

{
  "objective": {
    "type": "multi",
    "weights": {
      "time_weight": 0.6,
      "resource_weight": 0.4
    }
  },
  "assignment_prefs": {
    "min_confidence_R": 0.35,
    "priority_mode": "weighted"
  }
}

Response (200):
{
  "success": true,
  "schedule_run_id": "run-456",
  "result": {
    "original_makespan": 45,
    "optimized_makespan": 30,
    "improvement_percentage": 33.3,
    ...
  }
}
```

#### Chấp nhận schedule

```http
POST /api/schedules/run-456/accept

Response (200):
{
  "success": true,
  "message": "Schedule đã được kích hoạt"
}
```

#### Lấy schedule đang dùng

```http
GET /api/projects/project-123/schedule/active

Response (200):
{
  "run": {
    "id": "run-456",
    "name": "Tối ưu 26/01/2024",
    "status": "active",
    "metrics": {...}
  },
  "details": [
    {
      "task_id": "task-1",
      "assigned_user": "user-abc",
      "start_ts": "2024-01-10T00:00:00Z",
      "finish_ts": "2024-01-15T00:00:00Z",
      "confidence": 0.85
    }
  ]
}
```

---

## Workflow thực tế

### Ví dụ: Tối ưu dự án Mobile App

```
Dữ liệu đầu vào:
- Task: Thiết kế UI (5 ngày), Backend (10 ngày), Frontend (8 ngày), Testing (3 ngày)
- Phụ thuộc: UI → Frontend, Backend → Frontend → Testing
- Team: Alice (Backend 0.9), Bob (Frontend 0.9), Charlie (QA 0.8, UI 0.7)

Bước 1: Chạy CPM
- Đường găng: Backend → Frontend → Testing = 21 ngày
- UI Design có thể chạy song song với Backend

Bước 2: Chạy Hungarian
- Backend → Alice (kinh nghiệm 0.9)
- UI Design → Charlie (kinh nghiệm 0.7)
- Frontend → Bob (kinh nghiệm 0.9)
- Testing → Charlie (kinh nghiệm 0.8)

Kết quả:
- Makespan gốc: 26 ngày (nếu tuần tự)
- Makespan tối ưu: 21 ngày (song song hóa)
- Cải thiện: 19.2%

Bước 3: Review và chấp nhận
- Xem lịch trình đề xuất
- Nhấn "Chấp nhận"
- Schedule trở thành "active"

Bước 4: Áp dụng
- Gantt chart hiển thị lịch mới
- Thành viên thấy task được gán
```

---

## Tóm tắt

1. **CPM:** Tìm đường găng, xác định task critical, song song hóa task độc lập
2. **Hungarian:** Phân công tối ưu dựa trên skill, kinh nghiệm, workload
3. **Schedule Run:** Draft → Approved → Active (chỉ 1 active/dự án)
4. **Kết quả:** Giảm thời gian, tăng sử dụng nguồn lực, cân bằng workload
5. **Tham số:** Có thể tùy chỉnh mục tiêu, trọng số, ngưỡng
