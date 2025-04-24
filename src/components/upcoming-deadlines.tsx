import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarIcon } from "lucide-react"

export function UpcomingDeadlines() {
  const deadlines = [
    {
      task: "Nộp Báo Cáo Tác Động Môi Trường",
      project: "Dự Án Xây Dựng Đường Cao Tốc",
      date: "15/05/2025",
      priority: "Cao",
    },
    {
      task: "Lựa Chọn Nhà Thầu",
      project: "Cải Tạo Bệnh Viện Công",
      date: "20/05/2025",
      priority: "Trung bình",
    },
    {
      task: "Phê Duyệt Ngân Sách",
      project: "Hệ Thống Nước Thành Phố",
      date: "22/05/2025",
      priority: "Cao",
    },
    {
      task: "Họp Các Bên Liên Quan",
      project: "Tòa Nhà Cơ Quan Chính Phủ",
      date: "30/05/2025",
      priority: "Thấp",
    },
  ]

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>Hạn Chót Sắp Tới</CardTitle>
        <CardDescription>Nhiệm vụ đến hạn trong 30 ngày tới</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {deadlines.map((deadline) => (
            <div key={deadline.task} className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="font-medium">{deadline.task}</p>
                <p className="text-sm text-muted-foreground">{deadline.project}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge
                  variant={
                    deadline.priority === "Cao"
                      ? "destructive"
                      : deadline.priority === "Trung bình"
                        ? "default"
                        : "secondary"
                  }
                >
                  {deadline.priority}
                </Badge>
                <div className="flex items-center text-sm text-muted-foreground">
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {deadline.date}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
