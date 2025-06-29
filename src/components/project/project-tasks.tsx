'use client'

import { useEffect, useState } from 'react'
import { Task } from '@/app/types/table-types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { TasksList } from '../task/tasks-list' // Giả sử bạn đã có component này
import { FileText, PlusCircle } from 'lucide-react'

interface ProjectTasksProps {
  projectId: string
}

export function ProjectTasks({ projectId }: ProjectTasksProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${projectId}/tasks`)
      if (!response.ok) {
        throw new Error('Không thể tải danh sách công việc')
      }
      const data = await response.json()
      setTasks(Array.isArray(data.data) ? data.data : [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [projectId])

  const handleGenerateTasks = async () => {
    try {
      setIsGenerating(true)
      const response = await fetch(
        `/api/projects/${projectId}/load-tasks-from-template`,
        {
          method: 'POST',
        },
      )
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Tạo công việc thất bại')
      }
      toast.success('Đã tạo danh sách công việc từ mẫu thành công!')
      // Tải lại danh sách công việc sau khi tạo
      await fetchTasks()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const renderContent = () => {
    if (loading) {
      return (
        <>
          <Skeleton className="h-8 w-1/4 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </>
      )
    }

    if (error) {
      return <p className="text-destructive">Lỗi: {error}</p>
    }

    // Nếu không có công việc, hiển thị nút tạo tự động
    if (tasks.length === 0) {
      return (
        <div className="text-center py-10 border-2 border-dashed rounded-lg">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            Dự án chưa có công việc
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Bắt đầu bằng cách tạo danh sách công việc theo quy trình chuẩn.
          </p>
          <div className="mt-6">
            <Button onClick={handleGenerateTasks} disabled={isGenerating}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {isGenerating
                ? 'Đang tạo công việc...'
                : 'Tải công việc từ mẫu'}
            </Button>
          </div>
        </div>
      )
    }

    // Nếu có công việc, hiển thị danh sách
    return <TasksList projectId={projectId} tasks={tasks} onTaskUpdate={fetchTasks} />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Danh sách Công việc</CardTitle>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  )
}
