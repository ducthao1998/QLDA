"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface EditUserData {
  id: string
  full_name: string
  email: string
  phone_number?: string
  position?: string
  org_unit?: string
}

export function EditUserDialog({
  open,
  onOpenChange,
  user,
  onUpdated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  user: EditUserData | null
  onUpdated: () => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<EditUserData | null>(user)

  useEffect(() => {
    setForm(user)
  }, [user])

  const positions = ["Quản lý", "Chỉ huy", "Cán bộ"]

  async function handleSubmit() {
    if (!form) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/users/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          phone_number: form.phone_number,
          position: form.position,
          org_unit: form.org_unit,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Không thể cập nhật thông tin")
      }
      toast.success("Đã cập nhật thông tin nhân sự")
      onOpenChange(false)
      onUpdated()
    } catch (e) {
      toast.error("Lỗi khi cập nhật", { description: e instanceof Error ? e.message : "" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa thông tin</DialogTitle>
          <DialogDescription>Cập nhật thông tin hồ sơ cán bộ.</DialogDescription>
        </DialogHeader>
        {form && (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Họ và tên</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone_number">Số điện thoại</Label>
              <Input
                id="phone_number"
                value={form.phone_number || ""}
                onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="position">Chức vụ</Label>
              <Select
                value={form.position || ""}
                onValueChange={(value) => setForm({ ...form, position: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn chức vụ" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org_unit">Đơn vị</Label>
              <Input id="org_unit" value={form.org_unit || ""} onChange={(e) => setForm({ ...form, org_unit: e.target.value })} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


