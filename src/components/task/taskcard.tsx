import { useRouter } from "next/navigation";
import { useState, useEffect } from "react"
import { format } from "date-fns"
import { PlusIcon, ClockIcon, AlertCircleIcon, MoreHorizontalIcon, UserIcon, CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const statusColors: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
  todo: { variant: "secondary", label: "Chưa bắt đầu" },
  in_progress: { variant: "default", label: "Đang thực hiện" },
  review: { variant: "secondary", label: "Đang xem xét" },
  completed: { variant: "default", label: "Hoàn thành" },
  blocked: { variant: "destructive", label: "Bị chặn" },
  archived: { variant: "outline", label: "Lưu trữ" }
}

export function TaskCard({ task, projectId, onStatusChange }: { task: any; projectId: string; onStatusChange: () => void }) {
  const router = useRouter()

  async function updateStatus(newStatus: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error((await res.json()).message)
      toast.success("Cập nhật trạng thái thành công", {
        description: `Nhiệm vụ đã được cập nhật thành "${statusColors[newStatus].label}"`,
      })
      onStatusChange()
    } catch (err: any) {
      toast.error("Lỗi", { description: err.message || "Không thể cập nhật trạng thái" })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{task.name}</CardTitle>
            <CardDescription>
              <Badge variant={statusColors[task.status]?.variant || "secondary"}>
                {statusColors[task.status]?.label || task.status}
              </Badge>
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Hành động</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(`/dashboard/tasks/${task.id}`)}>
                Xem chi tiết
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/dashboard/tasks/${task.id}/edit`)}>
                Chỉnh sửa
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Cập nhật trạng thái</DropdownMenuLabel>
              {Object.keys(statusColors).map((key) => (
                <DropdownMenuItem key={key} onClick={() => updateStatus(key)}>
                  {statusColors[key].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
          {task.description || "Không có mô tả"}
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center">
            <ClockIcon className="h-3 w-3 mr-1 text-muted-foreground" />
            <span>
              {task.estimate_low}-{task.estimate_high} giờ
            </span>
          </div>
          <div className="flex items-center">
            <CalendarIcon className="h-3 w-3 mr-1 text-muted-foreground" />
            <span>Hạn: {format(new Date(task.due_date), "dd/MM/yyyy")}</span>
          </div>
          <div className="flex items-center">
            <AlertCircleIcon className="h-3 w-3 mr-1 text-muted-foreground" />
            <span>Rủi ro: {task.risk_level}/5</span>
          </div>
          <div className="flex items-center">
            <UserIcon className="h-3 w-3 mr-1 text-muted-foreground" />
            <span>{task.users?.full_name || "Chưa gán"}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <Button variant="outline" size="sm" className="w-full" onClick={() => router.push(`/dashboard/tasks/${task.id}`)}>
          Xem chi tiết
        </Button>
      </CardFooter>
    </Card>
  )
}