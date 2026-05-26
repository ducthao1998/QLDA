# Hướng Dẫn: Biểu Đồ Gantt

## Mục Lục
1. [Tổng quan](#1-tổng-quan)
2. [Các file liên quan](#2-các-file-liên-quan)
3. [Cấu trúc dữ liệu](#3-cấu-trúc-dữ-liệu)
4. [Giao diện và tính năng](#4-giao-diện-và-tính-năng)
5. [Xuất báo cáo](#5-xuất-báo-cáo)
6. [Tích hợp tối ưu hóa](#6-tích-hợp-tối-ưu-hóa)
7. [Phân tích vấn đề](#7-phân-tích-vấn-đề)
8. [API liên quan](#8-api-liên-quan)

---

## 1. Tổng quan

Biểu đồ Gantt hiển thị trực quan lịch trình dự án:
- Các task trên timeline
- Mối quan hệ phụ thuộc
- Đường găng (critical path)
- Tiến độ thực hiện
- Xuất báo cáo PDF/Excel

**Thư viện:** DHTMLX Gantt

---

## 2. Các file liên quan

### 2.1. Trang

```
src/app/dashboard/gantt/
└── page.tsx                    ← Trang Gantt chính với tabs
```

### 2.2. Components

```
src/components/
├── gantt-chart.tsx             ← Component Gantt chính
└── gantt/
    ├── types.ts                ← Định nghĩa kiểu dữ liệu
    ├── utils.ts                ← Hàm tiện ích (sort, date)
    ├── useDhtmlxGantt.ts       ← Hook khởi tạo Gantt
    ├── analysis.ts             ← Phân tích vấn đề task
    ├── export-pdf.ts           ← Xuất PDF
    └── export-excel.ts         ← Xuất Excel
```

### 2.3. API

```
src/app/api/projects/[id]/
├── gantt/
│   └── route.ts                ← Lấy dữ liệu Gantt
└── optimize/
    └── route.ts                ← Tối ưu lịch trình
```

---

## 3. Cấu trúc dữ liệu

### 3.1. Task trong Gantt

```typescript
interface GanttTask {
  id: string
  name: string
  duration_days: number
  status: "todo" | "in_progress" | "done" | "blocked"
  progress: number              // 0-100
  assigned_to?: string
  assigned_user_name?: string
  dependencies: string[]        // Mảng task_id phụ thuộc
  is_overdue: boolean
  is_critical_path?: boolean
  calculated_start_date?: string
  calculated_end_date?: string
  level?: number                // Cấp trong cây phụ thuộc
  has_dependencies?: boolean
}
```

### 3.2. Kết quả tối ưu

```typescript
interface OptimizationResult {
  algorithm_used: string
  original_makespan: number     // Ngày trước tối ưu
  optimized_makespan: number    // Ngày sau tối ưu
  improvement_percentage: number
  resource_utilization: number  // 0-1
  critical_path: string[]       // Mảng task_id
  optimized_schedule: Task[]
}
```

---

## 4. Giao diện và tính năng

### 4.1. Bố cục

```
┌────────────────────────────────────────────────────────────────┐
│  [Chọn dự án ▼]  [Ngày] [Tuần] [Tháng]  [Lọc ▼]  [Xuất ▼]    │
├────────────────────────────────────────────────────────────────┤
│  Tab: [Biểu đồ Gantt] [Kết quả tối ưu]                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Task Name      │ T2  T3  T4  T5  T6  T7  CN  T2  T3  ...    │
│  ─────────────────────────────────────────────────────────────│
│  Task A         │ ████████████                                │
│  Task B         │         ▓▓▓▓▓▓▓▓ (critical)                │
│  Task C         │                 ░░░░░░░░░                   │
│                 │         ↗─────────────────↗ (dependency)    │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 4.2. Chế độ xem thời gian

| Chế độ | Mô tả |
|--------|-------|
| **Ngày** | Mỗi cột = 1 ngày |
| **Tuần** | Mỗi cột = 1 tuần |
| **Tháng** | Mỗi cột = 1 tháng |

### 4.3. Mã màu task

| Màu | Ý nghĩa |
|-----|---------|
| Xanh dương | Đang thực hiện |
| Xanh lá | Hoàn thành |
| Đỏ | Trên đường găng (critical) |
| Vàng/Cam | Quá hạn |
| Xám | Chờ làm |

### 4.4. Bộ lọc

- **Hiện/ẩn task không có phụ thuộc:** Toggle để lọc
- **Làm mới dữ liệu:** Xóa cache và tải lại

### 4.5. Tương tác

- **Click task:** Xem chi tiết
- **Hover:** Hiện tooltip thông tin
- **Đường nối:** Hiển thị dependency

---

## 5. Xuất báo cáo

### 5.1. Xuất PDF

**File:** `src/components/gantt/export-pdf.ts`

Nội dung PDF:
1. **Trang 1:** Tóm tắt biểu đồ Gantt
2. **Trang 2:** Bảng lịch trình chi tiết
3. **Trang 3:** Phân tích vấn đề theo mức độ nghiêm trọng

**Tính năng:**
- Hỗ trợ tiếng Việt (font NotoSans)
- Tự động chọn độ chi tiết (năm/quý/tháng/tuần theo duration)
- Multi-page nếu nội dung dài

### 5.2. Xuất Excel

**File:** `src/components/gantt/export-excel.ts`

Nội dung Excel:
- **Sheet 1:** Lịch trình (tên, ngày, người gán, trạng thái)
- **Sheet 2:** Phân tích vấn đề

---

## 6. Tích hợp tối ưu hóa

### 6.1. Quy trình

```
[Xem Gantt hiện tại]
         ↓
[Nhấn "Tối ưu hóa"]
         ↓
[Hệ thống chạy:]
- Experience Matrix
- CPM (đường găng)
- Hungarian Assignment
         ↓
[Hiển thị tab "Kết quả tối ưu"]
         ↓
[So sánh: Trước vs Sau]
         ↓
[Nhấn "Lưu bản nháp"]
         ↓
[Nhấn "Chấp nhận" để kích hoạt]
```

### 6.2. Thông tin CPM trả về

```typescript
cpm_details: {
  criticalPath: string[]    // Các task trên đường găng
  taskDetails: [{
    taskId: string
    duration: number
    slack: number           // Thời gian đệm
    reason: string          // Giải thích
    drivingPredecessorIds: string[]
    isCritical: boolean
  }]
}
```

---

## 7. Phân tích vấn đề

**File:** `src/components/gantt/analysis.ts`

### 7.1. Các loại vấn đề phát hiện

| Loại | Mô tả |
|------|-------|
| **Overdue** | Task quá hạn, tính số ngày trễ |
| **Critical Path** | Task trên đường găng |
| **Dependency Block** | Task bị chặn bởi task khác |

### 7.2. Mức độ nghiêm trọng

| Mức | Mô tả |
|-----|-------|
| `critical` | Ảnh hưởng nghiêm trọng đến dự án |
| `high` | Cần xử lý sớm |
| `medium` | Cần theo dõi |
| `low` | Ảnh hưởng nhỏ |

### 7.3. Kết quả phân tích

```typescript
analysis[taskId] = {
  taskId: string
  taskName: string
  issues: [{
    type: string
    severity: "critical" | "high" | "medium" | "low"
    title: string
    description: string
    rootCause: string
  }]
  severity: string          // Mức cao nhất của các issues
  impact: {
    directImpact: number    // Số task bị ảnh hưởng trực tiếp
    totalImpact: number     // Tổng task bị ảnh hưởng
    affectedTaskIds: string[]
    impactDescription: string
  }
  currentStatus: {
    status: string
    description: string
    color: string
  }
  nextActions: [{
    priority: number
    action: string
    description: string
    deadline?: string
  }]
}
```

---

## 8. API liên quan

### 8.1. Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/projects/[id]/gantt` | Lấy dữ liệu Gantt |
| POST | `/api/projects/[id]/optimize` | Chạy tối ưu |
| POST | `/api/projects/[id]/schedule/optimize` | Lưu schedule nháp |
| POST | `/api/schedules/[runId]/accept` | Chấp nhận schedule |

### 8.2. Ví dụ Response

#### Lấy dữ liệu Gantt

```http
GET /api/projects/project-123/gantt

Response:
{
  "project": {
    "id": "project-123",
    "name": "Dự án ABC",
    "start_date": "2024-01-01"
  },
  "tasks": [
    {
      "id": "task-1",
      "name": "Thiết kế",
      "duration_days": 5,
      "status": "done",
      "progress": 100,
      "dependencies": [],
      "is_critical_path": true,
      "calculated_start_date": "2024-01-01",
      "calculated_end_date": "2024-01-05"
    },
    {
      "id": "task-2",
      "name": "Phát triển",
      "duration_days": 10,
      "status": "in_progress",
      "progress": 50,
      "dependencies": ["task-1"],
      "is_critical_path": true,
      "calculated_start_date": "2024-01-06",
      "calculated_end_date": "2024-01-15"
    }
  ],
  "cpm_details": {
    "criticalPath": ["task-1", "task-2"],
    "taskDetails": [...]
  }
}
```

---

## Workflow sử dụng

### Xem và phân tích Gantt

```
1. Vào Dashboard → Gantt Chart
2. Chọn dự án từ dropdown
3. Xem biểu đồ:
   - Task màu đỏ = critical path
   - Task màu vàng = quá hạn
   - Đường nối = dependency
4. Chọn chế độ xem: Ngày/Tuần/Tháng
5. Click task để xem chi tiết
```

### Tối ưu và áp dụng

```
1. Xem Gantt hiện tại
2. Nhấn "Tối ưu hóa"
3. Chuyển sang tab "Kết quả tối ưu"
4. Xem so sánh:
   - Makespan trước: 45 ngày
   - Makespan sau: 30 ngày
   - Cải thiện: 33%
5. Nhấn "Lưu bản nháp"
6. Nhấn "Chấp nhận" để áp dụng
7. Gantt cập nhật lịch mới
```

### Xuất báo cáo

```
1. Xem Gantt
2. Nhấn "Xuất" → Chọn PDF hoặc Excel
3. File tự động tải về
4. PDF gồm: Gantt + Bảng lịch + Phân tích vấn đề
5. Excel gồm: Sheet lịch trình + Sheet vấn đề
```

---

## Tóm tắt

1. **DHTMLX Gantt:** Thư viện hiển thị biểu đồ chuyên nghiệp
2. **3 chế độ xem:** Ngày, Tuần, Tháng
3. **Mã màu:** Đỏ = critical, Vàng = overdue, Xanh = done
4. **Tích hợp CPM:** Tự động tính đường găng
5. **Xuất báo cáo:** PDF và Excel với phân tích chi tiết
6. **Phân tích vấn đề:** Phát hiện overdue, critical, blocking
