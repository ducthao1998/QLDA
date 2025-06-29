"use client"

import { useState, useCallback } from "react"
import type { TaskTemplate } from "@/app/types/table-types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Edit, Trash2, RefreshCw } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { TaskTemplateForm } from "./task-template-form"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

interface TaskTemplateWithSkills extends TaskTemplate {
  task_template_skills: { skill_id: number; skills: { name: string } | null }[]
}

interface TaskTemplatesListProps {
  initialData: TaskTemplateWithSkills[]
}

export function TaskTemplatesList({ initialData }: TaskTemplatesListProps) {
  const [templates, setTemplates] = useState(initialData)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplateWithSkills | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const supabase = createClient()
  const router = useRouter()
  // Refresh data from server
  const refreshData = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/task-templates")
      if (!response.ok) throw new Error("Failed to fetch data")

      const result = await response.json()
      setTemplates(result.data || [])
    } catch (error) {
      console.error("Error refreshing data:", error)
      toast.error("Lỗi khi tải lại dữ liệu")
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleEdit = (template: TaskTemplateWithSkills) => {
    setSelectedTemplate(template)
    setIsEditDialogOpen(true)
  }

  const handleDeleteClick = (template: TaskTemplateWithSkills) => {
    setSelectedTemplate(template)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedTemplate) return

    setIsDeleting(true)
    try {
      const { error } = await supabase.from("task_templates").delete().eq("id", selectedTemplate.id)

      if (error) throw error

      toast.success("Xóa công việc mẫu thành công!")
      setTemplates(templates.filter((t) => t.id !== selectedTemplate.id))
      setIsDeleteDialogOpen(false)
      setSelectedTemplate(null)
    } catch (error: any) {
      console.error("Delete error:", error)
      toast.error("Lỗi khi xóa: " + error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleFormSubmit = async () => {
    setIsEditDialogOpen(false)
    setSelectedTemplate(null)
    // Refresh data after successful edit
    await refreshData()
    toast.success("Cập nhật công việc mẫu thành công!")
  }

  const getStatusBadgeVariant = (classification: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      A: "default",
      B: "secondary",
      C: "outline",
    }
    return variants[classification] || "outline"
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header with refresh button */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Danh sách công việc mẫu</h2>
          <Button variant="outline" size="sm" onClick={refreshData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Tên công việc mẫu</TableHead>
                <TableHead>Kỹ năng yêu cầu</TableHead>
                <TableHead>Phân loại áp dụng</TableHead>
                <TableHead className="text-center">Thứ tự</TableHead>
                <TableHead className="text-center">Thời gian (ngày)</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length > 0 ? (
                templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        {template.description && (
                          <div className="text-sm text-muted-foreground mt-1">{template.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        console.log(template.task_template_skills)
                        // Lọc ra các kỹ năng hợp lệ trước
                        const validSkills = Array.isArray(template.task_template_skills)
                          ? template.task_template_skills.filter((tks) => tks.skills?.name)
                          : []

                        return validSkills.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {validSkills.map((tks) => (
                              <Badge key={tks.skill_id} variant="secondary" className="text-xs">
                                {tks.skills!.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Không yêu cầu kỹ năng cụ thể</span>
                        )
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {template.applicable_classification.map((cls) => (
                          <Badge key={cls} variant={getStatusBadgeVariant(cls)} className="text-xs">
                            Nhóm {cls}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono">
                        {template.sequence_order}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {template.default_duration_days ? (
                        <span className="font-medium">{template.default_duration_days}</span>
                      ) : (
                        <span className="text-muted-foreground italic">Chưa định</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Mở menu hành động</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(template)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Chỉnh sửa
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => handleDeleteClick(template)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Xóa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="text-muted-foreground">Chưa có công việc mẫu nào</div>
                      <div className="text-sm text-muted-foreground">Hãy tạo công việc mẫu đầu tiên để bắt đầu</div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa công việc mẫu</DialogTitle>
            <DialogDescription>Cập nhật thông tin cho công việc mẫu "{selectedTemplate?.name}"</DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <TaskTemplateForm
              template={selectedTemplate}
              onFormSubmit={handleFormSubmit}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa công việc mẫu</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa công việc mẫu "{selectedTemplate?.name}" không?
              <br />
              <strong>Hành động này không thể hoàn tác.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy bỏ</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Đang xóa...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Xóa
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
