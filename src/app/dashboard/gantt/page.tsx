"use client"

import { useState, useEffect } from "react"
import { GanttChart } from "@/components/gantt-chart"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
  BarChart3Icon,
  TrendingUpIcon,
  UsersIcon,
  ClockIcon,
  TargetIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from "lucide-react"

interface Project {
  id: string
  name: string
  description?: string
}

export default function GanttPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>("")
  const [optimizationResults, setOptimizationResults] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Tải danh sách dự án
    async function fetchProjects() {
      try {
        const response = await fetch("/api/projects?limit=100")
        if (!response.ok) throw new Error("Không thể tải danh sách dự án")

        const data = await response.json()
        const projectsData = data.data || data.projects || []
        setProjects(projectsData)

        if (projectsData.length > 0) {
          setSelectedProject(projectsData[0].id)
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
    toast.success("Tối ưu hóa hoàn tất!")
  }

  const selectedProjectData = projects.find((p) => p.id === selectedProject)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3Icon className="h-8 w-8" />
            Biểu Đồ Gantt & Tối Ưu Hóa
          </h1>
          <p className="text-muted-foreground">Quản lý và tối ưu hóa lịch trình dự án với các thuật toán tiên tiến</p>
        </div>

        <div className="flex items-center space-x-4">
          <Select value={selectedProject} onValueChange={handleProjectChange} disabled={isLoading}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder={isLoading ? "Đang tải..." : "Chọn Dự Án"} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{project.name}</span>
                    {project.description && (
                      <span className="text-xs text-muted-foreground">{project.description}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedProjectData && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TargetIcon className="h-5 w-5 text-blue-600" />
              <span className="font-medium">Dự án hiện tại:</span>
              <span className="text-blue-700 font-semibold">{selectedProjectData.name}</span>
            </div>
            {selectedProjectData.description && (
              <p className="text-sm text-blue-600 mt-2">{selectedProjectData.description}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="gantt" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gantt" className="flex items-center gap-2">
            <BarChart3Icon className="h-4 w-4" />
            Biểu đồ Gantt
          </TabsTrigger>
          <TabsTrigger value="optimization" disabled={!optimizationResults} className="flex items-center gap-2">
            <TrendingUpIcon className="h-4 w-4" />
            Kết quả tối ưu hóa
            {optimizationResults && <Badge variant="secondary">Mới</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gantt" className="mt-6">
          {selectedProject ? (
            <GanttChart projectId={selectedProject} onOptimize={handleOptimizationResults} />
          ) : (
            <Card>
              <CardContent className="py-16">
                <div className="text-center text-muted-foreground">
                  <BarChart3Icon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">
                    {isLoading ? "Đang tải dữ liệu..." : "Chưa có dự án nào"}
                  </h3>
                  <p className="text-sm">
                    {isLoading ? "Vui lòng đợi trong giây lát..." : "Vui lòng chọn một dự án để xem biểu đồ Gantt"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="optimization" className="mt-6">
          {optimizationResults ? (
            <div className="space-y-6">
              {/* Metrics Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Thời gian hoàn thành</CardTitle>
                    <ClockIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">{optimizationResults.optimized_makespan} ngày</div>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <span>Từ {optimizationResults.original_makespan} ngày</span>
                        <ArrowRightIcon className="h-3 w-3 mx-1" />
                        <span className="text-green-600 font-medium">
                          -{optimizationResults.improvement_percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Hiệu suất tài nguyên</CardTitle>
                    <UsersIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">
                        {(optimizationResults.resource_utilization_after * 100).toFixed(1)}%
                      </div>
                      <Progress value={optimizationResults.resource_utilization_after * 100} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cân bằng khối lượng</CardTitle>
                    <TargetIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">
                        {(optimizationResults.workload_balance * 100).toFixed(1)}%
                      </div>
                      <Progress value={optimizationResults.workload_balance * 100} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Thay đổi lịch trình</CardTitle>
                    <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">{optimizationResults.schedule_changes?.length || 0}</div>
                      <div className="text-xs text-muted-foreground">công việc được tối ưu</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Results */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TargetIcon className="h-5 w-5" />
                      Đường găng (Critical Path)
                    </CardTitle>
                    <CardDescription>Chuỗi công việc quan trọng nhất quyết định thời gian dự án</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {optimizationResults.critical_path?.length > 0 ? (
                        <div className="space-y-2">
                          {optimizationResults.critical_path.map((taskId: string, index: number) => (
                            <div key={taskId} className="flex items-center gap-2 p-2 bg-red-50 rounded-md border">
                              <Badge variant="destructive" className="text-xs">
                                {index + 1}
                              </Badge>
                              <span className="text-sm font-medium">Công việc #{taskId}</span>
                              {index < optimizationResults.critical_path.length - 1 && (
                                <ArrowRightIcon className="h-4 w-4 text-muted-foreground ml-auto" />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground">
                          <AlertCircleIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Chưa xác định được đường găng</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircleIcon className="h-5 w-5" />
                      Phân tích & Đề xuất
                    </CardTitle>
                    <CardDescription>Đánh giá hiệu quả và gợi ý cải thiện</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Thuật toán sử dụng:</h4>
                        <Badge variant="outline">{optimizationResults.algorithm_used}</Badge>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="text-sm font-medium mb-2">Cải tiến chính:</h4>
                        <ul className="text-sm space-y-1">
                          {optimizationResults.explanation?.key_improvements?.map(
                            (improvement: string, index: number) => (
                              <li key={index} className="flex items-start gap-2">
                                <CheckCircleIcon className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                <span>{improvement}</span>
                              </li>
                            ),
                          ) || <li className="text-muted-foreground">Không có cải tiến đáng kể</li>}
                        </ul>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="text-sm font-medium mb-2">Đề xuất cải thiện:</h4>
                        <ul className="text-sm space-y-1">
                          <li className="flex items-start gap-2">
                            <TargetIcon className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <span>Tập trung nguồn lực vào các công việc trên đường găng</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <UsersIcon className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <span>Cân bằng lại khối lượng công việc giữa các thành viên</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <ClockIcon className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <span>Theo dõi chặt chẽ các công việc có độ trễ thấp</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Schedule Changes */}
              {optimizationResults.schedule_changes?.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Chi tiết thay đổi lịch trình</CardTitle>
                    <CardDescription>Danh sách các công việc được điều chỉnh trong quá trình tối ưu</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {optimizationResults.schedule_changes.map((change: any, index: number) => (
                        <div key={index} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{change.task_name}</h4>
                            <Badge
                              variant={
                                change.change_type === "rescheduled"
                                  ? "default"
                                  : change.change_type === "reassigned"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {change.change_type === "rescheduled" && "Dời lịch"}
                              {change.change_type === "reassigned" && "Phân công lại"}
                              {change.change_type === "both" && "Dời lịch & Phân công"}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <p>
                              <strong>Lý do:</strong> {change.reason}
                            </p>
                            <p>
                              <strong>Tác động:</strong> {change.impact}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Export Actions */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">Xuất báo cáo tối ưu hóa</h3>
                      <p className="text-sm text-muted-foreground">Lưu kết quả tối ưu hóa để chia sẻ và lưu trữ</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => window.print()}>
                        In báo cáo
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const dataStr = JSON.stringify(optimizationResults, null, 2)
                          const dataBlob = new Blob([dataStr], { type: "application/json" })
                          const url = URL.createObjectURL(dataBlob)
                          const link = document.createElement("a")
                          link.href = url
                          link.download = `optimization-results-${selectedProject}.json`
                          link.click()
                        }}
                      >
                        Xuất JSON
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-16">
                <div className="text-center text-muted-foreground">
                  <TrendingUpIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Chưa có kết quả tối ưu hóa</h3>
                  <p className="text-sm">Vui lòng chạy tối ưu hóa lịch trình ở tab Biểu đồ Gantt để xem kết quả</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
