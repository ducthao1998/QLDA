import { cookies } from 'next/headers'
import { TaskTemplatesListWrapper } from '@/components/task/task-templates-list-wrapper' // Import component client mới

export const revalidate = 0

// Hàm fetch dữ liệu an toàn từ phía server
async function getTaskTemplates() {
  // Lấy URL từ biến môi trường để hoạt động trên cả local và production
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const cookieStore = cookies()
  
  try {
    const response = await fetch(`${appUrl}/api/task-templates`, {
      headers: {
        Cookie: cookieStore.toString(), // Chuyển cookies để xác thực
      },
      cache: 'no-store', // Không cache để luôn lấy dữ liệu mới nhất
    })

    if (!response.ok) {
      // Log lỗi chi tiết hơn
      const errorText = await response.text();
      console.error(`Failed to fetch task templates: ${response.status} ${response.statusText}`, errorText);
      return [];
    }
    
    return await response.json()
  } catch (error) {
    console.error("Error calling fetch in getTaskTemplates:", error);
    return [];
  }
}

export default async function TaskTemplatesPage() {
  const taskTemplates = await getTaskTemplates()

  return (
    <div className="space-y-6">
       {/* TaskTemplatesListWrapper bây giờ là client component bao bọc toàn bộ trang */}
      <TaskTemplatesListWrapper initialData={taskTemplates ?? []} />
    </div>
  )
}
