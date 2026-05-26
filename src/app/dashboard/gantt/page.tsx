"use client"

import { useState, useEffect } from "react"
import { GanttChart } from "@/components/gantt-chart"
import { OptimizationResultPanel } from "@/components/gantt/optimization-result-panel"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { BarChart3Icon, TrendingUpIcon, TargetIcon } from "lucide-react"

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
    async function fetchProjects() {
      try {
        const response = await fetch('/api/projects')
        if (!response.ok) {
          throw new Error(`Failed to fetch projects: ${response.status}`)
        }
        
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
                      <span className="text-xs text-muted-foreground
                      text-ellipsis overflow-hidden whitespace-nowrap w-[100px]">{project.description}</span>
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
             <>
               {/* Color Legend and Explanation */}
               <Card className="mb-6">
                 <CardHeader>
                   <CardTitle className="text-lg font-semibold text-gray-900">Chú thích màu sắc và trạng thái task</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="space-y-6">
                     {/* Color Legend */}
                     <div>
                       <h4 className="font-medium text-gray-900 mb-3">Màu sắc task:</h4>
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                         <div className="flex items-center gap-2">
                           <div className="w-4 h-4 rounded bg-blue-500"></div>
                           <span className="text-sm">Đang thực hiện</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <div className="w-4 h-4 rounded bg-green-500"></div>
                           <span className="text-sm">Hoàn thành</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <div className="w-4 h-4 rounded bg-red-500"></div>
                           <span className="text-sm">Critical Path</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <div className="w-4 h-4 rounded bg-yellow-500"></div>
                           <span className="text-sm">Bị trễ</span>
                         </div>
                       </div>
                     </div>

                     {/* Explanation */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div>
                         <h4 className="font-medium text-gray-900 mb-2">Tại sao task bị trễ (màu vàng)?</h4>
                         <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                           <li>Task phụ thuộc chưa hoàn thành</li>
                           <li>Thiếu tài nguyên hoặc kỹ năng</li>
                           <li>Thời gian ước tính sai</li>
                           <li>Rủi ro không lường trước</li>
                           <li>Dependency chain bị trễ</li>
                         </ul>
                       </div>
                       
                       <div>
                         <h4 className="font-medium text-gray-900 mb-2">Critical Path (màu đỏ) là gì?</h4>
                         <p className="text-sm text-gray-600">
                           Critical Path là chuỗi task dài nhất từ đầu đến cuối dự án. Nếu bất kỳ task nào trong chuỗi này bị trễ, 
                           toàn bộ dự án sẽ bị trễ. Các task này cần được ưu tiên cao nhất.
                         </p>
                       </div>
                     </div>
                   </div>
                 </CardContent>
               </Card>

               <GanttChart
                 projectId={selectedProject}
                 onOptimize={handleOptimizationResults}
                 showOptimizationResults={false}
               />
             </>
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
            <OptimizationResultPanel data={optimizationResults} />
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
