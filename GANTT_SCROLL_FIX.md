# Sửa lỗi Gantt Chart - Sorting, Scroll và UI/UX

## 🐛 Vấn đề hiện tại

### 1. Sorting không hoạt động đúng
- Task bị đẩy xuống cuối cùng
- Mũi tên dependencies chạy dọc xuống như cột dọc
- Rất xấu và khó nhìn

### 2. Không có scroll
- Chỉ có zoom in/out
- Không thể kéo xuống để xem tasks phía dưới
- Phải zoom ra rất nhỏ mới thấy được

### 3. UI/UX chưa tốt
- Không có toggle dependencies
- Column labels không đúng theo view mode
- Optimization results không giải thích rõ

## ✅ Giải pháp đã áp dụng

### 1. Sửa Sorting
```typescript
// Thêm level cho task
interface Task {
  // ... existing fields
  level?: number // Thêm level để sắp xếp
}

// Cải thiện sortTasksByDependencies
const sortTasksByDependencies = (tasks: Task[], dependencies: any[]): Task[] => {
  if (!dependencies || dependencies.length === 0) {
    // Nếu không có dependencies, sắp xếp theo thứ tự ban đầu
    return tasks.map((task, index) => ({ ...task, level: index }))
  }
  
  // ... topological sort logic
  
  // Ensure all tasks are included
  if (sortedTasks.length !== tasks.length) {
    console.warn(`Sorting issue: ${sortedTasks.length} vs ${tasks.length} tasks`)
    const missingTasks = tasks.filter((task) => !sortedTasks.find((t) => t.id === task.id))
    missingTasks.forEach((task, index) => {
      task.level = sortedTasks.length + index
      sortedTasks.push(task)
    })
  }
  
  return sortedTasks
}
```

### 2. Thêm Vertical Scroll
```typescript
// Thêm state cho vertical scroll
const [verticalScroll, setVerticalScroll] = useState(0)

// Thêm handlers
const handleScrollUp = () => setVerticalScroll((prev) => Math.max(prev - 50, 0))
const handleScrollDown = () => setVerticalScroll((prev) => prev + 50)

// Handle mouse wheel
const handleWheel = (e: React.WheelEvent) => {
  e.preventDefault()
  setVerticalScroll((prev) => {
    const newScroll = prev + e.deltaY
    return Math.max(0, newScroll)
  })
}

// Áp dụng vertical scroll vào vẽ
const y = headerHeight + index * rowHeight - verticalScroll
```

### 3. Thêm Dependencies Toggle
```typescript
// Thêm state cho toggle
const [showDependenciesOnly, setShowDependenciesOnly] = useState(false)

// Filter tasks based on toggle
if (showDependenciesOnly) {
  displayTasks = displayTasks.filter((task: Task) => task.dependencies.length > 0)
}

// Toggle button
<Button 
  variant={showDependenciesOnly ? "default" : "outline"} 
  size="sm" 
  onClick={() => setShowDependenciesOnly(!showDependenciesOnly)}
>
  🔗 {showDependenciesOnly ? "Hiện tất cả" : "Chỉ dependencies"}
</Button>
```

### 4. Sửa Column Labels
```typescript
// Cải thiện formatDateLabel
const formatDateLabel = (date: Date) => {
  switch (viewMode) {
    case "day":
      return `${date.getDate()}/${date.getMonth() + 1}`
    case "week":
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      return `${weekStart.getDate()}/${weekStart.getMonth() + 1} - ${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`
    case "month":
      const months = ["Th1", "Th2", "Th3", "Th4", "Th5", "Th6", "Th7", "Th8", "Th9", "Th10", "Th11", "Th12"]
      return `${months[date.getMonth()]} ${date.getFullYear()}`
    default:
      return date.toLocaleDateString("vi-VN")
  }
}
```

### 5. Cải thiện Optimization Results
```typescript
// Thêm giải thích chi tiết
<Card>
  <CardHeader>
    <CardTitle>Giải thích tối ưu hóa Multi-Project CPM</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4>🔥 Đường găng (Critical Path)</h4>
          <ul>
            <li>• Xác định chuỗi tasks dài nhất</li>
            <li>• Tasks không thể trì hoãn</li>
            <li>• Màu đỏ trong biểu đồ</li>
          </ul>
        </div>
        <div>
          <h4>⚡ Tối ưu hóa</h4>
          <ul>
            <li>• Sắp xếp theo dependencies</li>
            <li>• Giảm thời gian chờ</li>
            <li>• Tăng hiệu suất tài nguyên</li>
          </ul>
        </div>
      </div>
      
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4>📊 Kết quả cụ thể</h4>
        <div>
          <p>• <strong>Thời gian:</strong> Giảm từ {original} xuống {optimized} ngày</p>
          <p>• <strong>Hiệu suất:</strong> Tăng {utilization}% sử dụng tài nguyên</p>
          <p>• <strong>Đường găng:</strong> {criticalPath.length} tasks quan trọng</p>
        </div>
      </div>
    </div>
  </CardContent>
</Card>
```

## 🎯 Kết quả mong đợi

### 1. Sorting đúng
- Tasks hiển thị theo thứ tự dependencies
- Không có task nào bị đẩy xuống cuối
- Tất cả tasks đều có level phù hợp

### 2. Scroll hoạt động
- Có thể scroll lên/xuống bằng nút ↑↓
- Có thể scroll bằng mouse wheel
- Cursor thay đổi thành grab khi hover

### 3. Dependencies đẹp
- Mũi tên không chạy dọc xuống
- Chỉ hiển thị mũi tên khi tasks gần nhau
- Mũi tên cong mượt mà

### 4. UI/UX tốt hơn
- Toggle button để ẩn/hiện tasks không có dependencies
- Column labels hiển thị đúng theo ngày/tuần/tháng
- Optimization results giải thích chi tiết

## 🧪 Cách test

### 1. Test Sorting
```javascript
// Trong Console, kiểm tra:
console.log("Display tasks:", displayTasks);
console.log("Task levels:", displayTasks.map(t => ({ id: t.id, level: t.level })));
```

### 2. Test Scroll
- Click nút ↑↓ để scroll
- Dùng mouse wheel để scroll
- Kiểm tra cursor có thay đổi không

### 3. Test Dependencies Toggle
- Click button "🔗 Chỉ dependencies"
- Kiểm tra chỉ hiển thị tasks có dependencies
- Click "Hiện tất cả" để xem lại tất cả

### 4. Test Column Labels
- Chuyển đổi giữa Day/Week/Month
- Kiểm tra labels hiển thị đúng format
- Day: "1/1", Week: "1/1 - 7/1", Month: "Th1 2024"

### 5. Test Optimization Results
- Kiểm tra có giải thích chi tiết không
- Kiểm tra số liệu cụ thể
- Kiểm tra đường găng được highlight

## 🔧 Nếu vẫn có lỗi

### 1. Sorting vẫn sai
```javascript
// Kiểm tra dependencies data
console.log("Dependencies:", projectData.dependencies);
console.log("Tasks:", projectData.tasks);

// Kiểm tra sort function
const sorted = sortTasksByDependencies(tasks, dependencies);
console.log("Sorted result:", sorted);
```

### 2. Scroll không hoạt động
```javascript
// Kiểm tra event handler
console.log("Vertical scroll:", verticalScroll);

// Kiểm tra canvas height
console.log("Canvas height:", canvas.height);
```

### 3. Toggle không hoạt động
```javascript
// Kiểm tra state
console.log("Show dependencies only:", showDependenciesOnly);

// Kiểm tra filter
console.log("Filtered tasks:", displayTasks.filter(t => t.dependencies.length > 0));
```

### 4. Column labels sai
```javascript
// Kiểm tra view mode
console.log("View mode:", viewMode);

// Kiểm tra date formatting
console.log("Formatted date:", formatDateLabel(new Date()));
```

## 📝 Lưu ý

1. **Canvas Context**: Đảm bảo `ctx.roundRect` được support
2. **Performance**: Scroll có thể chậm với nhiều tasks
3. **Memory**: Vertical scroll state cần được reset khi đổi project
4. **Responsive**: Chart width cần responsive với screen size
5. **Dependencies Toggle**: Chỉ ẩn tasks không có dependencies, không xóa
6. **Column Labels**: Format phù hợp với từng view mode
7. **Optimization Results**: Giải thích rõ ràng và có số liệu cụ thể
