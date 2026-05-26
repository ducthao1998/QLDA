# QLDA - Hệ Thống Quản Lý Dự Án

## Giới Thiệu

QLDA (Quản Lý Dự Án) là một hệ thống quản lý dự án doanh nghiệp với khả năng tối ưu hóa nguồn lực. Hệ thống được thiết kế để hỗ trợ lập kế hoạch dự án, quản lý công việc, phân bổ nguồn lực và tối ưu hóa lịch trình.

---

## Tech Stack

### Frontend
| Công nghệ | Phiên bản | Mô tả |
|-----------|-----------|-------|
| Next.js | 15.3.1 | Framework React với App Router |
| React | 19.0.0 | Thư viện UI |
| Radix UI | - | Component library (dialog, alert, dropdown...) |
| Tailwind CSS | 4 | Styling |
| Chart.js, Recharts | - | Biểu đồ |
| DHTMLX Gantt | 9.0.14 | Gantt chart |
| React Hook Form + Zod | - | Form validation |

### Backend
| Công nghệ | Mô tả |
|-----------|-------|
| Next.js API Routes | Backend API |
| Supabase | Authentication + Database |
| PostgreSQL | Database (qua Supabase) |

---

## Cấu Trúc Thư Mục

```
QLDA/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API Routes (58 endpoints)
│   │   ├── dashboard/          # Các trang dashboard
│   │   ├── login/              # Trang đăng nhập
│   │   ├── auth/               # Auth flows
│   │   └── types/              # TypeScript types
│   ├── components/             # React Components (205+ files)
│   │   ├── ui/                 # Radix UI components
│   │   ├── project/            # Components liên quan project
│   │   ├── task/               # Components liên quan task
│   │   ├── team/               # Components quản lý team
│   │   ├── dashboard/          # Components dashboard
│   │   ├── raci/               # Components ma trận RACI
│   │   ├── gantt/              # Components Gantt chart
│   │   └── layout/             # Components layout
│   ├── algorithm/              # Thuật toán tối ưu hóa
│   │   ├── critical-path.ts    # Thuật toán CPM
│   │   ├── hungarian-assignment.ts  # Phân công nguồn lực
│   │   ├── experience-matrix.ts     # Tính điểm kinh nghiệm
│   │   ├── schedule-optimizer.ts    # Tối ưu lịch trình
│   │   └── project-schedule.ts      # Lập lịch dự án
│   ├── services/               # Business logic
│   ├── hooks/                  # React hooks
│   ├── lib/                    # Utilities
│   │   ├── supabase/           # Supabase clients
│   │   ├── permissions.ts      # Logic phân quyền
│   │   └── utils.ts            # Utilities
│   └── middleware.ts           # Next.js middleware
├── supabase/                   # Supabase config
├── database_migration.sql      # Database schema
└── package.json
```

---

## Danh Sách Tính Năng

### 1. Quản Lý Dự Án (Project Management)
- Tạo/sửa/xóa dự án
- Phân loại dự án (A/B/C)
- Theo dõi trạng thái dự án
- Tự động tải task template theo loại dự án
- **File chính:** `src/app/dashboard/projects/`, `src/components/project/`

### 2. Quản Lý Công Việc (Task Management)
- CRUD công việc với duration
- Workflow trạng thái: `todo → in_progress → review → done`
- Hệ thống task template
- Gán skill yêu cầu cho task
- **File chính:** `src/app/dashboard/tasks/`, `src/components/task/`

### 3. Quản Lý Dependencies
- Tạo chuỗi phụ thuộc giữa các task
- Ngăn chặn circular dependencies
- Hiển thị dependency tree
- Phân tích critical path
- **File chính:** `src/algorithm/critical-path.ts`, `src/app/api/tasks/[id]/dependencies/`

### 4. Ma Trận RACI
- Gán vai trò R (Responsible), A (Accountable), C (Consulted), I (Informed)
- Auto-assign RACI dựa trên skills
- Hỗ trợ external organizations
- **File chính:** `src/app/dashboard/raci/`, `src/components/raci/`

### 5. Quản Lý Kỹ Năng (Skills)
- Tạo/xóa skills với phân loại theo lĩnh vực
- Gán skill cho user với mức độ thành thạo (1-5)
- Gán skill yêu cầu cho task
- Theo dõi skill utilization
- **File chính:** `src/app/api/skills/`, `src/components/team/`

### 6. Quản Lý Team
- Hồ sơ user (vị trí, phòng ban, liên hệ)
- Giới hạn số task đồng thời tối đa
- Thống kê user (completion rate, on-time rate)
- Ma trận kỹ năng
- **File chính:** `src/app/dashboard/team/`, `src/components/team/`

### 7. Tối Ưu Hóa Lịch Trình (Schedule Optimization)
- **Critical Path Method (CPM):** Phân tích đường găng, slack time
- **Hungarian Algorithm:** Phân công tối ưu nguồn lực
- **Experience Matrix:** Tính điểm phù hợp user-task
- Multi-objective optimization (thời gian, nguồn lực, chi phí)
- **File chính:** `src/algorithm/`, `src/app/dashboard/schedule/`

### 8. Gantt Chart
- Biểu đồ Gantt tương tác (DHTMLX Gantt)
- Hiển thị dependencies
- Nhiều chế độ xem (ngày, tuần, tháng)
- Export PDF/Excel
- Quản lý schedule runs (draft → approved → active)
- **File chính:** `src/app/dashboard/gantt/`, `src/components/gantt/`

### 9. Dashboard & Analytics
- Overview metrics và KPIs
- Thống kê task theo trạng thái, template, phân loại
- Thống kê user performance
- Phân tích xu hướng theo thời gian
- Phát hiện bottleneck
- Dự báo resource capacity
- **File chính:** `src/app/dashboard/page.tsx`, `src/components/dashboard/`

### 10. Xác Thực & Phân Quyền
- Supabase Auth (email/password)
- Reset password
- Role-based access control
- Row Level Security (RLS)
- **File chính:** `src/app/login/`, `src/middleware.ts`, `src/lib/permissions.ts`

### 11. Profile Management
- Cập nhật thông tin cá nhân
- Thống kê cá nhân
- Quản lý skills cá nhân
- Đổi mật khẩu
- **File chính:** `src/app/dashboard/profile/`, `src/app/api/profile/`

### 12. Cài Đặt Thuật Toán
- Cấu hình preference mode (weighted/priority)
- Thiết lập max concurrent tasks
- Ngưỡng confidence cho vai trò R
- CPM preferences (criticality threshold, default duration...)
- **File chính:** `src/app/dashboard/settings/`, `src/app/api/settings/`

---

## Database Schema (Các Bảng Chính)

| Bảng | Mô tả |
|------|-------|
| `users` | Thông tin người dùng |
| `projects` | Dự án |
| `tasks` | Công việc |
| `task_dependencies` | Phụ thuộc giữa các task |
| `task_raci` | Ma trận RACI |
| `skills` | Kỹ năng |
| `user_skills` | Kỹ năng của user |
| `task_skills` | Kỹ năng yêu cầu cho task |
| `task_templates` | Template công việc |
| `schedule_runs` | Lịch trình tối ưu |
| `schedule_details` | Chi tiết phân công trong schedule |
| `algorithm_settings` | Cài đặt thuật toán |
| `external_orgs` | Tổ chức bên ngoài |

---

## Hướng Dẫn Chi Tiết

Các file hướng dẫn chi tiết cho từng tính năng:

| File | Tính năng |
|------|-----------|
| `01-quan-ly-du-an.md` | Quản lý dự án |
| `02-quan-ly-cong-viec.md` | Quản lý công việc |
| `03-dependencies.md` | Quản lý dependencies |
| `04-raci-matrix.md` | Ma trận RACI |
| `05-quan-ly-ky-nang.md` | Quản lý kỹ năng |
| `06-quan-ly-team.md` | Quản lý team |
| `07-toi-uu-lich-trinh.md` | Tối ưu hóa lịch trình |
| `08-gantt-chart.md` | Gantt chart |
| `09-dashboard-analytics.md` | Dashboard & Analytics |
| `10-xac-thuc-phan-quyen.md` | Xác thực & Phân quyền |
| `11-profile.md` | Profile management |
| `12-cai-dat-thuat-toan.md` | Cài đặt thuật toán |

---

## API Endpoints Tổng Quan

Hệ thống có **58 API endpoints**, được chia theo nhóm:

| Nhóm | Số lượng | Đường dẫn |
|------|----------|-----------|
| Authentication | 1 | `/api/auth/` |
| Dashboard | 5 | `/api/dashboard/` |
| Projects | 9 | `/api/projects/` |
| Tasks | 14 | `/api/tasks/` |
| Task Templates | 4 | `/api/task-templates/` |
| Skills | 4 | `/api/skills/` |
| Schedules | 2 | `/api/schedules/` |
| Profile | 5 | `/api/profile/` |
| Settings | 2 | `/api/settings/` |
| External Orgs | 1 | `/api/external-orgs/` |

---

## Thuật Toán Chính

### 1. Critical Path Method (CPM)
- **File:** `src/algorithm/critical-path.ts`
- Tính toán đường găng của dự án
- Xác định slack time cho mỗi task
- Phân tích free float và total float

### 2. Hungarian Assignment Algorithm
- **File:** `src/algorithm/hungarian-assignment.ts`
- Phân công tối ưu nguồn lực cho task
- Giảm thiểu chi phí/thời gian tổng thể

### 3. Experience Matrix
- **File:** `src/algorithm/experience-matrix.ts`
- Tính điểm kinh nghiệm user-task
- Dựa trên skill matching và proficiency level

### 4. Schedule Optimizer
- **File:** `src/algorithm/schedule-optimizer.ts`
- Tối ưu đa mục tiêu (thời gian, nguồn lực, chi phí)
- Cân bằng workload giữa các user

---

## Ghi Chú Cho Developer Mới

1. **Bắt đầu từ đâu:** Đọc file này trước, sau đó đọc chi tiết từng tính năng bạn cần làm việc.

2. **Quy ước đặt tên:**
   - Components: PascalCase (VD: `ProjectCard.tsx`)
   - API routes: kebab-case (VD: `task-templates`)
   - Files: kebab-case hoặc camelCase tùy loại

3. **State Management:** Sử dụng React hooks, không có global state manager.

4. **Database:** Tất cả queries đi qua Supabase client (`src/lib/supabase/`).

5. **Authentication:** Middleware kiểm tra auth ở `src/middleware.ts`.

6. **Styling:** Tailwind CSS, có thể dùng class utilities từ `src/lib/utils.ts`.
