"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  RefreshCw,
  Calendar,
  CalendarDays,
  CalendarRange,
  Download,
  Eye,
  EyeOff,
  AlertCircle,
  Wand2,
} from "lucide-react"
// Import DHTMLX Gantt CSS
import "dhtmlx-gantt/codebase/dhtmlxgantt.css"
import { GanttChartProps, OptimizationResult, Task, ViewModeType } from "@/components/gantt/types"
import {
  calculateSequentialTaskDates,
  calculateTaskDates,
  sortTasksByDependencies,
} from "@/components/gantt/utils"
import { exportGanttToPdf } from "@/components/gantt/export-pdf"
import { exportGanttToExcel } from "@/components/gantt/export-excel"
import { useDhtmlxGantt } from "@/components/gantt/useDhtmlxGantt"

/** "cpm" = parallel/optimized staircase, "sequential" = naive one-after-another baseline */
type ScheduleMode = "cpm" | "sequential"

// sessionStorage keys — scoped by projectId
const ganttCacheKey = (projectId: string) => `gantt:data:${projectId}`
const optimizationCacheKey = (projectId: string) => `gantt:optimization:${projectId}`

 

export function GanttChart({ projectId, onOptimize, showOptimizationResults = true }: GanttChartProps) {
  const [projectData, setProjectData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  // CPM = parallel staircase (the "optimized" view). Sequential = baseline so the
  // user can flip back and forth and see how much was actually saved.
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("cpm")
  const [viewMode, setViewMode] = useState<ViewModeType>("month")
  const [showTasksWithoutDependencies, setShowTasksWithoutDependencies] = useState(false)
  const [taskAnalysis, setTaskAnalysis] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [lastDraftRun, setLastDraftRun] = useState<any>(null)
  const [selectedTaskForAnalysis, setSelectedTaskForAnalysis] = useState<string | null>(null)
  const ganttContainerRef = useRef<HTMLDivElement>(null)

  // Keep latest `onOptimize` in a ref so effect deps don't churn when the
  // parent re-renders with a fresh callback identity (this was the freeze cause).
  const onOptimizeRef = useRef(onOptimize)
  useEffect(() => {
    onOptimizeRef.current = onOptimize
  }, [onOptimize])

  /**
   * Compute the list of tasks to render. Switches between the CPM "staircase"
   * (parallel where possible — the optimized view) and the naive sequential
   * baseline whenever the user flips `scheduleMode`. Memoised so downstream
   * effects (DHTMLX gantt init) don't loop infinitely.
   *
   * IMPORTANT: we do NOT use `optimizationResult.optimized_schedule` as the data
   * source — those are ScheduleDetail rows with `task_id`/`start_ts` shape, not
   * the Task shape the Gantt expects. The tasks returned from /api/.../gantt
   * already carry CPM-correct dates; flipping to sequential just re-derives
   * dates client-side.
   */
  const getDisplayTasks = useCallback((): Task[] => {
    if (!projectData) return []

    const baseTasks: Task[] = projectData.tasks || []
    if (!baseTasks.length) return []

    const projectStart = projectData.project?.start_date
      ? new Date(projectData.project.start_date)
      : new Date()

    let displayTasks: Task[] =
      scheduleMode === "sequential"
        ? calculateSequentialTaskDates(baseTasks, projectData.dependencies || [], projectStart)
        : calculateTaskDates(baseTasks, projectData.dependencies || [], projectStart)

    if (projectData.dependencies) {
      displayTasks = sortTasksByDependencies(displayTasks, projectData.dependencies)
    }

    if (!showTasksWithoutDependencies) {
      const tasksWithDeps = new Set<string>()
      displayTasks.forEach((task: Task) => {
        if (task.has_dependencies) tasksWithDeps.add(task.id)
      })
      if (projectData.dependencies) {
        projectData.dependencies.forEach((dep: any) => tasksWithDeps.add(dep.depends_on_id))
      }
      if (tasksWithDeps.size === 0) return displayTasks
      displayTasks = displayTasks.filter((task: Task) => tasksWithDeps.has(task.id))
    }

    return displayTasks
  }, [projectData, scheduleMode, showTasksWithoutDependencies])

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

  /**
   * Normalize gantt-API response: ensure tasks carry stable string ids,
   * `is_critical_path` is set, and `calculated_*` dates exist.
   * Mutates `data` in place and returns it.
   */
  const normalizeProjectData = useCallback((data: any) => {
    // Older API responses used `critical_path` instead of `cpm_details`
    if (!data.cpm_details && data.critical_path) data.cpm_details = data.critical_path

    const criticalIds: string[] = (data.cpm_details?.criticalPath || []).map(String)
    const criticalSet = new Set(criticalIds)

    if (Array.isArray(data.tasks)) {
      data.tasks = data.tasks.map((t: any) => ({
        ...t,
        id: String(t.id),
        is_critical_path: t.is_critical_path ?? criticalSet.has(String(t.id)),
      }))
    }

    // Recompute display dates client-side using the same dependency-aware logic
    // as the backend (kept here so legacy/cached responses still render correctly).
    if (data.tasks?.length && data.project?.start_date) {
      const projectStart = new Date(data.project.start_date)
      const tasksWithDates = calculateTaskDates(data.tasks, data.dependencies || [], projectStart)
      data.tasks = tasksWithDates
      const ends = tasksWithDates
        .map((t) => new Date(t.calculated_end_date || 0).getTime())
        .filter((n) => Number.isFinite(n))
      if (ends.length) data.project.end_date = new Date(Math.max(...ends)).toISOString()
    }
    return data
  }, [])

  // -------- Effect 1: fetch project Gantt data (no optimization) --------
  // Re-runs only when projectId changes — refreshing the page, switching tabs,
  // or re-mounting the component all reuse the sessionStorage cache instead of
  // re-hitting the API or kicking off an optimization run.
  useEffect(() => {
    if (!projectId) return
    const controller = new AbortController()

    async function fetchProjectData() {
      try {
        setIsLoading(true)
        const cached = typeof window !== "undefined" ? sessionStorage.getItem(ganttCacheKey(projectId)) : null
        let data = cached ? JSON.parse(cached) : null

        if (!data) {
          const response = await fetch(`/api/projects/${projectId}/gantt`, {
            cache: "no-store",
            signal: controller.signal,
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          data = await response.json()
          try {
            sessionStorage.setItem(ganttCacheKey(projectId), JSON.stringify(data))
          } catch {
            /* quota errors etc. — non-fatal */
          }
        }

        data = normalizeProjectData(data)
        setProjectData(data)

        // Merge CPM details into task analysis (used by the per-task tooltips).
        if (data.cpm_details?.taskDetails) {
          setTaskAnalysis((prev) => {
            const next: Record<string, any> = { ...prev }
            for (const td of data.cpm_details.taskDetails) {
              if (next[td.taskId]) next[td.taskId] = { ...next[td.taskId], cpm: td }
            }
            return next
          })
        }

        // Restore previously computed optimization (if user already ran it this session).
        try {
          const cachedOpt = sessionStorage.getItem(optimizationCacheKey(projectId))
          if (cachedOpt) {
            const parsed = JSON.parse(cachedOpt) as OptimizationResult
            setOptimizationResult(parsed)
            onOptimizeRef.current?.(parsed)
          } else {
            setOptimizationResult(null)
          }
        } catch {
          /* ignore */
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return
        console.error("Error fetching project data:", err)
        toast.error(`Lỗi khi tải dữ liệu dự án: ${err?.message || "Unknown error"}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProjectData()
    return () => controller.abort()
    // NOTE: onOptimize is intentionally NOT in deps — it's accessed via a ref to
    // avoid re-running this effect whenever the parent passes a new function.
  }, [projectId, normalizeProjectData])

  // -------- Manual optimization trigger --------
  const handleRunOptimization = useCallback(async () => {
    if (!projectId || !projectData?.tasks?.length) {
      toast.error("Chưa có dữ liệu để tối ưu")
      return
    }
    try {
      setIsOptimizing(true)
      const response = await fetch(`/api/projects/${projectId}/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ algorithm: "multi_project_cpm", objective: { type: "time" } }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const optimizationData = await response.json()

      // Cross-tag critical-path flag onto the optimized schedule for UI styling.
      const criticalSet = new Set((projectData.cpm_details?.criticalPath || []).map(String))
      if (optimizationData?.optimized_schedule) {
        optimizationData.optimized_schedule = optimizationData.optimized_schedule.map((t: any) => ({
          ...t,
          id: String(t.id),
          is_critical_path: t.is_critical_path ?? criticalSet.has(String(t.id)),
        }))
      }

      setOptimizationResult(optimizationData)
      try {
        sessionStorage.setItem(optimizationCacheKey(projectId), JSON.stringify(optimizationData))
      } catch {
        /* ignore */
      }
      onOptimizeRef.current?.(optimizationData)
      toast.success("Tối ưu hoá hoàn tất")
    } catch (err: any) {
      console.error("Optimize error:", err)
      toast.error(`Tối ưu hoá thất bại: ${err?.message || "Unknown error"}`)
    } finally {
      setIsOptimizing(false)
    }
  }, [projectId, projectData, onOptimize])

  // -------- Refresh: clear caches and reload --------
  const handleRefresh = useCallback(async () => {
    if (!projectId) return
    try {
      sessionStorage.removeItem(ganttCacheKey(projectId))
      sessionStorage.removeItem(optimizationCacheKey(projectId))
    } catch {
      /* ignore */
    }
    setOptimizationResult(null)
    setIsLoading(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/gantt`, { cache: "no-store" })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = normalizeProjectData(await response.json())
      try {
        sessionStorage.setItem(ganttCacheKey(projectId), JSON.stringify(data))
      } catch {
        /* ignore */
      }
      setProjectData(data)
      toast.success("Đã làm mới")
    } catch (err: any) {
      console.error(err)
      toast.error("Không thể làm mới dữ liệu")
    } finally {
      setIsLoading(false)
    }
  }, [projectId, normalizeProjectData])

  


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

  // ----- Helpers for the hero comparison card -----
  const heroBefore = optimizationResult?.original_makespan ?? 0
  const heroAfter = optimizationResult?.optimized_makespan ?? 0
  const heroSaved = Math.max(0, heroBefore - heroAfter)
  const heroPct = optimizationResult?.improvement_percentage ?? 0
  // Width-as-percentage relative to the longer (sequential) baseline so the two
  // bars are visually comparable.
  const heroBeforeWidth = 100
  const heroAfterWidth = heroBefore > 0 ? Math.max(4, (heroAfter / heroBefore) * 100) : 0

  return (
    <div className="space-y-6">
      {showOptimizationResults && optimizationResult && (
        <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-white">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="flex-1 min-w-[280px]">
                <p className="text-sm font-medium text-emerald-700">Kết quả tối ưu hoá lịch trình</p>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="text-4xl font-bold text-emerald-700">
                    Tiết kiệm {heroSaved} ngày
                  </span>
                  <span className="text-lg text-emerald-600 font-medium">({heroPct.toFixed(1)}%)</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Nhờ chạy {optimizationResult.duration_analysis?.parallel_tasks_count ?? 0} công việc song song,
                  thay vì tuần tự từng việc một.
                </p>
              </div>

              <div className="flex-1 min-w-[320px]">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Trước (tuần tự)</span>
                      <span className="font-mono">{heroBefore} ngày</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-slate-400 transition-all"
                        style={{ width: `${heroBeforeWidth}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span className="text-emerald-700 font-medium">Sau (CPM song song)</span>
                      <span className="font-mono text-emerald-700">{heroAfter} ngày</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${heroAfterWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs text-muted-foreground">Đường găng</p>
                <p className="text-2xl font-bold text-amber-700">
                  {optimizationResult.critical_path?.length || 0}{" "}
                  <span className="text-sm font-normal text-muted-foreground">việc</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  không thể trễ một ngày nào
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
                      <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold text-gray-900">Biểu đồ Gantt</CardTitle>
              <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={showTasksWithoutDependencies}
                  onCheckedChange={setShowTasksWithoutDependencies}
                />
                <Label className="flex items-center gap-2 text-sm">
                  {showTasksWithoutDependencies ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  Hiện task không có dependency ({getTasksWithoutDependenciesCount()})
                </Label>
              </div>

              {/* Schedule mode toggle: lets the user A/B between the naive sequential
                  baseline and the parallel CPM "optimized" layout. */}
              <div className="flex items-center rounded-md border p-0.5 bg-muted/30">
                <button
                  type="button"
                  onClick={() => setScheduleMode("sequential")}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    scheduleMode === "sequential"
                      ? "bg-slate-700 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Lịch tuần tự — từng việc một, không song song. Baseline để so sánh."
                >
                  Tuần tự
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode("cpm")}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                    scheduleMode === "cpm"
                      ? "bg-emerald-600 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Lịch tối ưu (CPM) — chạy song song những việc có thể"
                >
                  Tối ưu (CPM)
                </button>
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
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleRunOptimization}
                  disabled={isOptimizing || isLoading || !projectData?.tasks?.length}
                  title="Chạy Multi-Project CPM để tính lịch tối ưu"
                >
                  {isOptimizing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  <span className="ml-2 hidden md:inline">
                    {optimizationResult ? "Tối ưu lại" : "Tối ưu hoá"}
                  </span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF} title="Xuất PDF">
                  <Download className="h-4 w-4" /><span className="ml-2 hidden md:inline">PDF</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportExcel} title="Xuất Excel">
                  <Download className="h-4 w-4" /><span className="ml-2 hidden md:inline">Excel</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSaveOptimizedSchedule}
                  disabled={saving || isLoading || !optimizationResult}
                  title="Lưu lịch tối ưu (nháp)"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                  <span className="ml-2 hidden md:inline">Lưu nháp</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleApproveLastRun}
                  disabled={approving || !lastDraftRun}
                  title="Duyệt bản nháp gần nhất"
                >
                  {approving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                  <span className="ml-2 hidden md:inline">Duyệt</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading} title="Làm mới">
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
            <div className="w-full space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <kbd className="px-1.5 py-0.5 border rounded bg-muted">Ctrl</kbd>
                <span>+ lăn chuột để zoom · lăn chuột thường để cuộn ngang · kéo cạnh dưới để thay đổi chiều cao</span>
              </div>
              <div
                ref={ganttContainerRef}
                className="gantt-container border rounded-md"
                style={{
                  width: "100%",
                  // Bigger default + user-resizable. CSS `resize` adds a drag handle in the SE corner.
                  height: "700px",
                  minHeight: "300px",
                  resize: "vertical",
                  overflow: "auto",
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
