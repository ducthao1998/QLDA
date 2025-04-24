import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreHorizontalIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"

export function ProjectsList() {
  const projects = [
    {
      id: "DA-001",
      name: "Dự Án Xây Dựng Đường Cao Tốc",
      type: "Cơ Sở Hạ Tầng",
      status: "Đang Hoạt Động",
      progress: 75,
      startDate: "15/01/2025",
      endDate: "30/12/2025",
    },
    {
      id: "DA-002",
      name: "Cải Tạo Bệnh Viện Công",
      type: "Y Tế",
      status: "Đang Hoạt Động",
      progress: 45,
      startDate: "10/02/2025",
      endDate: "20/11/2025",
    },
    {
      id: "DA-003",
      name: "Hệ Thống Nước Thành Phố",
      type: "Tiện Ích",
      status: "Đang Hoạt Động",
      progress: 90,
      startDate: "05/03/2025",
      endDate: "15/08/2025",
    },
    {
      id: "DA-004",
      name: "Tòa Nhà Cơ Quan Chính Phủ",
      type: "Xây Dựng",
      status: "Đang Hoạt Động",
      progress: 30,
      startDate: "20/04/2025",
      endDate: "30/06/2026",
    },
    {
      id: "DA-005",
      name: "Hệ Thống Giao Thông Công Cộng",
      type: "Giao Thông",
      status: "Lập Kế Hoạch",
      progress: 10,
      startDate: "01/06/2025",
      endDate: "31/12/2026",
    },
  ]

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mã</TableHead>
            <TableHead>Tên</TableHead>
            <TableHead>Loại</TableHead>
            <TableHead>Trạng Thái</TableHead>
            <TableHead>Tiến Độ</TableHead>
            <TableHead>Thời Gian</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.id}>
              <TableCell className="font-medium">{project.id}</TableCell>
              <TableCell>{project.name}</TableCell>
              <TableCell>{project.type}</TableCell>
              <TableCell>
                <Badge variant={project.status === "Đang Hoạt Động" ? "default" : "secondary"}>{project.status}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={project.progress} className="h-2 w-[60px]" />
                  <span className="text-xs text-muted-foreground">{project.progress}%</span>
                </div>
              </TableCell>
              <TableCell className="text-xs">
                {project.startDate} - {project.endDate}
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
                    <DropdownMenuItem>Chỉnh sửa dự án</DropdownMenuItem>
                    <DropdownMenuItem>Xem nhiệm vụ</DropdownMenuItem>
                    <DropdownMenuItem>Ma trận RACI</DropdownMenuItem>
                    <DropdownMenuItem>Biểu đồ Gantt</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">Lưu trữ dự án</DropdownMenuItem>
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
