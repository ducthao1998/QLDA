# Hướng Dẫn: Cài Đặt Thuật Toán

## Mục Lục
1. [Tổng quan](#1-tổng-quan)
2. [Các file liên quan](#2-các-file-liên-quan)
3. [Cài đặt phân công](#3-cài-đặt-phân-công)
4. [Cài đặt CPM](#4-cài-đặt-cpm)
5. [Mục tiêu tối ưu](#5-mục-tiêu-tối-ưu)
6. [Lưu và áp dụng](#6-lưu-và-áp-dụng)
7. [API liên quan](#7-api-liên-quan)

---

## 1. Tổng quan

Cài đặt thuật toán cho phép tùy chỉnh:
- Cách phân công công việc (Hungarian Algorithm)
- Cách tính đường găng (CPM)
- Mục tiêu tối ưu hóa (thời gian, nguồn lực, chi phí)

---

## 2. Các file liên quan

### 2.1. Trang

```
src/app/dashboard/settings/
└── page.tsx                    ← Trang cài đặt
```

### 2.2. API

```
src/app/api/settings/
└── algorithm/
    └── route.ts                ← GET, POST cài đặt
```

### 2.3. Database

```
Bảng: algorithm_settings
- user_id: UUID
- project_id: TEXT (nullable, nếu null = global)
- assignment_prefs: JSONB
- cpm_prefs: JSONB

Bảng: algorithm_global_settings
- user_id: UUID (PK)
- algorithm: TEXT
- objective_type: TEXT
- objective_weights: JSONB
- constraints: JSONB
- assignment_prefs: JSONB
- cpm_prefs: JSONB
```

---

## 3. Cài đặt phân công

### 3.1. Các tham số

| Tham số | Mặc định | Mô tả |
|---------|----------|-------|
| `priority_mode` | weighted | Chế độ tính điểm |
| `default_max_concurrent_tasks` | 2 | Số task tối đa/người |
| `min_confidence_R` | 0.35 | Ngưỡng điểm tối thiểu để gán R |
| `min_confidence_A` | 0.5 | Ngưỡng điểm tối thiểu để gán A |
| `unassigned_cost` | 0.5 | Chi phí để task không được gán |
| `allow_same_RA` | true | Cho phép 1 người vừa R vừa A |

### 3.2. Chế độ tính điểm (priority_mode)

#### Weighted (Cân bằng)

```
Điểm = 0.50 × Kinh nghiệm
     + 0.35 × Khối lượng
     + 0.10 × Độ phủ kỹ năng
     + 0.05 × Chuyên môn cao

Ưu điểm: Cân bằng nhiều yếu tố
Nhược điểm: Có thể không ưu tiên skill matching
```

#### Lexicographic (Ưu tiên thứ tự)

```
Ưu tiên 1: Capacity (còn slot không?)
Ưu tiên 2: Kinh nghiệm domain
Ưu tiên 3: Workload (ít việc hơn tốt hơn)
Ưu tiên 4: Random (nếu bằng nhau)

Ưu điểm: Ưu tiên skill matching rõ ràng
Nhược điểm: Có thể bỏ qua workload balance
```

### 3.3. Ngưỡng confidence

```
min_confidence_R = 0.35

Ý nghĩa:
- Nếu điểm phù hợp < 0.35 → Không gán vai trò R
- Nếu điểm >= 0.35 → Có thể gán R

Điều chỉnh:
- Tăng (0.5-0.7): Chỉ gán người rất phù hợp, nhiều task có thể không gán được
- Giảm (0.2-0.3): Dễ gán hơn, nhưng có thể gán người ít phù hợp
```

### 3.4. Unassigned cost

```
unassigned_cost = 0.5

Ý nghĩa:
- Chi phí "ảo" khi để task không gán ai
- So sánh với chi phí gán người có điểm thấp

Nếu score của user tốt nhất = 0.4:
  cost_assign = 1 - 0.4 = 0.6
  cost_unassign = 0.5

  Vì 0.5 < 0.6 → Chọn không gán (UNASSIGNED)

Điều chỉnh:
- Tăng (0.7-0.9): Ưu tiên gán ai đó hơn là để trống
- Giảm (0.3-0.4): Dễ để trống nếu không có người phù hợp
```

---

## 4. Cài đặt CPM

### 4.1. Các tham số

| Tham số | Mặc định | Mô tả |
|---------|----------|-------|
| `default_task_duration_days` | 1 | Thời gian mặc định nếu task không có |
| `allow_start_next_day` | true | Task bắt đầu ngày hôm sau khi dep kết thúc |
| `criticality_threshold_days` | 0 | Ngưỡng slack để coi là critical |
| `free_float_warning_ratio` | 0.2 | Tỷ lệ cảnh báo free float |

### 4.2. Criticality threshold

```
criticality_threshold_days = 0

Ý nghĩa:
- Task có slack <= threshold → Coi là critical
- threshold = 0: Chỉ task có slack = 0 mới critical
- threshold = 1: Task có slack <= 1 ngày cũng coi là critical

Điều chỉnh:
- Tăng (1-3): Nhiều task được coi là critical, cảnh báo sớm
- Giữ 0: Chỉ critical thực sự
```

### 4.3. Allow start next day

```
allow_start_next_day = true

True:
  Task A kết thúc ngày 5
  Task B (phụ thuộc A) bắt đầu ngày 6

False:
  Task A kết thúc ngày 5
  Task B có thể bắt đầu ngày 5 (cùng ngày)
```

---

## 5. Mục tiêu tối ưu

### 5.1. Các loại mục tiêu

| Loại | Mô tả | Khi nào dùng |
|------|-------|--------------|
| `time` | Giảm thời gian dự án | Deadline gấp |
| `resource` | Cân bằng workload | Team có nhiều người |
| `cost` | Giảm chi phí | Ngân sách hạn chế |
| `multi` | Kết hợp nhiều mục tiêu | Cân bằng tổng thể |

### 5.2. Trọng số (cho multi)

```typescript
{
  objective: {
    type: "multi",
    weights: {
      time_weight: 0.5,      // 50% ưu tiên thời gian
      resource_weight: 0.3,  // 30% ưu tiên nguồn lực
      cost_weight: 0.2       // 20% ưu tiên chi phí
    }
  }
}

Tổng weights nên = 1.0
```

### 5.3. Ví dụ cấu hình

**Ưu tiên hoàn thành nhanh:**
```json
{
  "objective": {
    "type": "time"
  },
  "cpm_prefs": {
    "allow_start_next_day": true,
    "criticality_threshold_days": 0
  }
}
```

**Ưu tiên cân bằng team:**
```json
{
  "objective": {
    "type": "resource"
  },
  "assignment_prefs": {
    "priority_mode": "weighted",
    "default_max_concurrent_tasks": 2
  }
}
```

**Cân bằng tổng thể:**
```json
{
  "objective": {
    "type": "multi",
    "weights": {
      "time_weight": 0.4,
      "resource_weight": 0.4,
      "cost_weight": 0.2
    }
  }
}
```

---

## 6. Lưu và áp dụng

### 6.1. Phạm vi cài đặt

| Phạm vi | project_id | Ưu tiên |
|---------|------------|---------|
| **Global** | null | Thấp |
| **Per-project** | có giá trị | Cao |

Nếu có cài đặt cho project cụ thể, sẽ dùng cài đặt đó thay vì global.

### 6.2. Quy trình lưu

```
[Thay đổi cài đặt trên UI]
         ↓
[Nhấn "Lưu"]
         ↓
[Gọi API POST /api/settings/algorithm]
         ↓
[Lưu vào algorithm_settings hoặc algorithm_global_settings]
         ↓
[Hiện thông báo thành công]
```

### 6.3. Khi nào áp dụng

Cài đặt được đọc khi:
- Chạy tối ưu hóa lịch trình
- Chạy phân công tự động RACI
- Xem preview phân công

---

## 7. API liên quan

### 7.1. Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/settings/algorithm` | Lấy cài đặt hiện tại |
| POST | `/api/settings/algorithm` | Lưu cài đặt |

### 7.2. Query Parameters

**GET:**
- `project_id` (optional): Lấy cài đặt cho dự án cụ thể

### 7.3. Ví dụ Request/Response

#### Lấy cài đặt

```http
GET /api/settings/algorithm

Response:
{
  "settings": {
    "algorithm": "multi_project_cpm",
    "objective": {
      "type": "multi",
      "weights": {
        "time_weight": 0.5,
        "resource_weight": 0.3,
        "cost_weight": 0.2
      }
    },
    "assignment_prefs": {
      "priority_mode": "weighted",
      "default_max_concurrent_tasks": 2,
      "min_confidence_R": 0.35,
      "min_confidence_A": 0.5,
      "unassigned_cost": 0.5,
      "allow_same_RA": true
    },
    "cpm_prefs": {
      "default_task_duration_days": 1,
      "allow_start_next_day": true,
      "criticality_threshold_days": 0,
      "free_float_warning_ratio": 0.2
    }
  }
}
```

#### Lưu cài đặt

```http
POST /api/settings/algorithm
Content-Type: application/json

{
  "project_id": null,
  "objective": {
    "type": "time"
  },
  "assignment_prefs": {
    "priority_mode": "lexi",
    "default_max_concurrent_tasks": 3,
    "min_confidence_R": 0.4
  },
  "cpm_prefs": {
    "criticality_threshold_days": 1
  }
}

Response:
{
  "success": true,
  "message": "Đã lưu cài đặt"
}
```

---

## Giao diện cài đặt

```
┌────────────────────────────────────────────────────────────────┐
│  Cài Đặt Thuật Toán                                [Lưu]      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Mục tiêu tối ưu:                                             │
│  ○ Thời gian  ○ Nguồn lực  ○ Chi phí  ● Kết hợp              │
│                                                                │
│  Trọng số (nếu chọn Kết hợp):                                 │
│  Thời gian: [====50%====]                                     │
│  Nguồn lực: [===30%===]                                       │
│  Chi phí:   [==20%==]                                         │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  Cài đặt phân công:                                           │
│                                                                │
│  Chế độ tính điểm: [Weighted ▼]                              │
│  Số task tối đa/người: [2]                                    │
│  Ngưỡng confidence R: [0.35]                                  │
│  Ngưỡng confidence A: [0.5]                                   │
│  Chi phí không gán: [0.5]                                     │
│  ☑ Cho phép 1 người vừa R vừa A                              │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  Cài đặt CPM:                                                 │
│                                                                │
│  Thời gian mặc định (ngày): [1]                              │
│  ☑ Bắt đầu ngày hôm sau                                      │
│  Ngưỡng critical (ngày): [0]                                  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Workflow

### Cài đặt cho dự án cụ thể

```
1. Vào trang dự án
2. Nhấn "Cài đặt thuật toán"
3. Điều chỉnh các tham số
4. Nhấn "Lưu"
5. Khi tối ưu, dự án này sẽ dùng cài đặt riêng
```

### Cài đặt global

```
1. Vào Dashboard → Settings
2. Chọn tab "Thuật toán"
3. Điều chỉnh các tham số
4. Nhấn "Lưu"
5. Tất cả dự án không có cài đặt riêng sẽ dùng cài đặt này
```

### Thử nghiệm tham số

```
1. Vào dự án → Gantt Chart
2. Thay đổi cài đặt
3. Nhấn "Tối ưu" để xem kết quả
4. So sánh với cài đặt khác
5. Chọn cài đặt phù hợp nhất
6. Lưu và áp dụng
```

---

## Tóm tắt

1. **Phân công:** priority_mode, max_concurrent_tasks, confidence thresholds
2. **CPM:** duration mặc định, start_next_day, criticality threshold
3. **Mục tiêu:** time, resource, cost, hoặc multi với weights
4. **Phạm vi:** Global (mặc định) hoặc Per-project (ưu tiên)
5. **Áp dụng:** Khi chạy tối ưu hoặc auto-assign
