'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TaskTemplate } from '@/app/types/table-types'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Edit, Trash2, PlusCircle } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { TaskTemplateForm } from './task-template-form'
import { toast } from 'sonner'

// Mở rộng type để bao gồm cả tên kỹ năng
type TaskTemplateWithSkill = TaskTemplate & {
  skills: { name: string } | null
}

interface TaskTemplatesListWrapperProps {
  initialData: TaskTemplateWithSkill[]
}

// Component table con để tái sử dụng
function TemplateTable({
  templates,
  onEdit,
  onDelete,
}: {
  templates: TaskTemplateWithSkill[]
  onEdit: (template: TaskTemplateWithSkill) => void
  onDelete: (templateId: number) => void
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[300px]">Tên công việc mẫu</TableHead>
            <TableHead>Lĩnh vực</TableHead>
            <TableHead>Giai đoạn</TableHead>
            <TableHead>Kỹ năng</TableHead>
            <TableHead className="text-center">Thứ tự</TableHead>
            <TableHead className="text-right">Hành động</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.length > 0 ? (
            templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">{template.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{template.project_field}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {template.phase}
                </TableCell>
                <TableCell>
                  {template.skills?.name ?? (
                    <span className="text-xs text-muted-foreground">Không</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {template.sequence_order}
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
                        className="text-red-600"
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
                Không có công việc mẫu nào cho loại dự án này.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function TaskTemplatesListWrapper({
  initialData,
}: TaskTemplatesListWrapperProps) {
  const router = useRouter()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] =
    useState<TaskTemplateWithSkill | null>(null)

  const handleEdit = (template: TaskTemplateWithSkill) => {
    setSelectedTemplate(template)
    setIsEditDialogOpen(true)
  }

  const handleDelete = async (templateId: number) => {
    if (
      !window.confirm(
        'Bạn có chắc chắn muốn xóa công việc mẫu này? Hành động này không thể hoàn tác.',
      )
    ) {
      return
    }

    try {
      const response = await fetch(`/api/task-templates/${templateId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Xóa thất bại')
      }

      toast.success('Xóa công việc mẫu thành công!')
      router.refresh()
    } catch (error: any) {
      toast.error('Lỗi khi xóa: ' + error.message)
    }
  }

  const closeAllDialogs = () => {
    setIsCreateDialogOpen(false)
    setIsEditDialogOpen(false)
  }

  // Lọc dữ liệu cho từng tab
  const templatesForA = useMemo(
    () =>
      initialData.filter((t) =>
        t.applicable_classification.includes('A'),
      ),
    [initialData],
  )
  const templatesForB = useMemo(
    () =>
      initialData.filter((t) =>
        t.applicable_classification.includes('B'),
      ),
    [initialData],
  )
  const templatesForC = useMemo(
    () =>
      initialData.filter((t) =>
        t.applicable_classification.includes('C'),
      ),
    [initialData],
  )

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Quản lý Công việc Mẫu (Khung dự án)
          </h1>
          <p className="text-muted-foreground">
            Tạo và quản lý các công việc chuẩn để áp dụng cho các dự án mới.
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Thêm công việc mẫu
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Tạo công việc mẫu mới</DialogTitle>
              <DialogDescription>
                Điền đầy đủ các thông tin để tạo một công việc chuẩn.
              </DialogDescription>
            </DialogHeader>
            <TaskTemplateForm onFormSubmit={closeAllDialogs} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="A" className="space-y-4">
        <TabsList>
          <TabsTrigger value="A">Dự án nhóm A</TabsTrigger>
          <TabsTrigger value="B">Dự án nhóm B</TabsTrigger>
          <TabsTrigger value="C">Dự án nhóm C</TabsTrigger>
        </TabsList>
        <TabsContent value="A">
          <TemplateTable
            templates={templatesForA}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
        <TabsContent value="B">
          <TemplateTable
            templates={templatesForB}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
        <TabsContent value="C">
          <TemplateTable
            templates={templatesForC}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>

      {/* Dialog for Editing */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa công việc mẫu</DialogTitle>
            <DialogDescription>
              Cập nhật các thông tin của công việc mẫu.
            </DialogDescription>
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
