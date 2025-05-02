"use client"

import { useState } from "react"
import { GanttChart } from "@/components/gantt-chart"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEffect } from "react"
import { toast } from "sonner"

export default function GanttPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProject, setSelectedProject] = useState<string>("")
  const [optimizationResults, setOptimizationResults] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Tải danh sách dự án
    async function fetchProjects() {
      try {
        const response = await fetch("/api/projects")
        if (!response.ok) throw new Error("Không thể tải danh sách dự án")

        const data = await response.json()
        setProjects(data.projects || [])

        if (data.projects && data.projects.length > 0) {
          setSelectedProject(data.projects[0].id)
        }
      } catch (error) {
        console.error("Error fetching projects:", error)
        toast.error("Lỗi khi tải danh sách dự án")
      } finally {
        setIsLoading(false)
      }
    }

    fetchProjects()
  }, [])

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId)
    setOptimizationResults(null)
  }

  const handleOptimizationResults = (results: any) => {
    setOptimizationResults(results)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Biểu Đồ Gantt</h1>
        <div className="flex items-center space-x-4">
          <Select value={selectedProject} onValueChange={handleProjectChange}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Chọn Dự Án" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="gantt">
        <TabsList>
          <TabsTrigger value="gantt">Biểu đồ Gantt</TabsTrigger>
          <TabsTrigger value="optimization" disabled={!optimizationResults}>
            Kết quả tối ưu hóa
          </TabsTrigger>
        </TabsList>
        <TabsContent value="gantt" className="mt-4">
          {selectedProject ? (
            <GanttChart projectId={selectedProject} onOptimize={handleOptimizationResults} />
          ) : (
            <Card>
              <CardContent className="py-10">
                <div className="text-center text-muted-foreground">
                  {isLoading ? "Đang tải dữ liệu..." : "Vui lòng chọn một dự án để xem biểu đồ Gantt"}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="optimization" className="mt-4">
          {optimizationResults ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Thông tin tối ưu hóa</CardTitle>
                  <CardDescription>Kết quả tối ưu hóa lịch trình dự án</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Thời gian hoàn thành</div>
                        <div className="text-2xl font-bold">{optimizationResults.makespan} giờ</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Số công việc</div>
                        <div className="text-2xl font-bold">{optimizationResults.tasks.length}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Tỷ lệ sử dụng tài nguyên</div>
                        <div className="text-2xl font-bold">
                          {Math.round(optimizationResults.resourceUtilization * 100)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Cân bằng khối lượng</div>
                        <div className="text-2xl font-bold">
                          {Math.round(optimizationResults.workloadBalance * 100)}%
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-2">Đường găng (Critical Path)</div>
                      <div className="text-sm border rounded-md p-3 bg-muted/50">
                        {optimizationResults.criticalPath.map((taskId: string, index: number) => {
                          const task = optimizationResults.tasks.find((t: any) => t.id === taskId)
                          return (
                            <div key={taskId} className="flex items-center">
                              <span>
                                {index + 1}. {task?.name || `Công việc #${taskId}`}
                              </span>
                              {index < optimizationResults.criticalPath.length - 1 && <span className="mx-2">→</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Phân tích hiệu suất</CardTitle>
                  <CardDescription>Đánh giá hiệu quả của lịch trình tối ưu</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-2">Phân tích đường găng</div>
                      <div className="text-sm">
                        Đường găng chiếm{" "}
                        {Math.round((optimizationResults.criticalPath.length / optimizationResults.tasks.length) * 100)}
                        % tổng số công việc. Các công việc trên đường găng cần được ưu tiên và theo dõi chặt chẽ để đảm
                        bảo dự án hoàn thành đúng tiến độ.
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-2">Đề xuất cải thiện</div>
                      <div className="text-sm">
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Tập trung nguồn lực vào các công việc trên đường găng</li>
                          <li>Cân nhắc bổ sung nhân sự cho các công việc có khối lượng lớn</li>
                          <li>Theo dõi chặt chẽ các công việc có độ trễ (slack) thấp</li>
                          <li>Cân bằng lại khối lượng công việc giữa các thành viên</li>
                        </ul>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button variant="outline" size="sm" onClick={() => window.print()}>
                        Xuất báo cáo
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-10">
                <div className="text-center text-muted-foreground">
                  Vui lòng tối ưu hóa lịch trình trước để xem kết quả
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
