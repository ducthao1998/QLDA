import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreHorizontalIcon, CalendarIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function TasksList() {
  const tasks = [
    {
      id: "NV-001",
      name: "Nộp Báo Cáo Tác Động Môi Trường",
      project: "Dự Án Xây Dựng Đường Cao Tốc",
      assignee: {
        name: "Nguyễn Văn A",
        avatar: "/placeholder.svg?height=32&width=32",
        initials: "NVA",
      },
      status: "Đang Thực Hiện",
      priority: "Cao",
      dueDate: "15/05/2025",
    },
    {
      id: "NV-002",
      name: "Lựa Chọn Nhà Thầu",
      project: "Cải Tạo Bệnh Viện Công",
      assignee: {
        name: "Trần Thị B",
        avatar: "/placeholder.svg?height=32&width=32",
        initials: "TTB",
      },
      status: "Chưa Bắt Đầu",
      priority: "Trung bình",
      dueDate: "20/05/2025",
    },
    {
      id: "NV-003",
      name: "Phê Duyệt Ngân Sách",
      project: "Hệ Thống Nước Thành Phố",
      assignee: {
        name: "Lê Văn C",
        avatar: "/placeholder.svg?height=32&width=32",
        initials: "LVC",
      },
      status: "Đang Xem Xét",
      priority: "Cao",
      dueDate: "22/05/2025",
    },
    {
      id: "NV-004",
      name: "Họp Các Bên Liên Quan",
      project: "Tòa Nhà Cơ Quan Chính Phủ",
      assignee: {
        name: "Phạm Thị D",
        avatar: "/placeholder.svg?height=32&width=32",
        initials: "PTD",
      },
      status: "Chưa Bắt Đầu",
      priority: "Thấp",
      dueDate: "30/05/2025",
    },
    {
      id: "NV-005",
      name: "Đánh Giá Thiết Kế Ban Đầu",
      project: "Hệ Thống Giao Thông Công Cộng",
      assignee: {
        name: "Hoàng Văn E",
        avatar: "/placeholder.svg?height=32&width=32",
        initials: "HVE",
      },
      status: "Hoàn Thành",
      priority: "Trung bình",
      dueDate: "25/04/2025",
    },
  ]

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mã</TableHead>
            <TableHead>Nhiệm Vụ</TableHead>
            <TableHead>Dự Án</TableHead>
            <TableHead>Người Phụ Trách</TableHead>
            <TableHead>Trạng Thái</TableHead>
            <TableHead>Ưu Tiên</TableHead>
            <TableHead>Hạn Chót</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id}>
              <TableCell className="font-medium">{task.id}</TableCell>
              <TableCell>{task.name}</TableCell>
              <TableCell>{task.project}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={task.assignee.avatar || "/placeholder.svg"} alt={task.assignee.name} />
                    <AvatarFallback>{task.assignee.initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs">{task.assignee.name}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    task.status === "Hoàn Thành"
                      ? "outline"
                      : task.status === "Đang Thực Hiện"
                        ? "default"
                        : task.status === "Đang Xem Xét"
                          ? "secondary"
                          : "secondary"
                  }
                >
                  {task.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    task.priority === "Cao" ? "destructive" : task.priority === "Trung bình" ? "default" : "secondary"
                  }
                >
                  {task.priority}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">
                <div className="flex items-center">
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {task.dueDate}
                </div>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontalIcon className="h-4 w-4" />
                      <span className="sr-only">Mở menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Xem chi tiết</DropdownMenuItem>
                    <DropdownMenuItem>Chỉnh sửa nhiệm vụ</DropdownMenuItem>
                    <DropdownMenuItem>Thay đổi trạng thái</DropdownMenuItem>
                    <DropdownMenuItem>Phân công lại</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">Xóa nhiệm vụ</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
