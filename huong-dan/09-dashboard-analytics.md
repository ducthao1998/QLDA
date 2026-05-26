# Hướng Dẫn: Dashboard & Analytics

## Mục Lục
1. [Tổng quan](#1-tổng-quan)
2. [Các file liên quan](#2-các-file-liên-quan)
3. [Các tab chính](#3-các-tab-chính)
4. [Các chỉ số và KPI](#4-các-chỉ-số-và-kpi)
5. [Biểu đồ](#5-biểu-đồ)
6. [Bộ lọc](#6-bộ-lọc)
7. [API liên quan](#7-api-liên-quan)

---

## 1. Tổng quan

Dashboard cung cấp cái nhìn tổng quan về:
- Tiến độ dự án và công việc
- Hiệu suất team
- Xu hướng theo thời gian
- Phân tích nâng cao (bottleneck, dự báo)

---

## 2. Các file liên quan

### 2.1. Trang

```
src/app/dashboard/
└── page.tsx                    ← Trang dashboard chính
```

### 2.2. Components

```
src/components/dashboard/
├── dashboard-metrics.tsx       ← Card KPI
├── project-progress-chart.tsx  ← Biểu đồ tiến độ
├── projects-overview.tsx       ← Tổng quan dự án
├── recent-activity.tsx         ← Hoạt động gần đây
└── upcoming-deadlines.tsx      ← Deadline sắp tới
```

### 2.3. API

```
src/app/api/dashboard/
├── analytics/
│   └── route.ts                ← API tổng hợp analytics
├── metrics/
│   └── route.ts                ← API KPI cơ bản
├── project-stats/
│   └── route.ts                ← Thống kê dự án
├── activities/
│   └── route.ts                ← Hoạt động gần đây
└── deadlines/
    └── route.ts                ← Deadline sắp tới
```

---

## 3. Các tab chính

### 3.1. Giao diện

```
┌────────────────────────────────────────────────────────────────┐
│  Dashboard                    [7 ngày ▼] [Đơn vị ▼] [Làm mới] │
├────────────────────────────────────────────────────────────────┤
│  [Tổng quan] [Công việc] [Nhân sự] [Thời gian] [Phân tích]    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Dự án    │ │ Công việc│ │ Hoàn thành│ │ Đúng hạn │         │
│  │    12    │ │    156   │ │   78%    │ │   85%    │         │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
│                                                                │
│  [Biểu đồ tiến độ dự án]        [Phân bổ công việc]          │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 3.2. 5 Tab

| Tab | Nội dung |
|-----|----------|
| **Tổng quan** | KPI chính, biểu đồ tiến độ, phân bổ task |
| **Công việc** | Thống kê theo trạng thái, template, phân loại |
| **Nhân sự** | Hiệu suất cá nhân, sử dụng kỹ năng, workload |
| **Thời gian** | Xu hướng tháng, productivity tuần, deadline |
| **Phân tích** | Bottleneck, dự báo, đánh giá rủi ro |

---

## 4. Các chỉ số và KPI

### 4.1. Chỉ số tổng quan

| Chỉ số | Mô tả |
|--------|-------|
| Tổng dự án | Số dự án trong hệ thống |
| Dự án đang chạy | Dự án có status = in_progress |
| Tổng công việc | Số task trong hệ thống |
| Công việc hoàn thành | Task có status = done |
| Tỷ lệ hoàn thành | % task done / tổng task |
| Tỷ lệ đúng hạn | % task hoàn thành đúng/trước deadline |
| Task quá hạn | Số task chưa xong nhưng đã qua deadline |

### 4.2. KPI (Key Performance Indicators)

| KPI | Công thức | Ý nghĩa |
|-----|-----------|---------|
| **Efficiency Score** | 40% completion + 40% quality + 20% resource | Hiệu quả tổng thể |
| **Quality Score** | % task đúng hạn | Chất lượng giao hàng |
| **Resource Utilization** | Avg task/user | Sử dụng nguồn lực |
| **Compliance Score** | % tuân thủ quy trình | Tuân thủ |
| **Process Optimization** | Dựa trên efficiency | Tối ưu quy trình |

### 4.3. Thống kê công việc

**Theo trạng thái:**
```
todo         → Chờ làm
in_progress  → Đang làm
review       → Chờ duyệt
done         → Hoàn thành
blocked      → Bị chặn
archived     → Lưu trữ
```

**Theo template:**
- Tên template
- Số task sử dụng
- Thời gian trung bình

**Theo phân loại dự án:**
- Nhóm A, B, C
- Số task mỗi nhóm
- % hoàn thành

### 4.4. Thống kê nhân sự

| Chỉ số | Mô tả |
|--------|-------|
| Completion Rate | % task hoàn thành của user |
| Workload Score | Điểm khối lượng công việc |
| Task Count | Số task được gán |
| On-time Rate | % hoàn thành đúng hạn |

### 4.5. Phân tích nâng cao

**Bottleneck (Điểm nghẽn):**
- User quá tải
- Thiếu kỹ năng
- Task bị block lâu

**Dự báo:**
- Ngày hoàn thành dự kiến
- Độ tin cậy dự báo
- Rủi ro trễ deadline

---

## 5. Biểu đồ

### 5.1. Recharts (Dashboard chính)

| Loại | Dùng cho |
|------|----------|
| **PieChart** | Phân bổ task theo status, phân loại dự án |
| **BarChart** | Template stats, workload by unit, skill utilization |
| **AreaChart** | Xu hướng tháng (completed + created) |
| **LineChart** | Productivity score theo tuần |

### 5.2. Chart.js (ProjectProgressChart)

| Loại | Dùng cho |
|------|----------|
| **Bar Chart** | % tiến độ từng dự án |
| **Pie Chart** | Phân bổ task theo status |

### 5.3. UI Components

- **Progress Bar:** Thanh tiến độ với % |
- **Badge:** Chỉ số status/severity |
- **Card:** Tóm tắt metric với icon |
- **Table:** Bảng ranking và chi tiết |

---

## 6. Bộ lọc

### 6.1. Khoảng thời gian

| Lựa chọn | Mô tả |
|----------|-------|
| 7 ngày | 7 ngày gần nhất |
| 30 ngày | 30 ngày gần nhất |
| 90 ngày | 90 ngày gần nhất |
| 1 năm | 365 ngày gần nhất |
| Tháng này | Từ đầu tháng |

### 6.2. Đơn vị tổ chức

| Lựa chọn | Mô tả |
|----------|-------|
| Tất cả | Toàn bộ tổ chức |
| C12 | Đơn vị C12 |
| Phòng CNTT | Phòng CNTT |
| Phòng Kế hoạch | Phòng Kế hoạch |
| ... | Các đơn vị khác |

---

## 7. API liên quan

### 7.1. Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/dashboard/analytics` | Analytics tổng hợp |
| GET | `/api/dashboard/metrics` | KPI cơ bản |
| GET | `/api/dashboard/project-stats` | Thống kê dự án |
| GET | `/api/dashboard/activities` | Hoạt động gần đây |
| GET | `/api/dashboard/deadlines` | Deadline sắp tới |

### 7.2. Query Parameters

**Cho `/api/dashboard/analytics`:**

| Param | Mô tả |
|-------|-------|
| `from` | Ngày bắt đầu (ISO) |
| `to` | Ngày kết thúc (ISO) |
| `period` | ID khoảng thời gian |
| `org_unit` | Đơn vị tổ chức hoặc "all" |

### 7.3. Ví dụ Response

#### Analytics tổng hợp

```http
GET /api/dashboard/analytics?from=2024-01-01&to=2024-01-31&org_unit=all

Response:
{
  "overview": {
    "total_projects": 12,
    "active_projects": 8,
    "total_tasks": 156,
    "completed_tasks": 98,
    "completion_rate": 0.628,
    "on_time_rate": 0.85,
    "overdue_tasks": 5
  },
  "task_stats": {
    "by_status": {
      "todo": 20,
      "in_progress": 33,
      "review": 5,
      "done": 98
    },
    "by_template": [
      { "template": "Khảo sát", "count": 15, "avg_duration": 3.5 }
    ]
  },
  "user_stats": [
    {
      "user_id": "uuid-1",
      "full_name": "Nguyễn A",
      "completion_rate": 0.92,
      "workload_score": 0.7,
      "task_count": 12
    }
  ],
  "time_trends": {
    "monthly": [
      { "month": "2024-01", "completed": 45, "created": 30, "overdue": 3 }
    ],
    "weekly_productivity": [
      { "week": "W1", "score": 0.85 }
    ]
  },
  "advanced": {
    "bottlenecks": [
      { "type": "overloaded_user", "user": "Trần B", "tasks": 8 }
    ],
    "forecasts": [
      { "project": "Dự án X", "predicted_completion": "2024-02-15", "confidence": 0.8 }
    ],
    "kpis": {
      "efficiency": 0.78,
      "quality": 0.85,
      "utilization": 0.72
    }
  }
}
```

#### Hoạt động gần đây

```http
GET /api/dashboard/activities

Response:
{
  "activities": [
    {
      "id": "act-1",
      "type": "task_completed",
      "description": "Nguyễn A hoàn thành 'Thiết kế UI'",
      "timestamp": "2024-01-26T10:30:00Z",
      "user_name": "Nguyễn A"
    }
  ]
}
```

#### Deadline sắp tới

```http
GET /api/dashboard/deadlines

Response:
{
  "deadlines": [
    {
      "task_id": "task-1",
      "task_name": "Hoàn thiện API",
      "due_date": "2024-01-28",
      "days_remaining": 2,
      "assigned_to": "Trần B",
      "project_name": "Dự án ABC"
    }
  ]
}
```

---

## Workflow sử dụng

### Xem tổng quan hàng ngày

```
1. Vào Dashboard
2. Xem 4 card KPI chính:
   - Tổng dự án, công việc
   - Tỷ lệ hoàn thành, đúng hạn
3. Xem biểu đồ tiến độ dự án
4. Kiểm tra hoạt động gần đây
5. Xem deadline sắp tới
```

### Phân tích hiệu suất team

```
1. Vào Dashboard → Tab "Nhân sự"
2. Xem bảng ranking:
   - Ai completion rate cao?
   - Ai đang quá tải?
3. Xem biểu đồ skill utilization
4. Xem workload distribution by unit
```

### Theo dõi xu hướng

```
1. Vào Dashboard → Tab "Thời gian"
2. Chọn khoảng thời gian: 90 ngày
3. Xem monthly trends:
   - Task completed tăng hay giảm?
   - Task overdue có xu hướng gì?
4. Xem weekly productivity
5. Xem deadline performance (đúng hạn/trễ/sớm)
```

### Phát hiện vấn đề

```
1. Vào Dashboard → Tab "Phân tích"
2. Xem Bottleneck:
   - User nào quá tải?
   - Skill nào đang thiếu?
3. Xem Forecasts:
   - Dự án nào có nguy cơ trễ?
4. Xem Risk factors
5. Đưa ra hành động:
   - Điều phối lại workload
   - Bổ sung nhân sự có skill thiếu
```

---

## Tóm tắt

1. **5 Tab:** Tổng quan, Công việc, Nhân sự, Thời gian, Phân tích
2. **KPI chính:** Completion rate, On-time rate, Efficiency, Quality
3. **Biểu đồ:** Pie (phân bổ), Bar (so sánh), Line/Area (xu hướng)
4. **Bộ lọc:** Thời gian (7d-1y) và Đơn vị tổ chức
5. **Phân tích nâng cao:** Bottleneck, Forecast, Risk
6. **Real-time:** Dữ liệu tính toán trực tiếp từ database
