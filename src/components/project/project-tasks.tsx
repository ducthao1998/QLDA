"use client"

import { useEffect, useState } from "react"
import type { Task } from "@/app/types/table-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { FileText, PlusCircle, Bot, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { OptimizedTasksList } from "../task/tasks-list"
import { AutoAssignRaciModal } from "./auto-assign-raci-modal"

interface ProjectTasksProps {
  projectId: string
}

export function ProjectTasks({ projectId }: ProjectTasksProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAutoAssignModal, setShowAutoAssignModal] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const clearAssignments = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/raci/clear`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Không thể gỡ phân công')
      const data = await res.json()
      toast.success(data.message || 'Đã gỡ phân công')
      fetchTasks()
    } catch (e: any) {
      toast.error(e.message || 'Không thể gỡ phân công')
    } finally {
      setConfirmClear(false)
    }
  }

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${projectId}/tasks`)
      if (!response.ok) {
        throw new Error("Không thể tải danh sách công việc")
      }
      const data = await response.json()
      console.log("API tasks data:", data)
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
      const response = await fetch(`/api/projects/${projectId}/load-tasks-from-template`, {
        method: "POST",
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Tạo công việc thất bại")
      }
      toast.success("Đã tạo danh sách công việc từ mẫu thành công!")
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

    if (tasks.length === 0) {
      return (
        <div className="text-center py-10 border-2 border-dashed rounded-lg">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Dự án chưa có công việc</h3>
          <p className="mt-1 text-sm text-gray-500">Bắt đầu bằng cách tạo danh sách công việc theo quy trình chuẩn.</p>
          <div className="mt-6">
            <Button onClick={handleGenerateTasks} disabled={isGenerating}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {isGenerating ? "Đang tạo công việc..." : "Tải công việc từ mẫu"}
            </Button>
          </div>
        </div>
      )
    }

    return <OptimizedTasksList projectId={projectId} tasks={tasks} onTaskUpdate={fetchTasks} />
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Danh sách Công việc</CardTitle>
          {tasks.length > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setShowAutoAssignModal(true)}>
                <Bot className="mr-2 h-4 w-4" />
                Phân công tự động
              </Button>
              <Button variant="destructive" onClick={() => setConfirmClear(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Gỡ phân công toàn dự án
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
      <AutoAssignRaciModal
        open={showAutoAssignModal}
        onClose={() => setShowAutoAssignModal(false)}
        projectId={projectId}
        tasks={tasks}
        onSuccess={fetchTasks}
      />

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận gỡ phân công</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này sẽ gỡ toàn bộ phân công R/A/C/I của tất cả công việc trong dự án. Không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={clearAssignments}>Tiếp tục</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
