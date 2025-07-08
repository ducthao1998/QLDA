"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import type { ProjectPhase, TaskStatus } from "@/app/types/table-types"

interface CreateTaskModalProps {
  projectId: string
  phases: ProjectPhase[]
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateTaskModal({ projectId, phases, open, onClose, onSuccess }: CreateTaskModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    note: "",
    status: "todo" as TaskStatus,
    phase_id: "",
    start_date: "",
    end_date: "",
    unit_in_charge: "",
    legal_basis: "",
    max_retries: undefined as number | undefined,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error("Vui lòng nhập tên công việc")
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          max_retries: formData.max_retries || null,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create task")
      }

      toast.success("Tạo công việc thành công")
      onSuccess()
      onClose()
      setFormData({
        name: "",
        note: "",
        status: "todo",
        phase_id: "",
        start_date: "",
        end_date: "",
        unit_in_charge: "",
        legal_basis: "",
        max_retries: undefined,
      })
    } catch (error) {
      toast.error("Không thể tạo công việc")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tạo công việc mới</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Tên công việc *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nhập tên công việc..."
              required
            />
          </div>

          <div>
            <Label htmlFor="note">Ghi chú</Label>
            <Textarea
              id="note"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="Ghi chú về công việc..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="legal_basis">Căn cứ pháp lý</Label>
            <Textarea
              id="legal_basis"
              value={formData.legal_basis}
              onChange={(e) => setFormData({ ...formData, legal_basis: e.target.value })}
              placeholder="Căn cứ pháp lý..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phase">Giai đoạn</Label>
              <Select
                value={formData.phase_id}
                onValueChange={(value) => setFormData({ ...formData, phase_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn giai đoạn" />
                </SelectTrigger>
                <SelectContent>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Trạng thái</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as TaskStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Chưa bắt đầu</SelectItem>
                  <SelectItem value="in_progress">Đang thực hiện</SelectItem>
                  <SelectItem value="blocked">Bị chặn</SelectItem>
                  <SelectItem value="review">Đang xem xét</SelectItem>
                  <SelectItem value="done">Hoàn thành</SelectItem>
                  <SelectItem value="archived">Lưu trữ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="unit_in_charge">Đơn vị phụ trách</Label>
              <Input
                id="unit_in_charge"
                value={formData.unit_in_charge}
                onChange={(e) => setFormData({ ...formData, unit_in_charge: e.target.value })}
                placeholder="Đơn vị phụ trách..."
              />
            </div>

            <div>
              <Label htmlFor="max_retries">Số lần thử lại tối đa</Label>
              <Input
                id="max_retries"
                type="number"
                value={formData.max_retries || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    max_retries: e.target.value ? Number.parseInt(e.target.value) : undefined,
                  })
                }
                placeholder="Số lần thử lại..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Ngày bắt đầu</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="end_date">Ngày kết thúc</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Đang tạo..." : "Tạo công việc"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
