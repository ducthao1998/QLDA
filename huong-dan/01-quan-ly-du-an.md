# Hướng Dẫn: Quản Lý Dự Án

## Mục Lục
1. [Tổng quan](#1-tổng-quan)
2. [Cấu trúc dữ liệu dự án](#2-cấu-trúc-dữ-liệu-dự-án)
3. [Các file liên quan](#3-các-file-liên-quan)
4. [Luồng tạo dự án mới](#4-luồng-tạo-dự-án-mới)
5. [Trang danh sách dự án](#5-trang-danh-sách-dự-án)
6. [Trang chi tiết dự án](#6-trang-chi-tiết-dự-án)
7. [Hệ thống phân quyền](#7-hệ-thống-phân-quyền)
8. [Task Template tự động](#8-task-template-tự-động)
9. [API liên quan](#9-api-liên-quan)

---

## 1. Tổng quan

Tính năng Quản lý Dự án cho phép:
- Tạo, sửa, xóa dự án
- Phân loại dự án theo nhóm A, B, C
- Tự động tạo công việc từ template dựa trên phân loại
- Theo dõi trạng thái dự án
- Phân quyền xem/sửa theo vị trí người dùng

---

## 2. Cấu trúc dữ liệu dự án

### 2.1. Bảng `projects` trong database

| Cột | Kiểu dữ liệu | Mô tả |
|-----|--------------|-------|
| `id` | UUID | Mã định danh duy nhất |
| `name` | text | Tên dự án |
| `description` | text | Mô tả/mục tiêu dự án |
| `status` | text | Trạng thái hiện tại |
| `start_date` | date | Ngày bắt đầu |
| `classification` | text | Phân loại: A, B hoặc C |
| `project_field` | text | Địa điểm/lĩnh vực |
| `total_investment` | text | Tổng vốn đầu tư |
| `created_by` | UUID | ID người tạo |
| `created_at` | timestamp | Thời điểm tạo |

### 2.2. Các trạng thái dự án

```
planning      → Lập kế hoạch (mặc định khi tạo mới)
in_progress   → Đang thực hiện
on_hold       → Tạm dừng
completed     → Hoàn thành
cancelled     → Đã hủy
```

### 2.3. Interface TypeScript

**File:** `src/app/types/table-types.ts`

```typescript
export interface Project {
  id: string
  name: string
  description: string
  status: string
  start_date: string
  classification: ProjectClassification | null  // "A" | "B" | "C"
  project_field: string | null
  total_investment?: string | null
  created_by?: string

  // Thông tin người tạo (join từ bảng users)
  users?: {
    full_name: string
    position: string
    org_unit: string
  }
}
```

---

## 3. Các file liên quan

### 3.1. Trang (Pages)

```
src/app/dashboard/projects/
├── page.tsx                    ← Trang danh sách dự án
├── new/
│   └── page.tsx                ← Trang tạo dự án mới
└── [id]/
    ├── page.tsx                ← Trang chi tiết dự án
    └── edit/
        └── page.tsx            ← Trang sửa dự án
```

### 3.2. Components

```
src/components/project/
├── project-form.tsx            ← Form tạo/sửa dự án
├── projects-list.tsx           ← Hiển thị danh sách dạng card
├── project-details.tsx         ← Giao diện chi tiết (cho quản lý)
├── project-board.tsx           ← Giao diện Kanban (cho cán bộ)
├── project-tasks.tsx           ← Quản lý công việc trong dự án
├── create-task-modal.tsx       ← Modal tạo công việc nhanh
└── auto-assign-raci-modal.tsx  ← Modal phân công tự động
```

### 3.3. API Routes

```
src/app/api/projects/
├── route.ts                    ← GET (danh sách), POST (tạo mới)
└── [id]/
    ├── route.ts                ← GET, PUT, DELETE cho 1 dự án
    ├── tasks/
    │   └── route.ts            ← Quản lý công việc trong dự án
    └── load-tasks-from-template/
        └── route.ts            ← Tải công việc từ template
```

---

## 4. Luồng tạo dự án mới

### 4.1. Sơ đồ tổng quát

```
[Người dùng nhấn "Dự Án Mới"]
         ↓
[Hiển thị form tạo dự án]
         ↓
[Điền thông tin + Chọn phân loại A/B/C]
         ↓
[Nhấn "Tạo dự án"]
         ↓
[Gọi API POST /api/projects]
         ↓
[Server kiểm tra quyền + validate dữ liệu]
         ↓
[Lưu dự án vào database]
         ↓
[Tự động tạo công việc từ template phù hợp]
         ↓
[Chuyển về trang danh sách]
```

### 4.2. Chi tiết từng bước

#### Bước 1: Trang tạo dự án

**File:** `src/app/dashboard/projects/new/page.tsx`

```typescript
export default async function NewProjectPage() {
  // Lấy thông tin người dùng hiện tại
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Kiểm tra quyền - chỉ một số vị trí được tạo dự án
  const userPermissions = getUserPermissions(currentUser?.position || "")

  // Nếu không có quyền, chuyển về trang danh sách
  if (!userPermissions.canEditProject) {
    redirect("/dashboard/projects")
  }

  // Render form tạo dự án
  return <ProjectForm />
}
```

#### Bước 2: Form tạo dự án

**File:** `src/components/project/project-form.tsx`

Form có các trường sau:

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| Tên dự án | Có | Tên ngắn gọn của dự án |
| Mục tiêu | Không | Mô tả chi tiết mục tiêu |
| Ngày bắt đầu | Không | Chọn từ date picker |
| Phân loại | Có | Chọn A, B hoặc C |
| Địa điểm | Không | Nơi thực hiện |
| Tổng vốn | Không | Số tiền đầu tư |

**Validation với Zod:**

```typescript
const formSchema = z.object({
  name: z.string().min(1, 'Tên dự án là bắt buộc'),
  project_goal: z.string().optional(),
  start_date: z.date().optional(),
  classification: z.string({
    required_error: 'Vui lòng chọn phân loại dự án.'
  }),
  implementation_location: z.string().optional(),
  total_investment: z.string().optional(),
})
```

#### Bước 3: Gửi dữ liệu lên server

Khi nhấn "Tạo dự án", form gọi API:

```typescript
const response = await fetch('/api/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: "Dự án ABC",
    description: "Mục tiêu của dự án...",
    start_date: "2024-01-15",
    status: "planning",
    classification: "A",
    project_field: "Hà Nội",
    total_investment: "10 tỷ VND"
  })
})
```

#### Bước 4: Xử lý phía server

**File:** `src/app/api/projects/route.ts`

```typescript
export async function POST(request: Request) {
  // 1. Lấy dữ liệu từ request
  const body = await request.json()

  // 2. Kiểm tra người dùng đã đăng nhập
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Chưa đăng nhập' },
      { status: 401 }
    )
  }

  // 3. Kiểm tra quyền theo vị trí
  const allowedPositions = [
    'quản lý', 'trưởng phòng', 'chỉ huy',
    'team lead', 'project manager'
  ]
  if (!allowedPositions.includes(userPosition.toLowerCase())) {
    return NextResponse.json(
      { error: 'Không có quyền tạo dự án' },
      { status: 403 }
    )
  }

  // 4. Validate dữ liệu
  if (!name || !project_field || !classification) {
    return NextResponse.json(
      { error: 'Thiếu thông tin bắt buộc' },
      { status: 400 }
    )
  }

  // 5. Tạo dự án trong database
  const { data: newProject, error } = await supabase
    .from('projects')
    .insert({
      name,
      description,
      start_date,
      status: 'planning',
      classification,
      project_field,
      total_investment,
      created_by: user.id
    })
    .select()
    .single()

  // 6. Tự động tạo công việc từ template
  await supabase.rpc('create_tasks_from_templates', {
    p_project_id: newProject.id,
    p_project_field: project_field,
    p_project_classification: classification,
  })

  // 7. Trả về kết quả
  return NextResponse.json(newProject, { status: 201 })
}
```

---

## 5. Trang danh sách dự án

**File:** `src/app/dashboard/projects/page.tsx`

### 5.1. Dữ liệu hiển thị

Trang này hiển thị:
- Thống kê tổng quan (tổng dự án, đang thực hiện, hoàn thành, lập kế hoạch)
- Danh sách dự án dạng card grid
- Nút "Dự Án Mới" (chỉ hiện khi có quyền)

### 5.2. Lấy danh sách dự án

```typescript
// Lấy dự án theo đơn vị của người dùng
const { data: projects } = await supabase
  .from('projects')
  .select(`
    *,
    users!created_by (
      full_name,
      position,
      org_unit
    )
  `)
  .eq('users.org_unit', currentUser.org_unit)  // Lọc theo đơn vị
  .order('created_at', { ascending: false })
```

### 5.3. Component hiển thị danh sách

**File:** `src/components/project/projects-list.tsx`

```typescript
export function ProjectsList({ projects }: { projects: Project[] }) {
  // Tính thống kê
  const stats = {
    total: projects.length,
    inProgress: projects.filter(p => p.status === 'in_progress').length,
    completed: projects.filter(p => p.status === 'completed').length,
    planning: projects.filter(p => p.status === 'planning').length,
  }

  return (
    <div>
      {/* Thống kê */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard title="Tổng dự án" value={stats.total} />
        <StatCard title="Đang thực hiện" value={stats.inProgress} />
        {/* ... */}
      </div>

      {/* Danh sách card */}
      <div className="grid grid-cols-3 gap-4">
        {projects.map(project => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  )
}
```

### 5.4. Card dự án

Mỗi card hiển thị:
- Tên dự án
- Mô tả (cắt ngắn nếu dài)
- Badge trạng thái (màu sắc theo trạng thái)
- Ngày bắt đầu
- Tên người tạo
- Menu dropdown (Xem, Sửa, Xóa)

```typescript
// Map trạng thái sang màu badge
const statusMap = {
  planning: { label: "Lập kế hoạch", variant: "secondary" },
  in_progress: { label: "Đang thực hiện", variant: "default" },
  on_hold: { label: "Tạm dừng", variant: "outline" },
  completed: { label: "Hoàn thành", variant: "default" },
  cancelled: { label: "Đã hủy", variant: "destructive" },
}
```

---

## 6. Trang chi tiết dự án

**File:** `src/app/dashboard/projects/[id]/page.tsx`

### 6.1. Điều hướng theo quyền

Tùy vào vị trí của người dùng, hệ thống sẽ hiển thị giao diện khác nhau:

```typescript
export default async function ProjectPage({ params }) {
  // Lấy thông tin dự án
  const project = await getProject(params.id)

  // Lấy quyền của người dùng
  const permissions = getUserPermissions(currentUser.position)

  // Hiển thị giao diện phù hợp
  if (permissions.viewMode === "admin") {
    // Quản lý → Giao diện chi tiết đầy đủ
    return <ProjectDetails project={project} />
  } else {
    // Cán bộ/Chỉ huy → Giao diện Kanban board
    return <ProjectBoard project={project} />
  }
}
```

### 6.2. Giao diện Admin (ProjectDetails)

**File:** `src/components/project/project-details.tsx`

Giao diện này có các phần:

1. **Header:** Tên dự án, mô tả, nút sửa/xóa
2. **Thống kê nhanh:** 4 card (trạng thái, ngày bắt đầu, người tạo, phân loại)
3. **Tabs:**
   - **Tổng quan:** Thông tin chi tiết dự án
   - **Công việc:** Danh sách và quản lý công việc
   - **Nhóm:** Thành viên tham gia

### 6.3. Giao diện Board (ProjectBoard)

**File:** `src/components/project/project-board.tsx`

Giao diện Kanban với các cột:
- **Cần làm** (todo)
- **Đang làm** (in_progress)
- **Chờ duyệt** (review)
- **Hoàn thành** (done)

Tính năng:
- Kéo thả công việc giữa các cột
- Lọc theo người được giao
- Tìm kiếm công việc
- Phân công tự động

---

## 7. Hệ thống phân quyền

**File:** `src/lib/permissions.ts`

### 7.1. Các quyền trong hệ thống

```typescript
export interface UserPermissions {
  canViewGantt: boolean       // Xem biểu đồ Gantt
  canViewTasks: boolean       // Xem danh sách công việc
  canViewTeam: boolean        // Xem thông tin nhóm
  canEditProject: boolean     // Sửa thông tin dự án
  canDeleteProject: boolean   // Xóa dự án
  canManagePhases: boolean    // Quản lý giai đoạn
  canAssignTasks: boolean     // Giao việc cho người khác
  viewMode: "admin" | "board" // Chế độ hiển thị
}
```

### 7.2. Phân quyền theo vị trí

```typescript
export function getUserPermissions(position: string): UserPermissions {
  const pos = position.toLowerCase()

  // Quản lý: Có tất cả quyền
  if (pos === "quản lý") {
    return {
      canViewGantt: true,
      canViewTasks: true,
      canViewTeam: true,
      canEditProject: true,
      canDeleteProject: true,
      canManagePhases: true,
      canAssignTasks: true,
      viewMode: "admin"
    }
  }

  // Trưởng phòng, Team Lead, Project Manager: Có quyền sửa
  if (["trưởng phòng", "team lead", "project manager"].includes(pos)) {
    return {
      canViewGantt: true,
      canViewTasks: true,
      canViewTeam: true,
      canEditProject: true,
      canDeleteProject: false,
      canManagePhases: true,
      canAssignTasks: true,
      viewMode: "admin"
    }
  }

  // Chỉ huy, Cán bộ: Chỉ xem và giao việc
  if (["chỉ huy", "cán bộ"].includes(pos)) {
    return {
      canViewGantt: true,
      canViewTasks: true,
      canViewTeam: true,
      canEditProject: false,
      canDeleteProject: false,
      canManagePhases: false,
      canAssignTasks: true,
      viewMode: "board"
    }
  }

  // Mặc định: Quyền cơ bản
  return {
    canViewGantt: false,
    canViewTasks: true,
    canViewTeam: false,
    canEditProject: false,
    canDeleteProject: false,
    canManagePhases: false,
    canAssignTasks: false,
    viewMode: "board"
  }
}
```

### 7.3. Sử dụng trong component

```typescript
// Trong trang/component
const permissions = getUserPermissions(currentUser.position)

// Ẩn/hiện nút theo quyền
{permissions.canEditProject && (
  <Button onClick={handleEdit}>Sửa</Button>
)}

{permissions.canDeleteProject && (
  <Button variant="destructive" onClick={handleDelete}>Xóa</Button>
)}
```

---

## 8. Task Template tự động

### 8.1. Cách hoạt động

Khi tạo dự án với phân loại (A/B/C), hệ thống tự động:
1. Tìm các template phù hợp với phân loại đó
2. Tạo công việc từ các template
3. Thiết lập dependencies giữa các công việc
4. Copy kỹ năng yêu cầu từ template

### 8.2. Bảng task_templates

| Cột | Mô tả |
|-----|-------|
| `id` | Mã template |
| `name` | Tên công việc mẫu |
| `description` | Mô tả chi tiết |
| `applicable_classification` | Mảng phân loại áp dụng: ["A"], ["B", "C"], v.v. |
| `default_duration_days` | Số ngày thực hiện mặc định |
| `sequence_order` | Thứ tự tạo công việc |

### 8.3. Hàm RPC tạo công việc từ template

```sql
-- Trong database có hàm: create_tasks_from_templates
-- Được gọi khi tạo dự án mới

CREATE FUNCTION create_tasks_from_templates(
  p_project_id UUID,
  p_project_field TEXT,
  p_project_classification TEXT
) RETURNS VOID AS $$
BEGIN
  -- 1. Lấy các template phù hợp
  -- 2. Tạo công việc từ mỗi template
  -- 3. Tạo dependencies
  -- 4. Copy skills
END;
$$ LANGUAGE plpgsql;
```

### 8.4. Tải template thủ công

Nếu cần tải thêm template sau khi tạo dự án:

**API:** `POST /api/projects/[id]/tasks`

```typescript
// Gửi danh sách template_id cần tải
const response = await fetch(`/api/projects/${projectId}/tasks`, {
  method: 'POST',
  body: JSON.stringify({
    template_ids: [1, 3, 5]  // ID các template muốn tải
  })
})
```

---

## 9. API liên quan

### 9.1. Danh sách API

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/projects` | Lấy danh sách dự án |
| POST | `/api/projects` | Tạo dự án mới |
| GET | `/api/projects/[id]` | Lấy chi tiết 1 dự án |
| PUT | `/api/projects/[id]` | Cập nhật dự án |
| DELETE | `/api/projects/[id]` | Xóa dự án |
| GET | `/api/projects/[id]/tasks` | Lấy công việc trong dự án |
| POST | `/api/projects/[id]/tasks` | Tạo công việc từ template |
| POST | `/api/projects/[id]/load-tasks-from-template` | Tải template thủ công |
| GET | `/api/projects/[id]/available-templates` | Lấy template chưa dùng |

### 9.2. Ví dụ request/response

#### Lấy danh sách dự án

```http
GET /api/projects?page=1&limit=10

Response:
{
  "data": [
    {
      "id": "abc-123",
      "name": "Dự án A",
      "status": "in_progress",
      "classification": "A",
      "users": {
        "full_name": "Nguyễn Văn A",
        "position": "Quản lý"
      }
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 10
}
```

#### Tạo dự án mới

```http
POST /api/projects
Content-Type: application/json

{
  "name": "Dự án XYZ",
  "description": "Mô tả dự án",
  "start_date": "2024-01-15",
  "classification": "B",
  "project_field": "TP.HCM",
  "total_investment": "5 tỷ VND"
}

Response (201):
{
  "id": "xyz-456",
  "name": "Dự án XYZ",
  "status": "planning",
  ...
}
```

#### Cập nhật dự án

```http
PUT /api/projects/abc-123
Content-Type: application/json

{
  "name": "Dự án A (đã sửa)",
  "status": "in_progress"
}

Response (200):
{
  "id": "abc-123",
  "name": "Dự án A (đã sửa)",
  "status": "in_progress",
  ...
}
```

---

## Tóm tắt

1. **Tạo dự án:** Form → API POST → Lưu DB → Tự động tạo công việc từ template
2. **Phân quyền:** Dựa vào vị trí (position) của người dùng
3. **Giao diện:** Admin (chi tiết) hoặc Board (Kanban) tùy quyền
4. **Template:** Tự động tải theo phân loại A/B/C khi tạo dự án
5. **Trạng thái:** planning → in_progress → completed (hoặc cancelled/on_hold)
