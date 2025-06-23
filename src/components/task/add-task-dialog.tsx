'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { PlusCircle } from 'lucide-react'
import { Skeleton } from '../ui/skeleton'

interface AvailableTemplate {
  id: number
  name: string
  description: string | null
  phase: string
}

interface AddTaskDialogProps {
  projectId: string
  onCreated: () => void // Callback để làm mới danh sách công việc
}

export function AddTaskDialog({ projectId, onCreated }: AddTaskDialogProps) {
  const [open, setOpen] = useState(false)
  const [availableTemplates, setAvailableTemplates] = useState<
    AvailableTemplate[]
  >([])
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Fetch dữ liệu mỗi khi dialog được mở
  useEffect(() => {
    if (open) {
      const fetchAvailableTemplates = async () => {
        setLoading(true)
        try {
          const res = await fetch(
            `/api/projects/${projectId}/available-templates`,
          )
          if (!res.ok) throw new Error('Không thể tải danh sách công việc mẫu')
          const data = await res.json()
          setAvailableTemplates(data)
        } catch (error: any) {
          toast.error(error.message)
        } finally {
          setLoading(false)
        }
      }
      fetchAvailableTemplates()
    }
  }, [open, projectId])

  const handleSelectTemplate = (templateId: number) => {
    setSelectedTemplateIds(prev =>
      prev.includes(templateId)
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId],
    )
  }
  
  const handleSaveChanges = async () => {
    if (selectedTemplateIds.length === 0) {
        toast.info("Vui lòng chọn ít nhất một công việc để thêm.");
        return;
    }
    setIsSaving(true);
    try {
        const res = await fetch(`/api/projects/${projectId}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ template_ids: selectedTemplateIds }),
        });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || "Thêm công việc thất bại");
        }
        toast.success(`Đã thêm thành công ${selectedTemplateIds.length} công việc.`);
        onCreated(); // Gọi callback để làm mới danh sách
        setOpen(false); // Đóng dialog
        setSelectedTemplateIds([]); // Reset lựa chọn
    } catch (error: any) {
        toast.error(error.message);
    } finally {
        setIsSaving(false);
    }
  }


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Thêm công việc từ mẫu
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Thêm công việc từ quy trình chuẩn</DialogTitle>
          <DialogDescription>
            Chọn các công việc cần thiết từ danh sách mẫu để thêm vào dự án.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-72 w-full pr-4">
          <div className="space-y-4">
            {loading ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : availableTemplates.length > 0 ? (
              availableTemplates.map(template => (
                <div
                  key={template.id}
                  className="flex items-start space-x-3 p-3 border rounded-md hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleSelectTemplate(template.id)}
                >
                  <Checkbox
                    checked={selectedTemplateIds.includes(template.id)}
                    onCheckedChange={() => handleSelectTemplate(template.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{template.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  </div>
                </div>
              ))
            ) : (
                <p className='text-center text-muted-foreground py-10'>Tất cả các công việc trong quy trình chuẩn đã được thêm vào dự án.</p>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
          <Button onClick={handleSaveChanges} disabled={isSaving || loading || selectedTemplateIds.length === 0}>
            {isSaving ? "Đang thêm..." : `Thêm ${selectedTemplateIds.length} công việc`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
