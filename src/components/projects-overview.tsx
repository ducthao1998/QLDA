import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

export function ProjectsOverview() {
  const projects = [
    {
      name: "Dự Án Xây Dựng Đường Cao Tốc",
      progress: 75,
      status: "Đúng Tiến Độ",
    },
    {
      name: "Cải Tạo Bệnh Viện Công",
      progress: 45,
      status: "Có Rủi Ro",
    },
    {
      name: "Hệ Thống Nước Thành Phố",
      progress: 90,
      status: "Đúng Tiến Độ",
    },
    {
      name: "Tòa Nhà Cơ Quan Chính Phủ",
      progress: 30,
      status: "Chậm Tiến Độ",
    },
  ]

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>Tiến Độ Dự Án</CardTitle>
        <CardDescription>Tổng quan các dự án chính phủ đang hoạt động</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {projects.map((project) => (
            <div key={project.name} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">{project.name}</div>
                <div
                  className={`text-xs font-medium ${
                    project.status === "Đúng Tiến Độ"
                      ? "text-green-500"
                      : project.status === "Có Rủi Ro"
                        ? "text-amber-500"
                        : "text-red-500"
                  }`}
                >
                  {project.status}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={project.progress} className="h-2" />
                <span className="text-sm text-muted-foreground w-10">{project.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
