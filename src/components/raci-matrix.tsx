import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function RaciMatrix() {
  const tasks = [
    "Đánh Giá Tác Động Môi Trường",
    "Lập Kế Hoạch Ngân Sách",
    "Tham Vấn Các Bên Liên Quan",
    "Quy Trình Mua Sắm",
    "Đảm Bảo Chất Lượng",
    "Quản Lý Rủi Ro",
    "Báo Cáo Tiến Độ",
    "Quản Lý Hợp Đồng",
  ]

  const roles = [
    "Quản Lý Dự Án",
    "Chuyên Viên Tài Chính",
    "Cố Vấn Pháp Lý",
    "Kỹ Sư",
    "Kiến Trúc Sư",
    "Trưởng Phòng",
    "Tư Vấn Bên Ngoài",
  ]

  // R: Responsible (Thực hiện), A: Accountable (Chịu trách nhiệm), C: Consulted (Tham vấn), I: Informed (Được thông báo)
  const matrix = {
    "Đánh Giá Tác Động Môi Trường": {
      "Quản Lý Dự Án": "A",
      "Chuyên Viên Tài Chính": "I",
      "Cố Vấn Pháp Lý": "C",
      "Kỹ Sư": "R",
      "Kiến Trúc Sư": "C",
      "Trưởng Phòng": "I",
      "Tư Vấn Bên Ngoài": "R",
    },
    "Lập Kế Hoạch Ngân Sách": {
      "Quản Lý Dự Án": "A",
      "Chuyên Viên Tài Chính": "R",
      "Cố Vấn Pháp Lý": "C",
      "Kỹ Sư": "C",
      "Kiến Trúc Sư": "I",
      "Trưởng Phòng": "A",
      "Tư Vấn Bên Ngoài": "I",
    },
    "Tham Vấn Các Bên Liên Quan": {
      "Quản Lý Dự Án": "R",
      "Chuyên Viên Tài Chính": "I",
      "Cố Vấn Pháp Lý": "C",
      "Kỹ Sư": "I",
      "Kiến Trúc Sư": "I",
      "Trưởng Phòng": "A",
      "Tư Vấn Bên Ngoài": "C",
    },
    "Quy Trình Mua Sắm": {
      "Quản Lý Dự Án": "A",
      "Chuyên Viên Tài Chính": "R",
      "Cố Vấn Pháp Lý": "R",
      "Kỹ Sư": "C",
      "Kiến Trúc Sư": "I",
      "Trưởng Phòng": "A",
      "Tư Vấn Bên Ngoài": "I",
    },
    "Đảm Bảo Chất Lượng": {
      "Quản Lý Dự Án": "A",
      "Chuyên Viên Tài Chính": "I",
      "Cố Vấn Pháp Lý": "I",
      "Kỹ Sư": "R",
      "Kiến Trúc Sư": "R",
      "Trưởng Phòng": "I",
      "Tư Vấn Bên Ngoài": "C",
    },
    "Quản Lý Rủi Ro": {
      "Quản Lý Dự Án": "R",
      "Chuyên Viên Tài Chính": "C",
      "Cố Vấn Pháp Lý": "C",
      "Kỹ Sư": "C",
      "Kiến Trúc Sư": "C",
      "Trưởng Phòng": "A",
      "Tư Vấn Bên Ngoài": "R",
    },
    "Báo Cáo Tiến Độ": {
      "Quản Lý Dự Án": "R",
      "Chuyên Viên Tài Chính": "C",
      "Cố Vấn Pháp Lý": "I",
      "Kỹ Sư": "R",
      "Kiến Trúc Sư": "R",
      "Trưởng Phòng": "A",
      "Tư Vấn Bên Ngoài": "I",
    },
    "Quản Lý Hợp Đồng": {
      "Quản Lý Dự Án": "A",
      "Chuyên Viên Tài Chính": "C",
      "Cố Vấn Pháp Lý": "R",
      "Kỹ Sư": "I",
      "Kiến Trúc Sư": "I",
      "Trưởng Phòng": "I",
      "Tư Vấn Bên Ngoài": "C",
    },
  }

  const getBadgeVariant = (value:any) => {
    switch (value) {
      case "R":
        return "default"
      case "A":
        return "destructive"
      case "C":
        return "secondary"
      case "I":
        return "outline"
      default:
        return "outline"
    }
  }

  const getTooltipText = (value:any) => {
    switch (value) {
      case "R":
        return "Thực hiện: Người thực hiện công việc"
      case "A":
        return "Chịu trách nhiệm: Người chịu trách nhiệm cuối cùng"
      case "C":
        return "Tham vấn: Người được hỏi ý kiến"
      case "I":
        return "Được thông báo: Người được cập nhật thông tin"
      default:
        return ""
    }
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <TooltipProvider>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Nhiệm Vụ / Vai Trò</TableHead>
              {roles.map((role) => (
                <TableHead key={role} className="text-center min-w-[120px]">
                  {role}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task}>
                <TableCell className="font-medium">{task}</TableCell>
                {roles.map((role) => (
                  <TableCell key={`${task}-${role}`} className="text-center">
                    {matrix[task][role] ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex justify-center">
                            <Badge variant={getBadgeVariant(matrix[task][role])}>{matrix[task][role]}</Badge>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{getTooltipText(matrix[task][role])}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TooltipProvider>
    </div>
  )
}
