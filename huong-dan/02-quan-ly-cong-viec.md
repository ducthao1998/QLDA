# Hướng Dẫn: Quản Lý Công Việc (Task)

## Mục Lục
1. [Tổng quan](#1-tổng-quan)
2. [Cấu trúc dữ liệu công việc](#2-cấu-trúc-dữ-liệu-công-việc)
3. [Các file liên quan](#3-các-file-liên-quan)
4. [Luồng trạng thái công việc](#4-luồng-trạng-thái-công-việc)
5. [Tạo công việc mới](#5-tạo-công-việc-mới)
6. [Chỉnh sửa công việc](#6-chỉnh-sửa-công-việc)
7. [Phân công RACI](#7-phân-công-raci)
8. [Gán kỹ năng cho công việc](#8-gán-kỹ-năng-cho-công-việc)
9. [Danh sách công việc](#9-danh-sách-công-việc)
10. [API liên quan](#10-api-liên-quan)

---

## 1. Tổng quan

Quản lý công việc là tính năng cốt lõi của hệ thống, cho phép:
- Tạo công việc thủ công hoặc từ template
- Theo dõi trạng thái công việc qua các giai đoạn
- Phân công người thực hiện theo ma trận RACI
- Gán kỹ năng yêu cầu cho công việc
- Thiết lập mối quan hệ phụ thuộc giữa các công việc
- Tự động tạo worklog khi hoàn thành

---

## 2. Cấu trúc dữ liệu công việc

### 2.1. Bảng `tasks` trong database

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | UUID | Mã định danh |
| `name` | text | Tên công việc (bắt buộc, tối thiểu 3 ký tự) |
| `note` | text | Mô tả chi tiết |
| `status` | text | Trạng thái hiện tại |
| `project_id` | UUID | Dự án chứa công việc |
| `assigned_to` | UUID | Người được giao (chính) |
| `duration_days` | integer | Số ngày thực hiện |
| `start_date` | timestamp | Ngày bắt đầu dự kiến |
| `end_date` | timestamp | Ngày kết thúc dự kiến |
| `due_date` | date | Hạn chót |
| `template_id` | integer | ID template gốc (nếu tạo từ template) |
| `is_imported` | boolean | Có phải import từ template không |
| `unit_in_charge` | text | Đơn vị phụ trách |
| `created_at` | timestamp | Thời điểm tạo |
| `updated_at` | timestamp | Thời điểm cập nhật cuối |

### 2.2. Interface TypeScript

**File:** `src/app/types/table-types.ts`

```typescript
export interface Task {
  id: number
  name: string
  note: string | null
  status: TaskStatus
  project_id: string
  assigned_to: string | null
  duration_days: number | null
  start_date: string | null
  end_date: string | null
  template_id: number | null
  unit_in_charge: string | null
  created_at: string
  updated_at: string
}

// Các trạng thái hợp lệ
export type TaskStatus =
  | "todo"
  | "in_progress"
  | "review"
  | "done"
  | "blocked"
  | "archived"
```

---

## 3. Các file liên quan

### 3.1. Trang (Pages)

```
src/app/dashboard/tasks/
├── page.tsx                    ← Trang quản lý task template
└── [id]/
    ├── page.tsx                ← Trang chi tiết công việc
    └── edit/
        └── page.tsx            ← Trang chỉnh sửa công việc
```

### 3.2. Components

```
src/components/task/
├── task-form.tsx               ← Form tạo công việc cơ bản
├── task-edit-form.tsx          ← Form chỉnh sửa đầy đủ
├── tasks-list.tsx              ← Bảng danh sách công việc
├── taskcard.tsx                ← Card hiển thị 1 công việc
├── add-task-dialog.tsx         ← Dialog chọn template
├── dependency-tree-visualization.tsx  ← Hiển thị cây phụ thuộc
└── task-edit-tabs/
    ├── task-detail-tabs.tsx        ← Tab thông tin chi tiết
    └── task-assignments-tab.tsx    ← Tab phân công RACI
```

### 3.3. API Routes

```
src/app/api/tasks/
├── route.ts                    ← GET (danh sách), POST (tạo mới)
└── [id]/
    ├── route.ts                ← GET, PATCH, DELETE
    ├── raci/
    │   └── route.ts            ← Quản lý phân công RACI
    ├── skills/
    │   └── route.ts            ← Quản lý kỹ năng yêu cầu
    ├── dependencies/
    │   └── route.ts            ← Quản lý phụ thuộc
    └── progress/
        └── route.ts            ← Tiến độ công việc
```

---

## 4. Luồng trạng thái công việc

### 4.1. Sơ đồ trạng thái

```
┌─────────────┐
│    todo     │  ← Trạng thái mặc định khi tạo
│  (Chờ làm)  │
└─────┬───────┘
      │
      ▼
┌─────────────────┐
│  in_progress    │  ← Đang được thực hiện
│  (Đang làm)     │
└─────┬───────────┘
      │
      ├──────────────────┐
      │                  │
      ▼                  ▼
┌─────────────┐    ┌────────────┐
│   review    │    │  blocked   │
│ (Chờ duyệt) │    │ (Bị chặn)  │
└─────┬───────┘    └────────────┘
      │
      ▼
┌─────────────┐
│    done     │  ← Hoàn thành
│(Xong)       │
└─────────────┘
```

### 4.2. Ý nghĩa từng trạng thái

| Trạng thái | Tiếng Việt | Mô tả |
|------------|------------|-------|
| `todo` | Chờ làm | Công việc mới, chưa ai bắt đầu |
| `in_progress` | Đang làm | Đang được thực hiện |
| `review` | Chờ duyệt | Đã làm xong, chờ kiểm tra |
| `done` | Hoàn thành | Đã xong và được duyệt |
| `blocked` | Bị chặn | Không thể tiếp tục (chờ công việc khác) |
| `archived` | Lưu trữ | Không hoạt động, giữ lại để tham khảo |

### 4.3. Hành động tự động khi chuyển sang "done"

Khi công việc được đánh dấu hoàn thành, hệ thống tự động:

1. **Tạo worklog:** Ghi nhận thời gian làm việc cho người phụ trách (R)
2. **Cập nhật tiến độ:** Tạo bản ghi `task_progress` với thời điểm hoàn thành
3. **Ghi lịch sử:** Tạo bản ghi `task_history` ghi nhận sự kiện
4. **Cập nhật kỹ năng:** Refresh `user_skill_matrix` - tăng kinh nghiệm người thực hiện

**Cách tính worklog:**
```
Số giờ = duration_days × 8 (giờ/ngày) ÷ số người phụ trách (R)
```

---

## 5. Tạo công việc mới

### 5.1. Cách 1: Tạo thủ công

**File:** `src/components/task/task-form.tsx`

#### Các bước:

1. Vào trang chi tiết dự án
2. Chọn tab "Công việc"
3. Nhấn nút "Thêm công việc"
4. Điền form:
   - Tên công việc (bắt buộc)
   - Mô tả
   - Số ngày thực hiện
5. Nhấn "Tạo"

#### Validation:

```typescript
const formSchema = z.object({
  name: z.string().min(3, 'Tên phải có ít nhất 3 ký tự'),
  note: z.string().optional(),
  status: z.string().default('todo'),
  duration_days: z.number().min(1).optional(),
})
```

### 5.2. Cách 2: Tạo từ Template

**File:** `src/components/task/add-task-dialog.tsx`

#### Các bước:

1. Vào trang chi tiết dự án
2. Chọn tab "Công việc"
3. Nhấn "Thêm từ Template"
4. Dialog hiện ra với danh sách template khả dụng
5. Tick chọn các template muốn dùng (có thể chọn nhiều)
6. Nhấn "Thêm X công việc"

#### Sơ đồ luồng:

```
[Nhấn "Thêm từ Template"]
         ↓
[Gọi API lấy template khả dụng]
GET /api/projects/{id}/available-templates
         ↓
[Hiển thị danh sách checkbox]
         ↓
[Người dùng chọn template]
         ↓
[Nhấn "Thêm"]
         ↓
[Gọi API tạo công việc]
POST /api/projects/{id}/tasks
{
  template_ids: [1, 3, 5]
}
         ↓
[Hệ thống tạo công việc với:]
- Tên, mô tả từ template
- Số ngày từ default_duration_days
- Dependencies từ template
- Skills từ template
         ↓
[Hiển thị thông báo thành công]
```

#### Ưu điểm dùng template:
- Đảm bảo tính nhất quán giữa các dự án
- Tiết kiệm thời gian nhập liệu
- Tự động thiết lập dependencies và skills

---

## 6. Chỉnh sửa công việc

**File:** `src/components/task/task-edit-form.tsx`

### 6.1. Giao diện Tab

Trang chỉnh sửa có 3 tab chính:

```
┌──────────────┬──────────────┬──────────────┐
│  Chi tiết    │   Phân công  │  Phụ thuộc   │
└──────────────┴──────────────┴──────────────┘
```

### 6.2. Tab Chi tiết

**File:** `src/components/task/task-edit-tabs/task-detail-tabs.tsx`

Các trường có thể sửa:

| Trường | Mô tả |
|--------|-------|
| Tên công việc | Tên ngắn gọn |
| Ghi chú | Mô tả chi tiết |
| Số ngày | Thời gian dự kiến |
| Kỹ năng | Chọn từ danh sách (xem phần 8) |

### 6.3. Tab Phân công

Xem chi tiết ở [phần 7](#7-phân-công-raci)

### 6.4. Tab Phụ thuộc

Xem chi tiết ở file `03-dependencies.md`

### 6.5. Dropdown trạng thái

Ở góc phải trên có dropdown chọn trạng thái. Khi thay đổi và lưu:

```typescript
// Gọi API cập nhật
await fetch(`/api/tasks/${taskId}`, {
  method: 'PATCH',
  body: JSON.stringify({
    status: 'in_progress'  // hoặc trạng thái khác
  })
})
```

---

## 7. Phân công RACI

**File:** `src/components/task/task-edit-tabs/task-assignments-tab.tsx`

### 7.1. RACI là gì?

RACI là phương pháp phân công trách nhiệm:

| Vai trò | Ý nghĩa | Số lượng/task |
|---------|---------|---------------|
| **R** - Responsible | Người trực tiếp thực hiện | Đúng 1 người |
| **A** - Accountable | Người chịu trách nhiệm cuối cùng, quyết định | 0 hoặc 1 người |
| **C** - Consulted | Người được hỏi ý kiến, tư vấn | Nhiều người |
| **I** - Informed | Người được thông báo kết quả | Nhiều người |

### 7.2. Giao diện phân công

```
┌────────────────────────────────────────────────┐
│  Danh sách thành viên                          │
├────────────────────────────────────────────────┤
│  Nguyễn Văn A    [R] [A] [C] [I]              │
│  Trần Thị B      [R] [A] [C] [I]   ← Đang là R│
│  Lê Văn C        [R] [A] [C] [I]              │
│  ...                                           │
├────────────────────────────────────────────────┤
│  [Phân công tự động]                           │
└────────────────────────────────────────────────┘
```

### 7.3. Phân công thủ công

1. Mở tab "Phân công"
2. Nhìn danh sách thành viên
3. Nhấn nút [R], [A], [C], hoặc [I] bên cạnh tên người
4. Nút được chọn sẽ đổi màu (xanh)
5. Lưu form để áp dụng

**Lưu ý:**
- Chỉ có 1 người được gán R (nhấn R cho người khác sẽ bỏ R của người cũ)
- Chỉ có 1 người được gán A
- C và I có thể gán cho nhiều người (toggle on/off)

### 7.4. Phân công tự động (AI)

Hệ thống có thể tự động đề xuất phân công dựa trên:

**Các yếu tố đánh giá:**

1. **Độ phù hợp kỹ năng (40%)**
   - Người dùng có kỹ năng task yêu cầu không?
   - Mức độ thành thạo của kỹ năng đó?

2. **Khối lượng công việc (30%)**
   - Số task đang làm hiện tại
   - Giới hạn max_concurrent_tasks của người đó
   - Còn capacity không?

3. **Tỷ lệ thành công (30%)**
   - Tỷ lệ hoàn thành task trước đây
   - Tỷ lệ đúng hạn
   - Chất lượng công việc

**Công thức:**
```
Điểm = (Kỹ năng × 0.4) + (Workload × 0.3) + (Thành công × 0.3)

Gán R nếu điểm > 35%
Gán A nếu điểm > 50%
```

**Cách sử dụng:**

1. Mở tab "Phân công"
2. Nhấn nút "Phân công tự động"
3. Hệ thống tính toán và hiển thị đề xuất
4. Xem xét và điều chỉnh nếu cần
5. Lưu để áp dụng

### 7.5. Database

**Bảng `task_raci`:**

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `task_id` | UUID | Công việc |
| `user_id` | UUID | Người được gán |
| `role` | text | R, A, C hoặc I |
| `created_at` | timestamp | Thời điểm gán |

---

## 8. Gán kỹ năng cho công việc

### 8.1. Mục đích

Gán kỹ năng yêu cầu giúp:
- Hệ thống đề xuất người phù hợp (auto-assign)
- Theo dõi kỹ năng được sử dụng
- Cập nhật kinh nghiệm người thực hiện khi hoàn thành

### 8.2. Giao diện

Trong tab "Chi tiết", có phần chọn kỹ năng:

```
Kỹ năng yêu cầu:
┌─────────────────────────────────────────────┐
│ [Lập trình] [Thiết kế] [Quản lý] [Phân tích]│
│ [Kiểm thử]  [Tài liệu] [Đào tạo]            │
└─────────────────────────────────────────────┘
         ↑                    ↑
      Đã chọn            Chưa chọn
      (màu xanh)         (viền trắng)
```

### 8.3. Cách sử dụng

1. Mở trang chỉnh sửa công việc
2. Trong tab "Chi tiết"
3. Nhấn vào badge kỹ năng để chọn/bỏ chọn
4. Kỹ năng được chọn sẽ đổi màu
5. Lưu form để áp dụng

### 8.4. API

```http
# Lấy kỹ năng của task
GET /api/tasks/{id}/skills

# Cập nhật kỹ năng (thay thế toàn bộ)
PUT /api/tasks/{id}/skills
{
  "skills": [1, 3, 5]  // Mảng ID kỹ năng
}
```

### 8.5. Database

**Bảng `task_skills`:**

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `task_id` | UUID | Công việc |
| `skill_id` | integer | Kỹ năng yêu cầu |
| `created_at` | timestamp | Thời điểm gán |

---

## 9. Danh sách công việc

**File:** `src/components/task/tasks-list.tsx`

### 9.1. Tính năng

| Tính năng | Mô tả |
|-----------|-------|
| Tìm kiếm | Theo tên hoặc người được giao |
| Lọc | Theo trạng thái |
| Sắp xếp | Theo tên, trạng thái, người giao, thứ tự phụ thuộc |
| Phân trang | 10 item/trang |
| Chọn nhiều | Checkbox để xóa hàng loạt |

### 9.2. Các cột hiển thị

```
┌──────┬────────────┬──────────┬───────────┬──────────┐
│  ☐   │ Tên        │ Trạng thái│ Người giao│ Hành động│
├──────┼────────────┼──────────┼───────────┼──────────┤
│  ☐   │ Task A     │ Đang làm │ Nguyễn A  │ [Chi tiết]│
│  ☐   │ Task B     │ Chờ làm  │ Trần B    │ [Chi tiết]│
└──────┴────────────┴──────────┴───────────┴──────────┘
```

### 9.3. Thống kê nhanh

Phía trên danh sách có các card thống kê:

```
┌────────────┬────────────┬────────────┬────────────┐
│ Tổng: 25   │ Đang làm:8 │ Chờ làm:10 │ Xong: 7    │
└────────────┴────────────┴────────────┴────────────┘
```

---

## 10. API liên quan

### 10.1. Quản lý công việc

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/tasks` | Lấy danh sách tất cả task |
| POST | `/api/tasks` | Tạo task mới |
| GET | `/api/tasks/[id]` | Lấy chi tiết 1 task |
| PATCH | `/api/tasks/[id]` | Cập nhật task |
| DELETE | `/api/tasks/[id]` | Xóa task |

### 10.2. Task trong dự án

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/projects/[id]/tasks` | Lấy task của dự án |
| POST | `/api/projects/[id]/tasks` | Tạo task (từ template) |

### 10.3. RACI

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/tasks/[id]/raci` | Lấy phân công RACI |
| POST | `/api/tasks/[id]/raci` | Thêm phân công |
| DELETE | `/api/tasks/[id]/raci` | Xóa phân công |
| POST | `/api/tasks/auto-assign-raci` | Phân công tự động |

### 10.4. Kỹ năng

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/tasks/[id]/skills` | Lấy kỹ năng của task |
| PUT | `/api/tasks/[id]/skills` | Cập nhật kỹ năng |
| DELETE | `/api/tasks/[id]/skills` | Xóa tất cả kỹ năng |

### 10.5. Ví dụ Request/Response

#### Tạo task từ template

```http
POST /api/projects/abc-123/tasks
Content-Type: application/json

{
  "template_ids": [1, 3, 5]
}

Response (201):
{
  "tasks": [
    {
      "id": "task-001",
      "name": "Khảo sát hiện trạng",
      "status": "todo",
      "duration_days": 5
    },
    {
      "id": "task-002",
      "name": "Lập báo cáo",
      "status": "todo",
      "duration_days": 3
    }
  ]
}
```

#### Cập nhật trạng thái

```http
PATCH /api/tasks/task-001
Content-Type: application/json

{
  "status": "done"
}

Response (200):
{
  "id": "task-001",
  "status": "done",
  "updated_at": "2024-01-15T10:30:00Z"
}

# Hệ thống tự động:
# - Tạo worklog cho người R
# - Cập nhật user_skill_matrix
# - Ghi task_history
```

#### Phân công RACI

```http
POST /api/tasks/task-001/raci
Content-Type: application/json

{
  "user_id": "user-abc",
  "role": "R"
}

Response (200):
{
  "task_id": "task-001",
  "user_id": "user-abc",
  "role": "R",
  "created_at": "2024-01-15T10:00:00Z"
}
```

---

## Ví dụ: Vòng đời hoàn chỉnh của 1 công việc

```
1. TẠO CÔNG VIỆC
   └─ Chọn template "Thiết kế UI"
   └─ Hệ thống tạo task với:
      ├─ Tên: "Thiết kế UI"
      ├─ Trạng thái: todo
      ├─ Số ngày: 3
      └─ Kỹ năng: [Thiết kế, Figma]

2. PHÂN CÔNG
   └─ Mở task → Tab Phân công
   └─ Nhấn "Phân công tự động"
   └─ Hệ thống đề xuất: Nguyễn A (85% phù hợp)
   └─ Xác nhận → Gán R cho Nguyễn A

3. BẮT ĐẦU LÀM
   └─ Quản lý đổi trạng thái: todo → in_progress
   └─ Nguyễn A bắt đầu thực hiện

4. HOÀN THÀNH
   └─ Đổi trạng thái: in_progress → review
   └─ Quản lý kiểm tra
   └─ Đổi trạng thái: review → done
   └─ Hệ thống tự động:
      ├─ Tạo worklog: Nguyễn A, 24 giờ
      ├─ Cập nhật skill "Thiết kế" của Nguyễn A (+1 task)
      └─ Task tiếp theo (nếu có) được mở khóa
```

---

## Tóm tắt

1. **Trạng thái:** todo → in_progress → review → done (không bỏ qua bước)
2. **RACI:** Luôn gán ít nhất 1 người R để theo dõi và tạo worklog
3. **Kỹ năng:** Gán đủ kỹ năng để hệ thống đề xuất người phù hợp
4. **Template:** Dùng template để tiết kiệm thời gian và đảm bảo nhất quán
5. **Tự động hóa:** Khi task done, worklog và kinh nghiệm tự động cập nhật
