// src/app/dashboard/tasks/page.tsx
"use client"; // BƯỚC 1: Đánh dấu đây là Client Component

import { useState, useEffect } from "react";
import { TaskTemplatesListWrapper } from '@/components/task/task-templates-list-wrapper';
import { toast } from 'sonner'; // Giả sử bạn dùng react-hot-toast

export default function TaskTemplatesPage() {
  // BƯỚC 2: Dùng state để lưu dữ liệu và trạng thái loading
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // BƯỚC 3: Dùng useEffect để fetch dữ liệu khi component được mount
  useEffect(() => {
    async function getTaskTemplates() {
      try {
        const response = await fetch('/api/task-templates'); // Gọi API route như bình thường

        if (!response.ok) {
          throw new Error('Failed to fetch task templates');
        }
        
        const data = await response.json();
        setTaskTemplates(data);
      } catch (error) {
        console.error("Error fetching task templates:", error);
        toast.error("Lỗi tải danh sách mẫu công việc.");
      } finally {
        setIsLoading(false);
      }
    }

    getTaskTemplates();
  }, []); // Mảng rỗng đảm bảo useEffect chỉ chạy 1 lần

  if (isLoading) {
    return <div>Đang tải...</div>; // Hiển thị trạng thái loading
  }

  return (
    <div className="space-y-6">
      <TaskTemplatesListWrapper initialData={taskTemplates ?? []} />
    </div>
  );
}