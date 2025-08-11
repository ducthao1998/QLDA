# Test Gantt Chart - Đã sửa theo dependencies và duration_days

## ✅ Đã sửa

### 1. Loại bỏ start_date và end_date của task
- ✅ Xóa `start_date` và `end_date` từ interface Task
- ✅ Thêm `calculated_start_date` và `calculated_end_date`
- ✅ Tính toán thời gian dựa trên dependencies và `duration_days`

### 2. Tính toán dependencies
- ✅ Sử dụng topological sort để tính toán thứ tự tasks
- ✅ Tasks không có dependencies bắt đầu từ `project.start_date`
- ✅ Tasks có dependencies bắt đầu sau khi dependencies hoàn thành
- ✅ Hiển thị mũi tên dependencies giữa các tasks

### 3. API Gantt đã hỗ trợ
- ✅ Trả về `dependencies` array
- ✅ Trả về `tasks` với `duration_days`
- ✅ Trả về `project` với `start_date`

## 🧪 Cách test

### 1. Kiểm tra dữ liệu
```sql
-- Kiểm tra project có start_date
SELECT id, name, start_date FROM projects WHERE id = '[PROJECT_ID]';

-- Kiểm tra tasks có duration_days
SELECT id, name, duration_days FROM tasks WHERE project_id = '[PROJECT_ID]';

-- Kiểm tra dependencies
SELECT * FROM task_dependencies WHERE task_id IN (
  SELECT id::text FROM tasks WHERE project_id = '[PROJECT_ID]'
);
```

### 2. Test API Gantt
```bash
curl -X GET "http://localhost:3000/api/projects/[PROJECT_ID]/gantt" \
  -H "Authorization: Bearer [YOUR_TOKEN]"
```

**Response cần có:**
```json
{
  "project": {
    "id": "...",
    "name": "...",
    "start_date": "2024-01-01T00:00:00.000Z"
  },
  "tasks": [
    {
      "id": "1",
      "name": "Task 1",
      "duration_days": 5,
      "dependencies": [],
      "calculated_start_date": "2024-01-01T00:00:00.000Z",
      "calculated_end_date": "2024-01-05T00:00:00.000Z"
    }
  ],
  "dependencies": [
    {
      "task_id": "2",
      "depends_on_id": "1"
    }
  ]
}
```

### 3. Test Component Gantt
1. Vào Dashboard → Gantt
2. Chọn project có tasks và dependencies
3. Quan sát:
   - Tasks hiển thị theo thứ tự dependencies
   - Mũi tên nối giữa các tasks
   - Thời gian tính toán đúng theo `duration_days`

### 4. Kiểm tra Console
```javascript
// Các log cần có:
"Fetching project data for ID: [PROJECT_ID]"
"Received data: {project: {...}, tasks: [...], dependencies: [...]}"
"Tasks count: X"
"Drawing optimized Gantt chart with data: {...}"
```

## 🔧 Troubleshooting

### Nếu Gantt vẫn trắng:

#### 1. Kiểm tra project có start_date
```sql
SELECT id, name, start_date FROM projects WHERE id = '[PROJECT_ID]';
```
- Nếu `start_date` là NULL, cập nhật:
```sql
UPDATE projects SET start_date = '2024-01-01' WHERE id = '[PROJECT_ID]';
```

#### 2. Kiểm tra tasks có duration_days
```sql
SELECT id, name, duration_days FROM tasks WHERE project_id = '[PROJECT_ID]';
```
- Nếu `duration_days` là NULL, cập nhật:
```sql
UPDATE tasks SET duration_days = 1 WHERE project_id = '[PROJECT_ID]' AND duration_days IS NULL;
```

#### 3. Kiểm tra dependencies
```sql
SELECT * FROM task_dependencies WHERE task_id IN (
  SELECT id::text FROM tasks WHERE project_id = '[PROJECT_ID]'
);
```

#### 4. Kiểm tra Console errors
- Mở Developer Tools (F12)
- Vào tab Console
- Xem có lỗi gì không

#### 5. Kiểm tra Network
- Vào tab Network
- Tìm request đến `/api/projects/[id]/gantt`
- Xem response có dữ liệu không

### Nếu tasks không hiển thị đúng thứ tự:

#### 1. Kiểm tra dependencies logic
```javascript
// Trong Console, kiểm tra:
console.log("Tasks with calculated dates:", tasksWithDates);
console.log("Dependencies:", dependencies);
```

#### 2. Kiểm tra topological sort
- Tasks không có dependencies phải bắt đầu từ `project.start_date`
- Tasks có dependencies phải bắt đầu sau khi dependencies hoàn thành

### Nếu không có mũi tên dependencies:

#### 1. Kiểm tra dependencies data
```javascript
// Trong Console:
console.log("Task dependencies:", task.dependencies);
console.log("Dependency tasks:", depTask);
```

#### 2. Kiểm tra calculated_end_date
- Đảm bảo `depTask.calculated_end_date` có giá trị
- Đảm bảo date format đúng

## 📊 Expected Results

### 1. Gantt Chart hiển thị:
- ✅ Tasks theo thứ tự dependencies
- ✅ Mũi tên nối giữa tasks
- ✅ Thời gian tính toán đúng theo `duration_days`
- ✅ Critical path highlighted (màu đỏ)

### 2. Dependencies flow:
```
Task A (duration: 3 days) → Task B (duration: 2 days) → Task C (duration: 4 days)
Task D (duration: 1 day) ─┘
```

### 3. Timeline:
- Task A: Day 1-3
- Task B: Day 4-5 (sau Task A)
- Task C: Day 6-9 (sau Task B)
- Task D: Day 4 (song song với Task B)

## 🎯 Test Cases

### Case 1: Tasks không có dependencies
- Tasks bắt đầu từ `project.start_date`
- Hiển thị song song nếu có thể

### Case 2: Tasks có dependencies
- Task B phụ thuộc Task A
- Task B bắt đầu sau khi Task A hoàn thành
- Có mũi tên từ Task A đến Task B

### Case 3: Multiple dependencies
- Task C phụ thuộc Task A và Task B
- Task C bắt đầu sau khi cả A và B hoàn thành
- Có mũi tên từ cả A và B đến C

### Case 4: Circular dependencies
- Hệ thống phát hiện và cảnh báo
- Không crash, hiển thị tasks có thể
