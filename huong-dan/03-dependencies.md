# Hướng Dẫn: Quản Lý Phụ Thuộc (Dependencies)

## Mục Lục
1. [Tổng quan](#1-tổng-quan)
2. [Khái niệm phụ thuộc](#2-khái-niệm-phụ-thuộc)
3. [Các file liên quan](#3-các-file-liên-quan)
4. [Cách thêm/xóa phụ thuộc](#4-cách-thêmxóa-phụ-thuộc)
5. [Phát hiện vòng lặp](#5-phát-hiện-vòng-lặp)
6. [Hiển thị cây phụ thuộc](#6-hiển-thị-cây-phụ-thuộc)
7. [Ảnh hưởng đến lịch trình](#7-ảnh-hưởng-đến-lịch-trình)
8. [Phân tích đường găng (Critical Path)](#8-phân-tích-đường-găng-critical-path)
9. [API liên quan](#9-api-liên-quan)

---

## 1. Tổng quan

Phụ thuộc (dependency) là mối quan hệ giữa các công việc, xác định:
- Công việc nào phải hoàn thành trước
- Công việc nào bị chặn chờ công việc khác
- Thứ tự thực hiện các công việc trong dự án

---

## 2. Khái niệm phụ thuộc

### 2.1. Định nghĩa

```
Task A "phụ thuộc vào" Task B
     ↓
Task B phải hoàn thành TRƯỚC KHI Task A có thể bắt đầu
     ↓
Task B là "tiền nhiệm" (prerequisite)
Task A bị "chặn" (blocked) cho đến khi B xong
```

### 2.2. Ví dụ thực tế

```
"Thi công móng" → "Xây tường" → "Lợp mái"

- "Xây tường" phụ thuộc vào "Thi công móng"
- "Lợp mái" phụ thuộc vào "Xây tường"
- Không thể lợp mái khi chưa xây tường
```

### 2.3. Cấu trúc database

**Bảng `task_dependencies`:**

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | serial | Mã định danh |
| `task_id` | text | Công việc BỊ PHỤ THUỘC (công việc sau) |
| `depends_on_id` | text | Công việc ĐƯỢC PHỤ THUỘC VÀO (công việc trước) |
| `created_at` | timestamp | Thời điểm tạo |

**Ràng buộc:**
```sql
-- Không cho phép tự phụ thuộc vào chính mình
CHECK (task_id != depends_on_id)

-- Không cho phép trùng lặp
UNIQUE(task_id, depends_on_id)
```

### 2.4. Cách đọc dữ liệu

```
task_dependencies:
| task_id | depends_on_id |
|---------|---------------|
| task-2  | task-1        |  → Task 2 chờ Task 1
| task-3  | task-2        |  → Task 3 chờ Task 2
| task-3  | task-1        |  → Task 3 cũng chờ Task 1

Kết quả: Task 3 chỉ bắt đầu được khi CẢ Task 1 VÀ Task 2 đều xong
```

---

## 3. Các file liên quan

### 3.1. API Routes

```
src/app/api/tasks/[id]/
├── dependencies/
│   └── route.ts            ← GET, POST, DELETE phụ thuộc
└── validate-dependencies/
    └── route.ts            ← Kiểm tra vòng lặp

src/app/api/projects/[id]/
├── dependency-tree/
│   └── route.ts            ← Lấy cây phụ thuộc
└── gantt/
    └── route.ts            ← Tính lịch với phụ thuộc
```

### 3.2. Components

```
src/components/task/
├── dependency-tree-visualization.tsx   ← Hiển thị cây phụ thuộc
└── task-edit-form.tsx                  ← Form có tab chọn phụ thuộc
```

### 3.3. Thuật toán

```
src/algorithm/
└── critical-path.ts        ← Thuật toán CPM
```

---

## 4. Cách thêm/xóa phụ thuộc

### 4.1. Giao diện

Trong trang chỉnh sửa công việc, có tab "Phụ thuộc":

```
┌────────────────────────────────────────────────┐
│  Công việc hiện tại: "Xây tường"               │
├────────────────────────────────────────────────┤
│  Phụ thuộc vào (Chọn công việc phải xong trước)│
│                                                │
│  ☑ Thi công móng       [Đang làm]             │
│  ☐ Khảo sát địa chất   [Hoàn thành]           │
│  ☐ Lập bản vẽ          [Hoàn thành]           │
│                                                │
│  ⚠ Không thể chọn: Lợp mái (sẽ tạo vòng lặp)  │
└────────────────────────────────────────────────┘
```

### 4.2. Các bước thêm phụ thuộc

1. Mở trang chỉnh sửa công việc
2. Chọn tab "Phụ thuộc"
3. Tick vào công việc muốn phụ thuộc
4. Hệ thống tự động kiểm tra vòng lặp
5. Nếu hợp lệ → Checkbox được chọn
6. Nếu tạo vòng lặp → Hiện thông báo lỗi, không cho chọn
7. Nhấn "Lưu" để áp dụng

### 4.3. Logic trong code

**File:** `src/components/task/task-edit-form.tsx`

```typescript
// Khi người dùng tick/untick checkbox
const handleDependencyToggle = async (taskId: number) => {
  const taskIdStr = taskId.toString()

  // 1. Cập nhật danh sách tạm
  let newDependencies: string[]
  if (selectedDependencies.includes(taskIdStr)) {
    // Bỏ chọn
    newDependencies = selectedDependencies.filter(id => id !== taskIdStr)
  } else {
    // Thêm mới
    newDependencies = [...selectedDependencies, taskIdStr]
  }

  // 2. Gọi API kiểm tra vòng lặp
  const response = await fetch(
    `/api/tasks/${currentTaskId}/validate-dependencies`,
    {
      method: "POST",
      body: JSON.stringify({ dependencies: newDependencies })
    }
  )

  const result = await response.json()

  // 3. Xử lý kết quả
  if (!result.isValid) {
    // Có vòng lặp → Thông báo và hoàn tác
    toast.error(result.error)
    // Không cập nhật state
  } else {
    // Hợp lệ → Cập nhật state
    setSelectedDependencies(newDependencies)
  }
}
```

### 4.4. Lưu phụ thuộc

```typescript
// Khi nhấn nút Lưu
async function onSubmit(values) {
  // 1. Xóa phụ thuộc cũ
  await supabase
    .from("task_dependencies")
    .delete()
    .eq("task_id", currentTaskId)

  // 2. Thêm phụ thuộc mới
  const dependenciesToInsert = selectedDependencies.map(depId => ({
    task_id: currentTaskId,
    depends_on_id: depId
  }))

  await supabase
    .from("task_dependencies")
    .insert(dependenciesToInsert)
}
```

---

## 5. Phát hiện vòng lặp

### 5.1. Vòng lặp là gì?

```
Vòng lặp (Circular Dependency):

Task A → phụ thuộc → Task B
Task B → phụ thuộc → Task C
Task C → phụ thuộc → Task A   ❌ VÒNG LẶP!

Kết quả: Không công việc nào có thể bắt đầu!
```

### 5.2. Thuật toán phát hiện

**File:** `src/app/api/tasks/[id]/validate-dependencies/route.ts`

Sử dụng thuật toán **DFS (Depth-First Search)**:

```typescript
function detectCircularDependency(
  dependencyMap: Map<string, string[]>,
  startTaskId: string
) {
  const visited = new Set<string>()      // Đã thăm
  const recursionStack = new Set<string>() // Đang trong đường đi hiện tại
  const path: string[] = []               // Đường đi

  function dfs(taskId: string): boolean {
    // Nếu task đang trong đường đi hiện tại → Có vòng lặp
    if (recursionStack.has(taskId)) {
      // Tìm điểm bắt đầu vòng lặp
      const cycleStart = path.indexOf(taskId)
      const circularPath = path.slice(cycleStart).concat([taskId])
      return true  // Phát hiện vòng lặp
    }

    // Nếu đã xử lý xong rồi → Bỏ qua
    if (visited.has(taskId)) {
      return false
    }

    // Đánh dấu đang xử lý
    visited.add(taskId)
    recursionStack.add(taskId)
    path.push(taskId)

    // Kiểm tra các phụ thuộc
    const dependencies = dependencyMap.get(taskId) || []
    for (const depId of dependencies) {
      if (dfs(depId)) {
        return true  // Tìm thấy vòng lặp trong nhánh con
      }
    }

    // Xong nhánh này, quay lui
    recursionStack.delete(taskId)
    path.pop()
    return false
  }

  return dfs(startTaskId)
}
```

### 5.3. Ví dụ minh họa

```
Hiện tại:
Task A → Task B → Task C

Thử thêm: Task C → Task A

Kiểm tra:
1. Bắt đầu từ Task C (task muốn thêm phụ thuộc)
2. visited = {C}, stack = {C}, path = [C]
3. C phụ thuộc A → Kiểm tra A
4. visited = {C, A}, stack = {C, A}, path = [C, A]
5. A phụ thuộc B → Kiểm tra B
6. visited = {C, A, B}, stack = {C, A, B}, path = [C, A, B]
7. B phụ thuộc C → Kiểm tra C
8. C đã trong stack → PHÁT HIỆN VÒNG LẶP!
9. circularPath = [C, A, B, C]
10. Trả về lỗi: "Phụ thuộc tạo vòng lặp: C → A → B → C"
```

### 5.4. Thông báo lỗi

```typescript
// Khi phát hiện vòng lặp
{
  isValid: false,
  error: "Phụ thuộc này sẽ tạo ra vòng lặp: Task C → Task A → Task B → Task C",
  circularPath: ["task-c", "task-a", "task-b", "task-c"]
}
```

---

## 6. Hiển thị cây phụ thuộc

**File:** `src/components/task/dependency-tree-visualization.tsx`

### 6.1. Cấu trúc dữ liệu

```typescript
interface DependencyTree {
  nodes: TreeNode[]      // Tất cả công việc
  edges: TreeEdge[]      // Các đường nối
  levels: string[][]     // Công việc theo cấp
  maxLevel: number       // Cấp sâu nhất
}

interface TreeNode {
  id: string
  name: string
  status: string
  duration_days: number
  level: number          // Độ sâu trong cây (0, 1, 2, ...)
  dependencies: string[] // Phụ thuộc vào ai
  dependents: string[]   // Ai phụ thuộc vào mình
}
```

### 6.2. Tính cấp (level) cho mỗi công việc

```typescript
// Sử dụng BFS để tính level
const levels = new Map<string, number>()
const queue = [{ taskId: rootNode.id, level: 0 }]

while (queue.length > 0) {
  const { taskId, level } = queue.shift()
  levels.set(taskId, level)

  // Các công việc phụ thuộc vào task này → level + 1
  const dependents = reverseDependencyMap.get(taskId) || []
  dependents.forEach(childId => {
    const newLevel = Math.max(level + 1, levels.get(childId) || 0)
    levels.set(childId, newLevel)
    queue.push({ taskId: childId, level: newLevel })
  })
}
```

### 6.3. Vẽ cây

```
Level 0:     [Task A]        [Task B]
                ↘               ↙
Level 1:           [Task C]
                      ↓
Level 2:           [Task D]
```

### 6.4. Màu sắc theo trạng thái

| Trạng thái | Màu nền | Màu viền |
|------------|---------|----------|
| done | Xanh lá nhạt | Xanh lá |
| in_progress | Xanh dương nhạt | Xanh dương |
| review | Vàng nhạt | Vàng cam |
| blocked | Đỏ nhạt | Đỏ |
| todo | Xám nhạt | Xám |

### 6.5. Đường nối (Edge)

```typescript
// Vẽ đường cong từ task cha đến task con
const midY = fromY + (toY - fromY) / 2
const pathData = `M ${fromX} ${fromY} Q ${fromX} ${midY} ${toX} ${toY}`

// M = Move to (điểm bắt đầu)
// Q = Quadratic curve (đường cong)
```

---

## 7. Ảnh hưởng đến lịch trình

### 7.1. Quy tắc chặn

```
Quy tắc: Công việc không thể bắt đầu cho đến khi TẤT CẢ
         các công việc tiền nhiệm đều hoàn thành (status = done)
```

### 7.2. Tính ngày bắt đầu

**File:** `src/app/api/projects/[id]/gantt/route.ts`

```typescript
const calculateTaskDates = (tasks, dependencies, projectStart) => {
  // 1. Sắp xếp theo số phụ thuộc (ít → nhiều)
  const sortedTasks = [...tasks].sort((a, b) => {
    const aDeps = getDependencyCount(a.id)
    const bDeps = getDependencyCount(b.id)
    return aDeps - bDeps
  })

  // 2. Tính ngày cho từng task
  sortedTasks.forEach(task => {
    const deps = getDependencies(task.id)
    let startDate = projectStart

    if (deps.length > 0) {
      // Tìm ngày kết thúc MUỘn NHẤT của các tiền nhiệm
      let latestEndDate = projectStart

      deps.forEach(depId => {
        const depEndDate = getEndDate(depId)
        if (depEndDate > latestEndDate) {
          latestEndDate = depEndDate
        }
      })

      // Bắt đầu = Ngày sau khi tiền nhiệm muộn nhất kết thúc
      startDate = addDays(latestEndDate, 1)
    }

    // Ngày kết thúc = Ngày bắt đầu + Thời gian - 1
    const endDate = addDays(startDate, task.duration_days - 1)

    setDates(task.id, startDate, endDate)
  })
}
```

### 7.3. Ví dụ tính toán

```
Dự án bắt đầu: 01/01/2024

Task A: 5 ngày, không phụ thuộc
  → Bắt đầu: 01/01, Kết thúc: 05/01

Task B: 3 ngày, không phụ thuộc
  → Bắt đầu: 01/01, Kết thúc: 03/01

Task C: 4 ngày, phụ thuộc A và B
  → Chờ A (05/01) và B (03/01)
  → Lấy muộn nhất: 05/01
  → Bắt đầu: 06/01, Kết thúc: 09/01

Task D: 2 ngày, phụ thuộc C
  → Chờ C (09/01)
  → Bắt đầu: 10/01, Kết thúc: 11/01
```

---

## 8. Phân tích đường găng (Critical Path)

**File:** `src/algorithm/critical-path.ts`

### 8.1. Đường găng là gì?

```
Đường găng (Critical Path) là chuỗi công việc DÀI NHẤT
từ đầu đến cuối dự án.

Đặc điểm:
- Bất kỳ công việc nào trên đường găng bị trễ
  → Toàn bộ dự án bị trễ
- Công việc trên đường găng không có thời gian đệm (slack = 0)
```

### 8.2. Các khái niệm

| Thuật ngữ | Viết tắt | Ý nghĩa |
|-----------|----------|---------|
| Early Start | ES | Ngày sớm nhất có thể bắt đầu |
| Early Finish | EF | Ngày sớm nhất có thể kết thúc |
| Late Start | LS | Ngày muộn nhất được phép bắt đầu |
| Late Finish | LF | Ngày muộn nhất được phép kết thúc |
| Slack | - | Thời gian đệm = LS - ES |

### 8.3. Thuật toán CPM

#### Bước 1: Xây dựng đồ thị

```typescript
// Tạo node cho mỗi task
const nodes = new Map()
tasks.forEach(t => {
  nodes.set(t.id, {
    id: t.id,
    duration: t.duration_days * 24,  // Đổi sang giờ
    ES: 0, EF: 0,  // Sẽ tính
    LS: 0, LF: 0,  // Sẽ tính
    slack: 0
  })
})

// Xây dựng quan hệ predecessor/successor
dependencies.forEach(dep => {
  predecessors.get(dep.task_id).push(dep.depends_on_id)
  successors.get(dep.depends_on_id).push(dep.task_id)
})
```

#### Bước 2: Forward Pass (Tính ES, EF)

```typescript
// Duyệt từ đầu đến cuối (theo thứ tự topo)
for (const id of topologicalOrder) {
  const node = nodes.get(id)
  const preds = predecessors.get(id)

  // ES = Max(EF của tất cả tiền nhiệm)
  if (preds.length > 0) {
    node.ES = Math.max(...preds.map(p => nodes.get(p).EF))
  } else {
    node.ES = 0  // Không có tiền nhiệm → Bắt đầu từ 0
  }

  // EF = ES + Duration
  node.EF = node.ES + node.duration
}

// Thời gian dự án = Max(EF của tất cả task)
const projectDuration = Math.max(...nodes.values().map(n => n.EF))
```

#### Bước 3: Backward Pass (Tính LS, LF)

```typescript
// Duyệt từ cuối về đầu (ngược thứ tự topo)
for (let i = topologicalOrder.length - 1; i >= 0; i--) {
  const id = topologicalOrder[i]
  const node = nodes.get(id)
  const succs = successors.get(id)

  // LF = Min(LS của tất cả hậu nhiệm)
  if (succs.length > 0) {
    node.LF = Math.min(...succs.map(s => nodes.get(s).LS))
  } else {
    node.LF = projectDuration  // Không có hậu nhiệm → Kết thúc dự án
  }

  // LS = LF - Duration
  node.LS = node.LF - node.duration

  // Slack = LS - ES (hoặc LF - EF)
  node.slack = node.LS - node.ES
}
```

#### Bước 4: Xác định đường găng

```typescript
// Task critical khi slack <= 0 (không có đệm)
const criticalTasks = nodes.filter(n => n.slack <= 0)

// Đường găng = Chuỗi liên tục các task critical
// từ đầu đến cuối dự án
```

### 8.4. Ví dụ tính toán

```
Task A: 5 ngày, không tiền nhiệm
Task B: 3 ngày, không tiền nhiệm
Task C: 4 ngày, phụ thuộc A
Task D: 2 ngày, phụ thuộc B
Task E: 3 ngày, phụ thuộc C và D

Forward Pass:
  A: ES=0,  EF=5
  B: ES=0,  EF=3
  C: ES=5,  EF=9   (chờ A)
  D: ES=3,  EF=5   (chờ B)
  E: ES=9,  EF=12  (chờ C và D, C muộn hơn)

Project Duration = 12 ngày

Backward Pass:
  E: LF=12, LS=9,  Slack=0  ← Critical
  C: LF=9,  LS=5,  Slack=0  ← Critical
  D: LF=9,  LS=7,  Slack=4  (có đệm 4 ngày)
  A: LF=5,  LS=0,  Slack=0  ← Critical
  B: LF=7,  LS=4,  Slack=4  (có đệm 4 ngày)

Đường găng: A → C → E (12 ngày)
```

### 8.5. Kết quả trả về

```typescript
{
  criticalPath: ["task-a", "task-c", "task-e"],
  totalDuration: 12,
  criticalPathDuration: 12,
  explanation: "Đường găng gồm 3 công việc (12 ngày). Không có đệm.",
  taskDetails: [
    {
      taskId: "task-a",
      taskName: "Task A",
      duration: 5,
      slack: 0,
      isCritical: true,
      reason: "Critical: Không có thời gian đệm"
    },
    {
      taskId: "task-b",
      taskName: "Task B",
      duration: 3,
      slack: 4,
      isCritical: false,
      reason: "Có đệm 4 ngày, có thể trễ mà không ảnh hưởng dự án"
    },
    // ...
  ]
}
```

---

## 9. API liên quan

### 9.1. Quản lý phụ thuộc

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/tasks/[id]/dependencies` | Lấy danh sách phụ thuộc |
| POST | `/api/tasks/[id]/dependencies` | Thêm/cập nhật phụ thuộc |
| DELETE | `/api/tasks/[id]/dependencies` | Xóa tất cả phụ thuộc |

### 9.2. Kiểm tra và hiển thị

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/tasks/[id]/validate-dependencies` | Kiểm tra vòng lặp |
| GET | `/api/projects/[id]/dependency-tree` | Lấy cây phụ thuộc |

### 9.3. Ví dụ Request/Response

#### Lấy phụ thuộc của task

```http
GET /api/tasks/task-c/dependencies

Response:
{
  "dependencies": [
    {
      "id": 1,
      "depends_on_id": "task-a",
      "dependency_task": {
        "id": "task-a",
        "name": "Task A",
        "status": "done",
        "progress_percentage": 100
      }
    },
    {
      "id": 2,
      "depends_on_id": "task-b",
      "dependency_task": {
        "id": "task-b",
        "name": "Task B",
        "status": "in_progress",
        "progress_percentage": 50
      }
    }
  ]
}
```

#### Thêm phụ thuộc

```http
POST /api/tasks/task-c/dependencies
Content-Type: application/json

{
  "dependencies": ["task-a", "task-b"]
}

Response (200):
{
  "success": true,
  "message": "Cập nhật phụ thuộc thành công"
}
```

#### Kiểm tra vòng lặp

```http
POST /api/tasks/task-a/validate-dependencies
Content-Type: application/json

{
  "dependencies": ["task-c"]  // Task C đã phụ thuộc A
}

Response (nếu có vòng lặp):
{
  "isValid": false,
  "error": "Phụ thuộc này sẽ tạo ra vòng lặp: task-a → task-c → task-a",
  "circularPath": ["task-a", "task-c", "task-a"]
}

Response (nếu hợp lệ):
{
  "isValid": true
}
```

---

## Tóm tắt

1. **Phụ thuộc:** Task A phụ thuộc Task B = Task B phải xong trước Task A
2. **Vòng lặp:** Không được phép tạo vòng lặp (A→B→C→A)
3. **Hệ thống tự kiểm tra:** Mỗi khi thêm phụ thuộc, DFS kiểm tra vòng lặp
4. **Lịch trình:** Task bắt đầu sau khi TẤT CẢ tiền nhiệm hoàn thành
5. **Đường găng:** Chuỗi dài nhất, không có đệm, quyết định thời gian dự án
6. **Slack:** Thời gian đệm - task có thể trễ bao lâu mà không ảnh hưởng dự án
