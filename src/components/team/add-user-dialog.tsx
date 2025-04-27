"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function AddUserDialog({ onUserAdded }: { onUserAdded: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newUser, setNewUser] = useState({
    full_name: "",
    position: "",
    phone_number: "",
    email: "",
    org_unit: "",
    capacity_hrs: 8,
    password: "password123"
  })

  const positions = [
    "Trưởng nhóm",
    "Cán bộ"
  ]

  const requiredFields = {
    full_name: "Họ và tên",
    email: "Email",
    phone_number: "Số điện thoại",
    position: "Chức vụ",
    org_unit: "Đơn vị"
  }

  function validateForm() {
    const missingFields = Object.entries(requiredFields)
      .filter(([key]) => !newUser[key as keyof typeof newUser])
      .map(([_, label]) => label)

    if (missingFields.length > 0) {
      toast.error(`Vui lòng điền đầy đủ thông tin bắt buộc: ${missingFields.join(", ")}`)
      return false
    }
    return true
  }

  async function handleSubmit() {
    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      // Gọi API để tạo người dùng mới
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Không thể tạo người dùng mới")
      }

      toast.success("Đã thêm nhân sự mới thành công. Email xác nhận đã được gửi.")
      setIsOpen(false)
      setNewUser({
        full_name: "",
        position: "",
        phone_number: "",
        email: "",
        org_unit: "",
        capacity_hrs: 8,
        password: "password123"
      })
      // Gọi callback để cập nhật danh sách
      onUserAdded()
    } catch (error) {
      toast.error("Lỗi khi thêm nhân sự", {
        description: error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon className="mr-2 h-4 w-4" />
          Thêm Nhân Sự
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Thêm Nhân Sự Mới</DialogTitle>
          <DialogDescription>Điền thông tin nhân sự mới vào biểu mẫu dưới đây.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="full_name" className="flex items-center gap-1">
              Họ và tên <span className="text-red-500">*</span>
            </Label>
            <Input
              id="full_name"
              value={newUser.full_name}
              onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
              placeholder="Nguyễn Văn A"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="position" className="flex items-center gap-1">
              Chức vụ <span className="text-red-500">*</span>
            </Label>
            <Select value={newUser.position} onValueChange={(value) => setNewUser({ ...newUser, position: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn chức vụ" />
              </SelectTrigger>
              <SelectContent>
                {positions.map((position) => (
                  <SelectItem key={position} value={position}>
                    {position}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="org_unit" className="flex items-center gap-1">
              Đơn vị <span className="text-red-500">*</span>
            </Label>
            <Input
              id="org_unit"
              value={newUser.org_unit}
              onChange={(e) => setNewUser({ ...newUser, org_unit: e.target.value })}
              placeholder="Nhập tên đơn vị"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email" className="flex items-center gap-1">
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              placeholder="nguyen.a@gov.vn"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone_number" className="flex items-center gap-1">
              Số điện thoại <span className="text-red-500">*</span>
            </Label>
            <Input
              id="phone_number"
              type="tel"
              value={newUser.phone_number}
              onChange={(e) => setNewUser({ ...newUser, phone_number: e.target.value })}
              placeholder="0123456789"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="capacity_hrs">
              Số giờ làm việc tối đa mỗi ngày
            </Label>
            <Input
              id="capacity_hrs"
              type="number"
              min="1"
              max="24"
              value={newUser.capacity_hrs}
              onChange={(e) => setNewUser({ ...newUser, capacity_hrs: Number.parseInt(e.target.value) })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Đang thêm..." : "Thêm nhân sự"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
