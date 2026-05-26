# Hướng Dẫn: Ma Trận RACI

## Mục Lục
1. [Tổng quan](#1-tổng-quan)
2. [4 vai trò RACI](#2-4-vai-trò-raci)
3. [Các file liên quan](#3-các-file-liên-quan)
4. [Phân công thủ công](#4-phân-công-thủ-công)
5. [Phân công tự động](#5-phân-công-tự-động)
6. [Thuật toán chi tiết](#6-thuật-toán-chi-tiết)
7. [Giao diện ma trận RACI](#7-giao-diện-ma-trận-raci)
8. [Tổ chức bên ngoài](#8-tổ-chức-bên-ngoài)
9. [API liên quan](#9-api-liên-quan)

---

## 1. Tổng quan

RACI là phương pháp phân công trách nhiệm trong quản lý dự án, giúp xác định:
- Ai làm việc gì
- Ai chịu trách nhiệm cuối cùng
- Ai cần được hỏi ý kiến
- Ai cần được thông báo

---

## 2. 4 vai trò RACI

### 2.1. Bảng tóm tắt

| Vai trò | Tiếng Việt | Số lượng/task | Màu badge |
|---------|------------|---------------|-----------|
| **R** - Responsible | Người thực hiện | Đúng 1 | Xanh dương |
| **A** - Accountable | Người chịu trách nhiệm | 0 hoặc 1 | Xanh lá |
| **C** - Consulted | Người tư vấn | Nhiều | Vàng |
| **I** - Informed | Người được thông báo | Nhiều | Xám |

### 2.2. Chi tiết từng vai trò

#### R - Responsible (Người thực hiện)

```
Định nghĩa: Người trực tiếp làm công việc

Trách nhiệm:
- Thực hiện công việc
- Hoàn thành sản phẩm
- Báo cáo tiến độ

Ví dụ: Developer viết code cho tính năng X
```

#### A - Accountable (Người chịu trách nhiệm)

```
Định nghĩa: Người chịu trách nhiệm cuối cùng về kết quả

Trách nhiệm:
- Đảm bảo công việc hoàn thành đúng
- Ra quyết định cuối cùng
- Chịu trách nhiệm về chất lượng

Ví dụ: Team Lead duyệt code review
```

#### C - Consulted (Người tư vấn)

```
Định nghĩa: Người được hỏi ý kiến trước khi quyết định

Trách nhiệm:
- Đưa ra ý kiến chuyên môn
- Tham gia thảo luận
- Giúp định hướng giải pháp

Ví dụ: Chuyên gia bảo mật tư vấn về implementation
```

#### I - Informed (Người được thông báo)

```
Định nghĩa: Người cần biết kết quả sau khi hoàn thành

Trách nhiệm:
- Nhận thông tin cập nhật
- Nắm bắt tiến độ
- Không tham gia trực tiếp

Ví dụ: Stakeholder nhận báo cáo tiến độ dự án
```

### 2.3. Quy tắc quan trọng

```
✓ Mỗi task phải có ĐÚNG 1 người R
✓ Mỗi task nên có TỐI ĐA 1 người A
✓ C và I có thể có NHIỀU người
✓ Một người có thể vừa R vừa A (tùy cài đặt)
```

---

## 3. Các file liên quan

### 3.1. Trang

```
src/app/dashboard/raci/
└── page.tsx                    ← Trang ma trận RACI chính
```

### 3.2. Components

```
src/components/raci/
├── raci-matrix.tsx             ← Hiển thị ma trận
├── raci-matrix-container.tsx   ← Container với bộ lọc
├── raci-filters.tsx            ← Giao diện lọc
└── raci-export.tsx             ← Xuất dữ liệu

src/components/project/
├── project-raci.tsx            ← RACI theo dự án
└── auto-assign-raci-modal.tsx  ← Modal phân công tự động
```

### 3.3. API Routes

```
src/app/api/projects/[id]/
├── raci/
│   ├── route.ts                ← GET, POST RACI
│   └── clear/
│       └── route.ts            ← Xóa tất cả RACI
└── auto-assign-raci/
    └── route.ts                ← Phân công tự động
```

### 3.4. Thuật toán

```
src/algorithm/
├── experience-matrix.ts        ← Tính điểm kinh nghiệm
└── hungarian-assignment.ts     ← Thuật toán phân công tối ưu
```

---

## 4. Phân công thủ công

### 4.1. Nơi phân công

Có 2 nơi để phân công RACI:

**Cách 1:** Trong trang chi tiết dự án → Tab RACI
**Cách 2:** Trong trang chỉnh sửa công việc → Tab Phân công

### 4.2. Các bước phân công (Cách 1)

1. Vào trang chi tiết dự án
2. Chọn tab "RACI"
3. Nhấn "Thêm RACI"
4. Dialog hiện ra:
   ```
   ┌──────────────────────────────────────┐
   │  Thêm phân công RACI                 │
   ├──────────────────────────────────────┤
   │  Công việc: [Dropdown chọn task]     │
   │                                      │
   │  Vai trò:   [R] [A] [C] [I]         │
   │                                      │
   │  Gán cho:                            │
   │  ○ Người dùng: [Dropdown]            │
   │  ○ Tổ chức ngoài: [Dropdown]         │
   │                                      │
   │  [Hủy]              [Thêm RACI]      │
   └──────────────────────────────────────┘
   ```
5. Chọn task, vai trò, và người/tổ chức
6. Nhấn "Thêm RACI"

### 4.3. Các bước phân công (Cách 2)

1. Vào trang chỉnh sửa công việc
2. Chọn tab "Phân công"
3. Xem danh sách thành viên
4. Nhấn nút [R], [A], [C], hoặc [I] bên cạnh tên
5. Lưu form

### 4.4. Cấu trúc database

**Bảng `task_raci`:**

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | serial | Mã định danh |
| `task_id` | text | Công việc |
| `user_id` | text | Người được gán (null nếu là tổ chức ngoài) |
| `external_org_id` | text | Tổ chức ngoài (null nếu là user) |
| `role` | text | R, A, C hoặc I |
| `created_at` | timestamp | Thời điểm tạo |

---

## 5. Phân công tự động

### 5.1. Tổng quan

Hệ thống có thể tự động phân công vai trò R (Responsible) dựa trên:
- Kinh nghiệm với kỹ năng yêu cầu
- Khối lượng công việc hiện tại
- Mức độ phù hợp

### 5.2. Cách sử dụng

1. Vào trang chi tiết dự án
2. Nhấn nút "Phân công tự động"
3. Modal hiện ra với thông tin:
   ```
   ┌────────────────────────────────────────────────┐
   │  Phân công tự động RACI                        │
   ├────────────────────────────────────────────────┤
   │  ℹ Thuật toán sử dụng:                         │
   │  • Experience Matrix: Đánh giá kinh nghiệm     │
   │  • Hungarian: Tối ưu phân công                 │
   │                                                │
   │  ⚙ Cài đặt:                                   │
   │  Số task tối đa/người: [2 ▼]                   │
   │  ☐ Chế độ lập kế hoạch (bỏ qua giới hạn)     │
   │                                                │
   │  📋 Chọn công việc:                           │
   │  [Chọn tất cả] [Bỏ chọn tất cả]              │
   │  ☑ Task A - Đang làm - 5 ngày                │
   │  ☑ Task B - Chờ làm - 3 ngày                 │
   │  ☐ Task C - Hoàn thành - 2 ngày (bỏ qua)     │
   │                                                │
   │  [Xem trước]        [Phân công]               │
   └────────────────────────────────────────────────┘
   ```
4. Chọn các task cần phân công
5. Nhấn "Xem trước" để xem đề xuất
6. Nhấn "Phân công" để áp dụng

### 5.3. Kết quả phân công

```
┌────────────────────────────────────────────────┐
│  Kết quả: Đã phân công 8/10 công việc          │
├────────────────────────────────────────────────┤
│  ✓ Phân công thành công:                       │
│    Task A → Nguyễn Văn A (85% phù hợp)        │
│    Task B → Trần Thị B (72% phù hợp)          │
│    ...                                         │
│                                                │
│  ✗ Không phân công được:                       │
│    Task X - Không có người phù hợp            │
│    Task Y - Tất cả đều đã bận                 │
└────────────────────────────────────────────────┘
```

### 5.4. Các chế độ

| Chế độ | Mô tả |
|--------|-------|
| **Xem trước** | Chỉ xem đề xuất, không lưu |
| **Phân công** | Lưu vào database |
| **Lập kế hoạch** | Bỏ qua giới hạn capacity, dùng để dự báo |

---

## 6. Thuật toán chi tiết

### 6.1. Quy trình tổng quan

```
[Chọn task cần phân công]
         ↓
[Thu thập kỹ năng yêu cầu của mỗi task]
         ↓
[Lấy danh sách thành viên trong dự án]
         ↓
[Tính workload hiện tại của mỗi người]
         ↓
[Xây dựng Experience Matrix]
         ↓
[Chạy Hungarian Algorithm]
         ↓
[Lưu kết quả vào database]
```

### 6.2. Experience Matrix (Ma trận kinh nghiệm)

**File:** `src/algorithm/experience-matrix.ts`

#### Mục đích
Tính điểm kinh nghiệm của mỗi người với mỗi kỹ năng dựa trên lịch sử.

#### Nguồn dữ liệu
1. **user_skill_matrix view:** Thống kê sẵn số task đã hoàn thành theo skill
2. **task_raci + task_skills:** Lịch sử task đã làm

#### Công thức tính điểm

```
Số task đã hoàn thành → Điểm kinh nghiệm

  0 task     → 0.0 (Chưa có kinh nghiệm)
  1-2 task   → 0.3 (Mới bắt đầu)
  3-4 task   → 0.5 (Trung bình)
  5-6 task   → 0.7 (Thành thạo)
  7-9 task   → 0.8 (Giàu kinh nghiệm)
  10+ task   → 0.9 (Chuyên gia)
```

#### Ví dụ

```
User A: Đã hoàn thành 8 task với skill "Database"
  → Điểm kinh nghiệm Database = 0.8

User B: Đã hoàn thành 2 task với skill "Database"
  → Điểm kinh nghiệm Database = 0.3

Khi có task mới yêu cầu "Database":
  → User A được ưu tiên (0.8 > 0.3)
```

### 6.3. Hungarian Algorithm (Thuật toán Hungary)

**File:** `src/algorithm/hungarian-assignment.ts`

#### Mục đích
Phân công tối ưu toàn cục (global optimum), không phải tham lam (greedy).

#### Khái niệm "Slot"

```
Mỗi người có "slot" = số task còn có thể nhận

Ví dụ:
- User A: max = 3, đang làm = 1 → Còn 2 slot
- User B: max = 2, đang làm = 2 → Còn 0 slot (không nhận được)
```

#### Ma trận chi phí (Cost Matrix)

Xây dựng ma trận n×n với:
- Hàng = Task cần phân công
- Cột = Slot của các user
- Giá trị = Chi phí phân công (thấp = tốt)

#### Công thức tính điểm tổng

```
Điểm = (Kinh nghiệm × 0.50) + (Workload × 0.35) +
       (Coverage × 0.10) + (Chuyên môn × 0.05)

Trong đó:

1. Kinh nghiệm (50%):
   - Trung bình điểm kinh nghiệm của các skill yêu cầu
   - Bonus: +0.2 nếu TB > 0.7, +0.1 nếu TB > 0.5

2. Workload (35%):
   - 1.0 nếu đang rảnh (0% capacity)
   - 0.8 nếu 1-33% capacity
   - 0.5 nếu 34-66% capacity
   - 0.2 nếu 67%+ capacity

3. Coverage (10%):
   - Tỷ lệ skill có / skill yêu cầu
   - VD: Cần 3 skill, có 2 → 0.67

4. Chuyên môn (5%):
   - 1.0 nếu có skill nào đó > 0.8
   - 0.5 nếu không
```

#### Ví dụ minh họa

```
Input:
- Task 1: Cần [Database, API]
- Task 2: Cần [Frontend]
- User A: DB=0.8, API=0.6, Frontend=0.2, đang làm 1/2
- User B: DB=0.3, API=0.3, Frontend=0.9, đang làm 0/2

Bước 1: Tính điểm

  User A với Task 1:
    Kinh nghiệm = (0.8 + 0.6) / 2 = 0.7 (+bonus 0.1) = 0.8
    Workload = 0.8 (đang 50% capacity)
    Coverage = 2/2 = 1.0
    Chuyên môn = 1.0 (có skill DB > 0.8)
    → Tổng = 0.8×0.5 + 0.8×0.35 + 1.0×0.1 + 1.0×0.05 = 0.83

  User B với Task 2:
    Kinh nghiệm = 0.9
    Workload = 1.0 (đang rảnh)
    Coverage = 1/1 = 1.0
    Chuyên môn = 1.0 (có skill Frontend > 0.8)
    → Tổng = 0.9×0.5 + 1.0×0.35 + 1.0×0.1 + 1.0×0.05 = 0.95

Bước 2: Hungarian Algorithm
  → Task 1 → User A (0.83)
  → Task 2 → User B (0.95)
```

### 6.4. Các chế độ thuật toán

| Chế độ | Mô tả |
|--------|-------|
| **Weighted** | Cân bằng tất cả yếu tố (mặc định) |
| **Lexicographic** | Ưu tiên: Capacity → Kinh nghiệm → Workload |
| **Planning** | Bỏ qua capacity, dùng greedy |

---

## 7. Giao diện ma trận RACI

### 7.1. Trang RACI Dashboard

**Đường dẫn:** `/dashboard/raci`

#### Bố cục

```
┌─────────────────────────────────────────────────────────────┐
│  [Chọn dự án ▼]  [Tìm kiếm task]  [Lọc vai trò ▼]  [Xóa lọc]│
├─────────────────────────────────────────────────────────────┤
│  Thành viên:                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│  │Nguyễn A  │ │Trần B    │ │Lê C      │                    │
│  │Developer │ │Designer  │ │PM        │                    │
│  │R:3 A:1   │ │R:2 A:0   │ │R:0 A:5   │                    │
│  │C:2 I:1   │ │C:4 I:3   │ │C:1 I:2   │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
├─────────────────────────────────────────────────────────────┤
│  Ma trận RACI:                                              │
│  ┌──────────────┬─────────┬─────────┬─────────┐            │
│  │ Task         │Nguyễn A │ Trần B  │ Lê C    │            │
│  ├──────────────┼─────────┼─────────┼─────────┤            │
│  │ Thiết kế UI  │    -    │   R     │   A     │            │
│  │ Phase 1,Done │         │ (xanh)  │ (lá)    │            │
│  ├──────────────┼─────────┼─────────┼─────────┤            │
│  │ Viết API     │   R     │   C     │   I     │            │
│  │ Phase 2,Prog │ (xanh)  │ (vàng)  │ (xám)   │            │
│  └──────────────┴─────────┴─────────┴─────────┘            │
│                                                             │
│  [Xuất Excel] [Xuất CSV] [Xuất PDF]                        │
└─────────────────────────────────────────────────────────────┘
```

### 7.2. Bộ lọc

| Bộ lọc | Mô tả |
|--------|-------|
| Dự án | Chọn dự án để xem |
| Tìm kiếm | Tìm theo tên task |
| Vai trò | Chỉ hiện task có vai trò R/A/C/I cụ thể |
| Phase | Lọc theo giai đoạn (nếu có) |

### 7.3. Card thành viên

Mỗi card hiển thị:
- Tên đầy đủ
- Vị trí + Phòng ban
- Thống kê: R:x A:x C:x I:x

### 7.4. Bảng ma trận

| Phần | Mô tả |
|------|-------|
| Cột đầu | Tên task + Phase + Trạng thái |
| Các cột sau | Mỗi thành viên 1 cột |
| Ô | Badge R/A/C/I hoặc "-" nếu không gán |
| Tooltip | Hover để xem chi tiết |

### 7.5. Xuất dữ liệu

**File:** `src/components/raci/raci-export.tsx`

Hỗ trợ xuất:
- **Excel (.xlsx):** Bảng tính để phân tích
- **CSV (.csv):** Dữ liệu thuần để import
- **PDF (.pdf):** Tài liệu để in

---

## 8. Tổ chức bên ngoài

### 8.1. Định nghĩa

Tổ chức bên ngoài (External Organization) là:
- Nhà thầu
- Đối tác
- Vendor
- Đơn vị tư vấn bên ngoài

### 8.2. Cấu trúc dữ liệu

**Bảng `external_orgs`:**

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | text | Mã định danh |
| `name` | text | Tên tổ chức |
| `contact_info` | text | Thông tin liên hệ |

### 8.3. Cách gán RACI cho tổ chức ngoài

1. Mở dialog "Thêm RACI"
2. Chọn task và vai trò
3. Trong phần "Gán cho":
   - Chọn "Tổ chức ngoài"
   - Chọn tổ chức từ dropdown
4. Nhấn "Thêm RACI"

### 8.4. Hiển thị trong ma trận

Tổ chức ngoài được hiển thị:
- Icon tòa nhà (thay vì avatar người)
- Tên tổ chức
- Cùng cột với thành viên nội bộ

---

## 9. API liên quan

### 9.1. Quản lý RACI

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/projects/[id]/raci` | Lấy ma trận RACI |
| POST | `/api/projects/[id]/raci` | Thêm phân công |
| DELETE | `/api/projects/[id]/raci/clear` | Xóa tất cả RACI |

### 9.2. Phân công tự động

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/projects/[id]/auto-assign-raci` | Xem trước |
| POST | `/api/projects/[id]/auto-assign-raci` | Thực hiện phân công |

### 9.3. Tổ chức ngoài

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/external-orgs` | Lấy danh sách |

### 9.4. Ví dụ Request/Response

#### Thêm phân công RACI

```http
POST /api/projects/project-123/raci
Content-Type: application/json

{
  "task_id": "task-456",
  "user_id": "user-789",
  "role": "R"
}

Response (200):
{
  "success": true,
  "message": "Đã thêm phân công RACI"
}
```

#### Phân công tự động

```http
POST /api/projects/project-123/auto-assign-raci
Content-Type: application/json

{
  "task_ids": [1, 2, 3],
  "max_concurrent_tasks": 2,
  "planning": false
}

Response (200):
{
  "success": true,
  "message": "Đã phân công 3/3 công việc",
  "assignments": [
    {
      "task_id": 1,
      "task_name": "Thiết kế database",
      "user_id": "user-abc",
      "user_name": "Nguyễn Văn A",
      "confidence_score": 0.85,
      "experience_score": 0.8
    }
  ],
  "unassigned": []
}
```

#### Lấy danh sách tổ chức ngoài

```http
GET /api/external-orgs

Response (200):
{
  "organizations": [
    {
      "id": "ext-1",
      "name": "Công ty ABC",
      "contact_info": "contact@abc.com"
    }
  ]
}
```

---

## Workflow thường gặp

### Workflow 1: Dự án mới - Thiết lập RACI

```
1. Tạo dự án
2. Thêm các công việc
3. Gán kỹ năng cho công việc
4. Mở "Phân công tự động"
5. Chọn tất cả task
6. Nhấn "Xem trước"
7. Kiểm tra đề xuất
8. Nhấn "Phân công"
9. Điều chỉnh thủ công nếu cần
```

### Workflow 2: Điều chỉnh RACI

```
1. Vào Dashboard → RACI Matrix
2. Chọn dự án
3. Xem ma trận hiện tại
4. Phát hiện thiếu sót (task chưa có R)
5. Vào Project → Tab RACI
6. Nhấn "Thêm RACI"
7. Gán vai trò còn thiếu
```

### Workflow 3: Bảo trì liên tục

```
1. Task hoàn thành → Workload tự động cập nhật
2. Có task mới → Dùng auto-assign
3. Thành viên bận → Điều chỉnh manual
4. Xuất báo cáo định kỳ
```

---

## Tóm tắt

1. **4 vai trò:** R (Thực hiện), A (Chịu trách nhiệm), C (Tư vấn), I (Được thông báo)
2. **Quy tắc:** Mỗi task cần đúng 1 R, tối đa 1 A
3. **Phân công tự động:** Dựa trên kinh nghiệm + workload + skill matching
4. **Thuật toán Hungary:** Tối ưu toàn cục, không tham lam
5. **Tổ chức ngoài:** Có thể gán RACI cho nhà thầu, đối tác
6. **Ma trận:** Xem tổng quan ai làm gì trong toàn dự án
