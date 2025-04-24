import { GanttChart } from "@/components/gantt-chart"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function GanttPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Biểu Đồ Gantt</h1>
        <div className="flex items-center space-x-4">
          <Select defaultValue="project-1">
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Chọn Dự Án" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="project-1">Dự Án Chính Phủ A</SelectItem>
              <SelectItem value="project-2">Dự Án Cơ Sở Hạ Tầng B</SelectItem>
              <SelectItem value="project-3">Dự Án Dịch Vụ Công C</SelectItem>
            </SelectContent>
          </Select>
          <Button>Tối Ưu Lịch Trình</Button>
          <Button variant="outline">Xuất</Button>
        </div>
      </div>
      <GanttChart />
    </div>
  )
}
