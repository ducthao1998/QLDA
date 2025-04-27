"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface TaskFormProps {
  initialData?: any
  projectId: string
  mode: "create" | "edit"
}

export function TaskForm({ initialData, projectId, mode }: TaskFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
    status: initialData?.status || "todo",
    estimate_low: initialData?.estimate_low || 1,
    estimate_high: initialData?.estimate_high || 8,
    weight: initialData?.weight || 1,
    due_date: initialData?.due_date ? new Date(initialData.due_date) : new Date(),
    risk_level: initialData?.risk_level || 1,
    complexity: initialData?.complexity || 1,
    max_rejections: initialData?.max_rejections || 3,
    user_id: initialData?.assigned_to || "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = mode === "create" 
        ? `/api/projects/${projectId}/tasks`
        : `/api/projects/${projectId}/tasks/${initialData.id}`

      const method = mode === "create" ? "POST" : "PUT"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!res.ok) throw new Error((await res.json()).message)

      toast.success(
        mode === "create" ? "Tạo công việc thành công" : "Cập nhật công việc thành công"
      )
      router.push(`/dashboard/tasks/${mode === "create" ? (await res.json()).task.id : initialData.id}`)
      router.refresh()
    } catch (err: any) {
      toast.error("Lỗi", { description: err.message || "Có lỗi xảy ra" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Thông tin cơ bản</CardTitle>
          <CardDescription>
            Nhập thông tin cơ bản của công việc
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tên công việc</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Mô tả</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Trạng thái</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Chọn trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">Chưa bắt đầu</SelectItem>
                <SelectItem value="in_progress">Đang thực hiện</SelectItem>
                <SelectItem value="review">Đang xem xét</SelectItem>
                <SelectItem value="completed">Hoàn thành</SelectItem>
                <SelectItem value="blocked">Bị chặn</SelectItem>
                <SelectItem value="archived">Lưu trữ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Hạn hoàn thành</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.due_date && "text-muted-foreground"
                  )}
                >
                  {formData.due_date ? (
                    format(formData.due_date, "dd/MM/yyyy")
                  ) : (
                    <span>Chọn ngày</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.due_date}
                  onSelect={(date) => setFormData({ ...formData, due_date: date || new Date() })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thông số kỹ thuật</CardTitle>
          <CardDescription>
            Các thông số kỹ thuật của công việc
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Ước tính thời gian (giờ)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimate_low">Tối thiểu</Label>
                <Input
                  id="estimate_low"
                  type="number"
                  min="1"
                  value={formData.estimate_low}
                  onChange={(e) => setFormData({ ...formData, estimate_low: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimate_high">Tối đa</Label>
                <Input
                  id="estimate_high"
                  type="number"
                  min={formData.estimate_low}
                  value={formData.estimate_high}
                  onChange={(e) => setFormData({ ...formData, estimate_high: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Độ phức tạp (1-5)</Label>
            <Slider
              value={[formData.complexity]}
              min={1}
              max={5}
              step={1}
              onValueChange={(value) => setFormData({ ...formData, complexity: value[0] })}
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Đơn giản</span>
              <span>Phức tạp</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mức độ rủi ro (1-5)</Label>
            <Slider
              value={[formData.risk_level]}
              min={1}
              max={5}
              step={1}
              onValueChange={(value) => setFormData({ ...formData, risk_level: value[0] })}
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Thấp</span>
              <span>Cao</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max_rejections">Số lần từ chối tối đa</Label>
            <Input
              id="max_rejections"
              type="number"
              min="1"
              value={formData.max_rejections}
              onChange={(e) => setFormData({ ...formData, max_rejections: parseInt(e.target.value) })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? "Đang lưu..." : mode === "create" ? "Tạo công việc" : "Cập nhật"}
        </Button>
      </div>
    </form>
  )
} 