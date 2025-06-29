"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { TaskTemplate } from "@/app/types/table-types"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Edit, Trash2, PlusCircle } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TaskTemplateForm } from "./task-template-form"
import { toast } from "sonner"

// Sửa lại type để khớp với cấu trúc dữ liệu thực tế
type TaskTemplateWithSkills = TaskTemplate & {
  task_template_skills: { skill_id: number; skills: { name: string } | null }[]
}

interface TaskTemplatesListWrapperProps {
  initialData: TaskTemplateWithSkills[]
}

// Component table con để tái sử dụng
function TemplateTable({
  templates,
  onEdit,
  onDelete,
}: {
  templates: TaskTemplateWithSkills[]
  onEdit: (template: TaskTemplateWithSkills) => void
  onDelete: (templateId: number) => void
}) {
  return (
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
                    // Lọc ra các kỹ năng hợp lệ
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
                      <Badge key={cls} variant="outline" className="text-xs">
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
                        <span className="sr-only">Mở menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(template)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Chỉnh sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => onDelete(template.id)}
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
              <TableCell colSpan={6} className="h-24 text-center">
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="text-muted-foreground">Không có công việc mẫu nào cho loại dự án này</div>
                  <div className="text-sm text-muted-foreground">Hãy tạo công việc mẫu đầu tiên</div>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function TaskTemplatesListWrapper({ initialData }: TaskTemplatesListWrapperProps) {
  const router = useRouter()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplateWithSkills | null>(null)

  const handleEdit = (template: TaskTemplateWithSkills) => {
    setSelectedTemplate(template)
    setIsEditDialogOpen(true)
  }

  const handleDelete = async (templateId: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa công việc mẫu này? Hành động này không thể hoàn tác.")) {
      return
    }

    try {
      const response = await fetch(`/api/task-templates/${templateId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Xóa thất bại")
      }

      toast.success("Xóa công việc mẫu thành công!")
      router.refresh()
    } catch (error: any) {
      toast.error("Lỗi khi xóa: " + error.message)
    }
  }

  const closeAllDialogs = () => {
    setIsCreateDialogOpen(false)
    setIsEditDialogOpen(false)
    setSelectedTemplate(null)
    // Refresh trang để cập nhật dữ liệu
    router.refresh()
  }

  // Lọc dữ liệu cho từng tab với sắp xếp theo sequence_order
  const templatesForA = useMemo(
    () =>
      initialData
        .filter((t) => t.applicable_classification.includes("A"))
        .sort((a, b) => a.sequence_order - b.sequence_order),
    [initialData],
  )

  const templatesForB = useMemo(
    () =>
      initialData
        .filter((t) => t.applicable_classification.includes("B"))
        .sort((a, b) => a.sequence_order - b.sequence_order),
    [initialData],
  )

  const templatesForC = useMemo(
    () =>
      initialData
        .filter((t) => t.applicable_classification.includes("C"))
        .sort((a, b) => a.sequence_order - b.sequence_order),
    [initialData],
  )

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quản lý Công việc Mẫu (Khung dự án)</h1>
          <p className="text-muted-foreground">Tạo và quản lý các công việc chuẩn để áp dụng cho các dự án mới.</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Thêm công việc mẫu
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tạo công việc mẫu mới</DialogTitle>
              <DialogDescription>Điền đầy đủ các thông tin để tạo một công việc chuẩn.</DialogDescription>
            </DialogHeader>
            <TaskTemplateForm onFormSubmit={closeAllDialogs} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="A" className="space-y-4">
        <TabsList>
          <TabsTrigger value="A">
            Dự án nhóm A
            <Badge variant="secondary" className="ml-2">
              {templatesForA.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="B">
            Dự án nhóm B
            <Badge variant="secondary" className="ml-2">
              {templatesForB.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="C">
            Dự án nhóm C
            <Badge variant="secondary" className="ml-2">
              {templatesForC.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="A">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Công việc mẫu cho dự án nhóm A</h3>
              <p className="text-sm text-muted-foreground">{templatesForA.length} công việc mẫu</p>
            </div>
            <TemplateTable templates={templatesForA} onEdit={handleEdit} onDelete={handleDelete} />
          </div>
        </TabsContent>

        <TabsContent value="B">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Công việc mẫu cho dự án nhóm B</h3>
              <p className="text-sm text-muted-foreground">{templatesForB.length} công việc mẫu</p>
            </div>
            <TemplateTable templates={templatesForB} onEdit={handleEdit} onDelete={handleDelete} />
          </div>
        </TabsContent>

        <TabsContent value="C">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Công việc mẫu cho dự án nhóm C</h3>
              <p className="text-sm text-muted-foreground">{templatesForC.length} công việc mẫu</p>
            </div>
            <TemplateTable templates={templatesForC} onEdit={handleEdit} onDelete={handleDelete} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog for Editing */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa công việc mẫu</DialogTitle>
            <DialogDescription>Cập nhật thông tin cho công việc mẫu "{selectedTemplate?.name}".</DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <TaskTemplateForm
              template={selectedTemplate}
              onFormSubmit={closeAllDialogs}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
