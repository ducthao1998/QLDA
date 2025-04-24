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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function TeamList() {
  const teamMembers = [
    {
      id: "NV-001",
      name: "Nguyễn Văn A",
      avatar: "/placeholder.svg?height=32&width=32",
      initials: "NVA",
      role: "Quản Lý Dự Án",
      department: "Cơ Sở Hạ Tầng",
      email: "nguyen.a@gov.vn",
      activeProjects: 3,
    },
    {
      id: "NV-002",
      name: "Trần Thị B",
      avatar: "/placeholder.svg?height=32&width=32",
      initials: "TTB",
      role: "Kỹ Sư",
      department: "Xây Dựng",
      email: "tran.b@gov.vn",
      activeProjects: 2,
    },
    {
      id: "NV-003",
      name: "Lê Văn C",
      avatar: "/placeholder.svg?height=32&width=32",
      initials: "LVC",
      role: "Chuyên Viên Tài Chính",
      department: "Tài Chính",
      email: "le.c@gov.vn",
      activeProjects: 4,
    },
    {
      id: "NV-004",
      name: "Phạm Thị D",
      avatar: "/placeholder.svg?height=32&width=32",
      initials: "PTD",
      role: "Cố Vấn Pháp Lý",
      department: "Pháp Chế",
      email: "pham.d@gov.vn",
      activeProjects: 2,
    },
    {
      id: "NV-005",
      name: "Hoàng Văn E",
      avatar: "/placeholder.svg?height=32&width=32",
      initials: "HVE",
      role: "Kiến Trúc Sư",
      department: "Thiết Kế",
      email: "hoang.e@gov.vn",
      activeProjects: 1,
    },
  ]

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mã</TableHead>
            <TableHead>Tên</TableHead>
            <TableHead>Chức Vụ</TableHead>
            <TableHead>Phòng Ban</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Dự Án Đang Tham Gia</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teamMembers.map((member) => (
            <TableRow key={member.id}>
              <TableCell className="font-medium">{member.id}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatar || "/placeholder.svg"} alt={member.name} />
                    <AvatarFallback>{member.initials}</AvatarFallback>
                  </Avatar>
                  <span>{member.name}</span>
                </div>
              </TableCell>
              <TableCell>{member.role}</TableCell>
              <TableCell>{member.department}</TableCell>
              <TableCell>{member.email}</TableCell>
              <TableCell>
                <Badge>{member.activeProjects}</Badge>
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
                    <DropdownMenuItem>Xem hồ sơ</DropdownMenuItem>
                    <DropdownMenuItem>Chỉnh sửa thông tin</DropdownMenuItem>
                    <DropdownMenuItem>Xem nhiệm vụ được giao</DropdownMenuItem>
                    <DropdownMenuItem>Xem dự án tham gia</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">Vô hiệu hóa</DropdownMenuItem>
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
