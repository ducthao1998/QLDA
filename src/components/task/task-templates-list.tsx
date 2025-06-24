'use client'

import { useState } from 'react'
import { TaskTemplate } from '@/app/types/table-types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Edit, Trash2 } from 'lucide-react'
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
} from '@/components/ui/dialog'
import { TaskTemplateForm } from './task-template-form'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'


interface TaskTemplatesListProps {
  initialData: TaskTemplate[]
}

export function TaskTemplatesList({ initialData }: TaskTemplatesListProps) {
  const [templates, setTemplates] = useState(initialData)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null)
  const supabase = createClient()
  const router = useRouter()


  const handleEdit = (template: TaskTemplate) => {
    setSelectedTemplate(template)
    setIsEditDialogOpen(true)
  }

  const handleDelete = async (templateId: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa công việc mẫu này không? Hành động này không thể hoàn tác.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('task_templates')
        .delete()
        .eq('id', templateId)
      
      if (error) throw error

      toast.success('Xóa công việc mẫu thành công!')
      setTemplates(templates.filter(t => t.id !== templateId))
      router.refresh()
    } catch (error: any) {
      toast.error('Lỗi khi xóa: ' + error.message)
    }
  }


  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">Tên công việc mẫu</TableHead>
              <TableHead>Lĩnh vực</TableHead>
              <TableHead>Giai đoạn</TableHead>
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
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{template.project_field}</Badge>
                  </TableCell>
                  <TableCell className='text-sm text-muted-foreground'>{template.phase}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {template.applicable_classification.map((cls) => (
                        <Badge key={cls} variant="secondary">
                          Nhóm {cls}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{template.sequence_order}</TableCell>
                  <TableCell className="text-center">
                    {template.default_duration_days ?? 'N/A'}
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
                        <DropdownMenuItem onClick={() => handleEdit(template)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Chỉnh sửa
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(template.id)}>
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
                <TableCell colSpan={7} className="h-24 text-center">
                  Chưa có công việc mẫu nào. Hãy tạo một cái mới!
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog for Editing */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} modal={false}>
        <DialogContent className="sm:max-w-3xl" asChild>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa công việc mẫu</DialogTitle>
            <DialogDescription>
              Cập nhật các thông tin của công việc mẫu.
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <TaskTemplateForm
              template={selectedTemplate}
              onFormSubmit={() => setIsEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}