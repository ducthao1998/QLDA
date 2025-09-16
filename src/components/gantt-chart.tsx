"use client"

import { useEffect, useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { RefreshCw, Calendar, CalendarDays, CalendarRange, Download, Eye, EyeOff, AlertCircle } from "lucide-react"
// Import DHTMLX Gantt CSS
import "dhtmlx-gantt/codebase/dhtmlxgantt.css"
import { GanttChartProps, OptimizationResult, Task, ViewModeType } from "@/components/gantt/types"
import { calculateTaskDates, sortTasksByDependencies } from "@/components/gantt/utils"
import { exportGanttToPdf } from "@/components/gantt/export-pdf"
import { exportGanttToExcel } from "@/components/gantt/export-excel"
import { useDhtmlxGantt } from "@/components/gantt/useDhtmlxGantt"

 

export function GanttChart({ projectId, onOptimize, showOptimizationResults = true }: GanttChartProps) {
  const [projectData, setProjectData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null)
  const [viewMode, setViewMode] = useState<ViewModeType>("month")
  const [showTasksWithoutDependencies, setShowTasksWithoutDependencies] = useState(false)
  const [taskAnalysis, setTaskAnalysis] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [lastDraftRun, setLastDraftRun] = useState<any>(null)
  const [selectedTaskForAnalysis, setSelectedTaskForAnalysis] = useState<string | null>(null)
  const ganttContainerRef = useRef<HTMLDivElement>(null)

  

  const getDisplayTasks = () => {
    if (!projectData) return []

    const { tasks = [] } = projectData
    let displayTasks = optimizationResult?.optimized_schedule || tasks

    if (projectData.dependencies) {
      displayTasks = sortTasksByDependencies(displayTasks, projectData.dependencies)
    }

    // Filter tasks based on dependency visibility setting
    if (!showTasksWithoutDependencies) {
      // Show tasks that either have dependencies OR are dependencies for other tasks
      const tasksWithDeps = new Set<string>()
      
      // Add tasks that have dependencies
      displayTasks.forEach((task: Task) => {
        if (task.has_dependencies) {
          tasksWithDeps.add(task.id)
        }
      })
      
      // Add tasks that are dependencies for other tasks
      if (projectData.dependencies) {
        projectData.dependencies.forEach((dep: any) => {
          tasksWithDeps.add(dep.depends_on_id)
        })
      }
      
      // If no tasks have dependencies, show all tasks
      if (tasksWithDeps.size === 0) {
        return displayTasks
      }
      
      displayTasks = displayTasks.filter((task: Task) => tasksWithDeps.has(task.id))
    }

    return displayTasks
  }

  const handleSaveOptimizedSchedule = async () => {
    try {
      if (!projectId) return
      const tasks = getDisplayTasks()
      if (!tasks?.length) { toast.error("Không có dữ liệu để lưu"); return }
      setSaving(true)
      const res = await fetch(`/api/projects/${projectId}/schedule/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Lịch tối ưu ${new Date().toLocaleString()}` })
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setLastDraftRun(json?.schedule_run || null)
      toast.success('Đã lưu lịch tối ưu dạng nháp')
    } catch (e: any) {
      console.error(e)
      toast.error('Lưu lịch tối ưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  const handleApproveLastRun = async () => {
    try {
      if (!lastDraftRun?.id) { toast.error('Chưa có bản nháp để duyệt'); return }
      setApproving(true)
      const res = await fetch(`/api/schedules/${lastDraftRun.id}/accept`, { method: 'POST' })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || `HTTP ${res.status}`)
      }
      toast.success('Đã duyệt lịch và đặt làm Active')
    } catch (e: any) {
      console.error(e)
      toast.error('Duyệt lịch thất bại')
    } finally {
      setApproving(false)
    }
  }

  const buildScheduleRows = () => {
    const tasks = getDisplayTasks()
    return tasks.map((t: Task) => ({
      ID: t.id,
      "Tên công việc": t.name,
      "Bắt đầu": t.calculated_start_date ? new Date(t.calculated_start_date).toLocaleDateString('vi-VN') : "",
      "Kết thúc": t.calculated_end_date ? new Date(t.calculated_end_date).toLocaleDateString('vi-VN') : "",
      "Số ngày": t.duration_days || 1,
      "Trạng thái": t.status,
      "Tiến độ (%)": t.progress ?? 0,
      "Phụ thuộc": (projectData?.dependencies || [])
        .filter((d:any)=>d.task_id===t.id)
        .map((d:any)=>d.depends_on_id)
        .join(", "),
      "Critical": t.is_critical_path ? "Yes" : "",
      "Overdue": t.is_overdue ? "Yes" : "",
    }))
  }

  const handleExportPDF = async () => {
    try {
      const tasks = getDisplayTasks()
      if (!tasks?.length) { toast.error("Không có dữ liệu công việc để xuất PDF"); return }
      const scheduleRows = buildScheduleRows()
      await exportGanttToPdf({
        tasks,
        projectData,
        projectId,
        optimizationResult,
        scheduleRows,
        taskAnalysis,
      })
      toast.success("Đã xuất PDF")
    } catch (err) {
      console.error("Export PDF error:", err)
      toast.error("Xuất PDF thất bại")
    }
  }
  
  
  const handleExportExcel = () => {
    try {
      const rows = buildScheduleRows()
      exportGanttToExcel(rows, taskAnalysis, `Gantt_Report_${projectData?.project?.name || projectId}.xlsx`)
      toast.success("Đã xuất Excel")
    } catch (err) {
      console.error("Export Excel error:", err)
      toast.error("Xuất Excel thất bại")
    }
  }

  // Initialize DHTMLX Gantt via custom hook
  useDhtmlxGantt(
    ganttContainerRef as unknown as React.RefObject<HTMLDivElement>,
    projectData,
    viewMode,
    showTasksWithoutDependencies,
    getDisplayTasks,
    setTaskAnalysis,
    taskAnalysis,
  )

  useEffect(() => {
    if (!projectId) return

    async function fetchProjectDataAndOptimize() {
      try {
        setIsLoading(true)

        const cacheKey = `gantt:${projectId}`
        const cached = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null
        let data: any | null = cached ? JSON.parse(cached) : null

        if (!data) {
          const response = await fetch(`/api/projects/${projectId}/gantt`, { cache: 'no-store' })
        if (!response.ok) {
          throw new Error(`Không thể tải dữ liệu dự án: ${response.status}`)
          }
          data = await response.json()
          try { sessionStorage.setItem(cacheKey, JSON.stringify(data)) } catch {}
        }

        // Fallbacks for older API responses
        if (!data.cpm_details && data.critical_path) {
          data.cpm_details = data.critical_path
        }
        if (Array.isArray(data.tasks) && data.cpm_details?.criticalPath?.length) {
          const critical = new Set((data.cpm_details.criticalPath || []).map((x: any) => String(x)))
          data.tasks = data.tasks.map((t: any) => ({
            ...t,
            id: String(t.id),
            is_critical_path: t.is_critical_path ?? critical.has(String(t.id)),
          }))
        }

        if (data.tasks && data.tasks.length > 0 && data.project?.start_date) {
          const projectStartDate = new Date(data.project.start_date)
          const tasksWithDates = calculateTaskDates(data.tasks, data.dependencies || [], projectStartDate)

          data.tasks = tasksWithDates

          const latestEndDate = new Date(
            Math.max(...tasksWithDates.map((t) => new Date(t.calculated_end_date || 0).getTime())),
          )
          data.project.end_date = latestEndDate.toISOString()
          // Re-annotate critical flag after calculating dates (in case fields were dropped)
          if (data.cpm_details?.criticalPath?.length) {
            const criticalSet = new Set((data.cpm_details.criticalPath || []).map((x: any) => String(x)))
            data.tasks = data.tasks.map((t: any) => ({
              ...t,
              is_critical_path: t.is_critical_path ?? criticalSet.has(String(t.id)),
            }))
          }
        }

        // Merge CPM details (if provided) into taskAnalysis for richer explanations
        if (data.cpm_details?.taskDetails) {
          try {
            // Deep-merge CPM details into existing analysis entries only
            setTaskAnalysis((prev) => {
              const next: Record<string, any> = { ...prev }
              for (const td of data.cpm_details.taskDetails) {
                if (next[td.taskId]) {
                  next[td.taskId] = { ...next[td.taskId], cpm: td }
                }
              }
              return next
            })
          } catch {}
        }

        setProjectData(data)

        if (data.tasks && data.tasks.length > 0) {
          const optimizeResponse = await fetch(`/api/projects/${projectId}/optimize`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              algorithm: "multi_project_cpm",
              objective: { type: "time" },
            }),
          })

          if (optimizeResponse.ok) {
            const optimizationData = await optimizeResponse.json()
            // Ensure optimized schedule carries critical flags and string ids
            if (optimizationData?.optimized_schedule && data.cpm_details?.criticalPath?.length) {
              const criticalSet = new Set((data.cpm_details.criticalPath || []).map((x: any) => String(x)))
              optimizationData.optimized_schedule = optimizationData.optimized_schedule.map((t: any) => ({
                ...t,
                id: String(t.id),
                is_critical_path: t.is_critical_path ?? criticalSet.has(String(t.id)),
              }))
            }
            setOptimizationResult(optimizationData)
            if (onOptimize) {
              onOptimize(optimizationData)
            }
          }
        }
      } catch (error) {
        console.error("Error fetching project data:", error)
        toast.error(`Lỗi khi tải dữ liệu dự án: ${error instanceof Error ? error.message : "Unknown error"}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProjectDataAndOptimize()
  }, [projectId])

  const handleRefresh = () => {
    try {
      const cacheKey = `gantt:${projectId}`
      sessionStorage.removeItem(cacheKey)
    } catch {}
    ;(async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/projects/${projectId}/gantt`, { cache: 'no-store' })
        const data = await response.json()
        try { sessionStorage.setItem(`gantt:${projectId}`, JSON.stringify(data)) } catch {}
        setProjectData(data)
      } catch (e) {
        console.error(e)
        toast.error('Không thể làm mới dữ liệu')
      } finally {
        setIsLoading(false)
      }
    })()
  }

  


  const calculateImpact = (task: Task, reverseDependencyMap: Map<string, string[]>) => {
    const affectedTasks = reverseDependencyMap.get(task.id) || []
    return {
      directImpact: affectedTasks.length,
      totalImpact: affectedTasks.length + 1, // +1 for the task itself
      affectedTaskIds: affectedTasks
    }
  }

  const getTasksWithoutDependenciesCount = () => {
    if (!projectData?.tasks) return 0
    
    const tasksWithDeps = new Set<string>()
    
    // Add tasks that have dependencies
    projectData.tasks.forEach((task: Task) => {
      if (task.has_dependencies) {
        tasksWithDeps.add(task.id)
      }
    })
    
    // Add tasks that are dependencies for other tasks
    if (projectData.dependencies) {
      projectData.dependencies.forEach((dep: any) => {
        tasksWithDeps.add(dep.depends_on_id)
      })
    }
    
    return projectData.tasks.filter((task: Task) => !tasksWithDeps.has(task.id)).length
  }

  return (
    <div className="space-y-6">
      {showOptimizationResults && optimizationResult && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Thời gian tối ưu</p>
                  <p className="text-2xl font-bold text-blue-600">{optimizationResult.optimized_makespan} ngày</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Giảm</p>
                  <p className="text-lg font-semibold text-green-600">
                    {optimizationResult.improvement_percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Hiệu suất tài nguyên</p>
                  <p className="text-2xl font-bold text-green-600">
                    {(optimizationResult.resource_utilization * 100).toFixed(1)}%
                  </p>
                </div>
                <Progress value={optimizationResult.resource_utilization * 100} className="w-16" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-indigo-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Thuật toán</p>
                  <p className="text-lg font-semibold text-indigo-600">Multi-Project CPM</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
                      <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold text-gray-900">Biểu đồ Gantt</CardTitle>
              <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  // id="show-tasks-without-deps"
                  checked={showTasksWithoutDependencies}
                  onCheckedChange={setShowTasksWithoutDependencies}
                />
                <Label htmlFor="show-tasks-without-deps" className="flex items-center gap-2 text-sm">
                  {showTasksWithoutDependencies ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  Hiện task không có dependency ({getTasksWithoutDependenciesCount()})
                </Label>
              </div>

              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewModeType)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="day" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Ngày
                  </TabsTrigger>
                  <TabsTrigger value="week" className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Tuần
                  </TabsTrigger>
                  <TabsTrigger value="month" className="flex items-center gap-2">
                    <CalendarRange className="h-4 w-4" />
                    Tháng
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExportPDF} title="Xuất PDF">
                  <Download className="h-4 w-4" /><span className="ml-2 hidden md:inline">PDF</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportExcel} title="Xuất Excel">
                  <Download className="h-4 w-4" /><span className="ml-2 hidden md:inline">Excel</span>
                </Button>
                <Button variant="default" size="sm" onClick={handleSaveOptimizedSchedule} disabled={saving || isLoading} title="Lưu lịch tối ưu (nháp)">
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                  <span className="ml-2 hidden md:inline">Lưu nháp</span>
                </Button>
                <Button variant="secondary" size="sm" onClick={handleApproveLastRun} disabled={approving || !lastDraftRun} title="Duyệt bản nháp gần nhất">
                  {approving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                  <span className="ml-2 hidden md:inline">Duyệt</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                <p className="text-gray-600">Đang tải dữ liệu dự án...</p>
              </div>
            </div>
          ) : projectData && projectData.tasks && projectData.tasks.length > 0 ? (
            <div className="w-full overflow-auto">
              <div 
                ref={ganttContainerRef} 
                className="gantt-container"
                style={{ 
                  width: "100%", 
                  height: "500px",
                  overflow: "auto"
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <Calendar className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Không có dữ liệu</h3>
                <p className="text-gray-500">Không thể tải dữ liệu dự án hoặc dự án chưa có công việc nào.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Critical Path Panel */}
      {projectData?.cpm_details?.criticalPath?.length > 0 && (
        <Card className="border-l-4 border-l-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Đường găng (Critical Path)
              <Badge variant="destructive" className="ml-2">
                {projectData.cpm_details.criticalPath.length} task
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(projectData.cpm_details.criticalPath as string[]).map((taskId: any, idx: number) => {
                const id = String(taskId)
                const task = (projectData.tasks || []).find((t: any) => String(t.id) === id)
                const detail = (projectData.cpm_details.taskDetails || []).find((td: any) => String(td.taskId) === id)
                return (
                  <div key={id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <h4 className="font-semibold text-gray-900">{task?.name || `Task ${id}`}</h4>
                        <Badge variant="secondary">#{idx + 1}</Badge>
                        {typeof detail?.slack === 'number' && (
                          <Badge variant="outline">{`Có thể trễ tối đa: ${Math.max(0, Math.round(detail.slack))} ngày${(detail.slack ?? 0) <= 0 ? ' (trễ sẽ làm chậm dự án)' : ''}`}</Badge>
                        )}
                        {typeof detail?.duration === 'number' && (
                          <Badge variant="outline">Thời lượng: {Math.round(detail.duration)} ngày</Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setSelectedTaskForAnalysis(selectedTaskForAnalysis === id ? null : id)
                        }
                      >
                        {selectedTaskForAnalysis === id ? 'Thu gọn' : 'Chi tiết'}
                      </Button>
                    </div>
                    {selectedTaskForAnalysis === id && (
                      <div className="space-y-3 mt-2 pt-3 border-t">
                        <div className="text-sm text-gray-700">
                          Đây là công việc thuộc đường găng. Nếu công việc này bị trễ, thời hạn dự án sẽ bị lùi.
                        </div>
                        {(task?.calculated_start_date || task?.calculated_end_date) && (
                          <div className="text-sm text-gray-700">
                            Bắt đầu: {task?.calculated_start_date ? new Date(task.calculated_start_date).toLocaleDateString('vi-VN') : '-'} · Kết thúc: {task?.calculated_end_date ? new Date(task.calculated_end_date).toLocaleDateString('vi-VN') : '-'}
                          </div>
                        )}
                        {detail?.reason && (
                          <div className="bg-white p-2 rounded border">
                            <div className="text-sm text-gray-800 font-medium mb-1">Vì sao là đường găng</div>
                            <div className="text-sm text-gray-600">{detail.reason}</div>
                          </div>
                        )}
                        {detail?.drivingPredecessorIds?.length ? (
                          <div className="bg-blue-50 rounded-lg p-3 border-l-4 border-blue-500">
                            <div className="text-sm font-medium text-blue-900 mb-1">Công việc đứng trước ảnh hưởng trực tiếp</div>
                            <ul className="text-sm text-blue-900 list-disc pl-5">
                              {detail.drivingPredecessorIds.map((pid: string) => {
                                const pTask = (projectData.tasks || []).find((t: any) => String(t.id) === String(pid))
                                return <li key={pid}>{pTask?.name || `Task ${pid}`}</li>
                              })}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
