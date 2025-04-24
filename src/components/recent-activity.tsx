import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function RecentActivity() {
  const activities = [
    {
      user: {
        name: "Nguyễn Văn A",
        avatar: "/placeholder.svg?height=32&width=32",
        initials: "NVA",
      },
      action: "cập nhật nhiệm vụ",
      item: "Phê Duyệt Ngân Sách",
      project: "Hệ Thống Nước Thành Phố",
      time: "2 giờ trước",
    },
    {
      user: {
        name: "Trần Thị B",
        avatar: "/placeholder.svg?height=32&width=32",
        initials: "TTB",
      },
      action: "thêm bình luận vào",
      item: "Báo Cáo Tác Động Môi Trường",
      project: "Dự Án Xây Dựng Đường Cao Tốc",
      time: "4 giờ trước",
    },
    {
      user: {
        name: "Lê Văn C",
        avatar: "/placeholder.svg?height=32&width=32",
        initials: "LVC",
      },
      action: "hoàn thành nhiệm vụ",
      item: "Phỏng Vấn Các Bên Liên Quan",
      project: "Tòa Nhà Cơ Quan Chính Phủ",
      time: "Hôm qua",
    },
    {
      user: {
        name: "Phạm Thị D",
        avatar: "/placeholder.svg?height=32&width=32",
        initials: "PTD",
      },
      action: "tạo dự án mới",
      item: "Hệ Thống Giao Thông Công Cộng",
      project: "",
      time: "Hôm qua",
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hoạt Động Gần Đây</CardTitle>
        <CardDescription>Các hành động mới nhất trên tất cả dự án</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity, index) => (
            <div key={index} className="flex items-start gap-4">
              <Avatar className="h-8 w-8">
                <AvatarImage src={activity.user.avatar || "/placeholder.svg"} alt={activity.user.name} />
                <AvatarFallback>{activity.user.initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <p className="text-sm">
                  <span className="font-medium">{activity.user.name}</span> {activity.action}{" "}
                  <span className="font-medium">{activity.item}</span>
                  {activity.project && (
                    <>
                      {" "}
                      trong <span className="font-medium">{activity.project}</span>
                    </>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
