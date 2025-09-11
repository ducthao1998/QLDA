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
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import * as XLSX from "xlsx"
import autoTable from "jspdf-autotable"
// Import DHTMLX Gantt CSS
import "dhtmlx-gantt/codebase/dhtmlxgantt.css"

interface GanttChartProps {
  projectId: string
  onOptimize?: (results: any) => void
  showOptimizationResults?: boolean
}

interface Task {
  id: string
  name: string
  duration_days: number
  status: string
  progress: number
  assigned_to?: string
  assigned_user_name?: string
  dependencies: string[]
  is_overdue: boolean
  is_critical_path?: boolean
  calculated_start_date?: string
  calculated_end_date?: string
  level?: number
  has_dependencies?: boolean
}

interface OptimizationResult {
  algorithm_used: string
  original_makespan: number
  optimized_makespan: number
  improvement_percentage: number
  resource_utilization: number
  critical_path: string[]
  optimized_schedule: Task[]
}

type ViewModeType = "day" | "week" | "month"

export function GanttChart({ projectId, onOptimize, showOptimizationResults = true }: GanttChartProps) {
  const [projectData, setProjectData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null)
  const [viewMode, setViewMode] = useState<ViewModeType>("month")
  const [showTasksWithoutDependencies, setShowTasksWithoutDependencies] = useState(false)
  const [taskAnalysis, setTaskAnalysis] = useState<Record<string, any>>({})
  const [selectedTaskForAnalysis, setSelectedTaskForAnalysis] = useState<string | null>(null)
  const ganttContainerRef = useRef<HTMLDivElement>(null)

  const sortTasksByDependencies = (tasks: Task[], dependencies: any[]): Task[] => {
    if (!dependencies || dependencies.length === 0) {
      return tasks.map((task, index) => ({ ...task, level: 0, has_dependencies: false }))
    }

    const taskMap = new Map<string, Task>()
    const dependencyMap = new Map<string, string[]>()
    const inDegree = new Map<string, number>()
    const hasDependencies = new Map<string, boolean>()

    // Initialize maps
    tasks.forEach((task) => {
      taskMap.set(task.id, task)
      const deps = dependencies.filter((dep) => dep.task_id === task.id).map((dep) => dep.depends_on_id)
      dependencyMap.set(task.id, deps)
      inDegree.set(task.id, deps.length)
      hasDependencies.set(task.id, deps.length > 0)
    })

    const sortedTasks: Task[] = []
    const queue: string[] = []
    let level = 0

    // Find tasks with no dependencies (level 0)
    tasks.forEach((task) => {
      if (inDegree.get(task.id) === 0) {
        queue.push(task.id)
      }
    })

    // Process tasks level by level (topological sort)
    while (queue.length > 0) {
      const currentLevelTasks = [...queue]
      queue.length = 0

      // Add all tasks at current level
      currentLevelTasks.forEach((taskId) => {
        const currentTask = taskMap.get(taskId)!
        sortedTasks.push({ 
          ...currentTask, 
          level,
          has_dependencies: hasDependencies.get(taskId) || false
        })
      })

      // Find tasks for next level
      currentLevelTasks.forEach((taskId) => {
        tasks.forEach((task) => {
          const deps = dependencyMap.get(task.id) || []
          if (deps.includes(taskId)) {
            const newInDegree = (inDegree.get(task.id) || 0) - 1
            inDegree.set(task.id, newInDegree)

            if (newInDegree === 0) {
              queue.push(task.id)
            }
          }
        })
      })
      level++
    }

    // Add remaining tasks (if any circular dependencies)
    const remainingTasks = tasks.filter((task) => !sortedTasks.find((t) => t.id === task.id))
    remainingTasks.forEach((task) => sortedTasks.push({ 
      ...task, 
      level,
      has_dependencies: hasDependencies.get(task.id) || false
    }))

    console.log("Sorted tasks by dependency level:", sortedTasks.map(t => `${t.name} (level ${t.level}, has_deps: ${t.has_dependencies})`))
    return sortedTasks
  }

  const calculateTaskDates = (tasks: Task[], dependencies: any[], projectStartDate: Date): Task[] => {
    const taskMap = new Map<string, Task>()
    const dependencyMap = new Map<string, string[]>()
    const taskEndDates = new Map<string, Date>()
    const taskStartDates = new Map<string, Date>()

    // Initialize maps
    tasks.forEach((task) => {
      taskMap.set(task.id, { ...task, calculated_start_date: "", calculated_end_date: "" })
      const deps = dependencies.filter((dep) => dep.task_id === task.id).map((dep) => dep.depends_on_id)
      dependencyMap.set(task.id, deps)
    })

    const sortedTasks = sortTasksByDependencies(tasks, dependencies)

    // Process tasks in dependency order (topological sort)
    sortedTasks.forEach((task) => {
      const deps = dependencyMap.get(task.id) || []
      let startDate = new Date(projectStartDate)

      if (deps.length > 0) {
        // Find the latest end date among all dependencies
        let latestEndDate = new Date(projectStartDate)
        let hasValidDependency = false
        
        deps.forEach((depId) => {
          const depEndDate = taskEndDates.get(depId)
          if (depEndDate) {
            hasValidDependency = true
            if (depEndDate > latestEndDate) {
              latestEndDate = new Date(depEndDate)
            }
          }
        })
        
        if (hasValidDependency) {
          // Start the next day after the latest dependency ends
          latestEndDate.setDate(latestEndDate.getDate() + 1)
          startDate = latestEndDate
        }
      }

      // Calculate end date based on duration
      const endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + (task.duration_days || 1) - 1)

      // Store dates
      const updatedTask = taskMap.get(task.id)!
      updatedTask.calculated_start_date = startDate.toISOString()
      updatedTask.calculated_end_date = endDate.toISOString()
      taskMap.set(task.id, updatedTask)
      
      taskStartDates.set(task.id, startDate)
      taskEndDates.set(task.id, endDate)
      
      console.log(`Task ${task.name}: Start=${startDate.toISOString().split('T')[0]}, End=${endDate.toISOString().split('T')[0]}, Duration=${task.duration_days}`)
    })

    return Array.from(taskMap.values())
  }

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

  const VN_FONT_URL = "/fonts/NotoSans-Regular.ttf" // đổi nếu bạn dùng font khác

  function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = ""
    const bytes = new Uint8Array(buffer)
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }
    return btoa(binary)
  }
  
  async function ensureVnFont(pdf: any) {
    // tránh load lại nếu đã add
    const list = pdf.getFontList?.() || {}
    if (list["NotoSans"]) {
      pdf.setFont("NotoSans", "normal")
      return
    }
    const res = await fetch(VN_FONT_URL)
    const buf = await res.arrayBuffer()
    const base64 = arrayBufferToBase64(buf)
    pdf.addFileToVFS("NotoSans-Regular.ttf", base64)
    pdf.addFont("NotoSans-Regular.ttf", "NotoSans", "normal")
    pdf.setFont("NotoSans", "normal")
  }
  
  function daysBetween(a: Date, b: Date) {
    return Math.max(0, Math.round((+b - +a) / 86400000))
  }
  
  function addMonths(d: Date, n: number) {
    const x = new Date(d)
    x.setMonth(x.getMonth() + n)
    return x
  }
  
  function colorForTask(t: any) {
    if (t.is_critical_path) return [239, 68, 68]    // đỏ
    if (t.is_overdue)        return [245, 158, 11]  // vàng cam
    if (t.status === "done") return [16, 185, 129]  // xanh lá
    return [59, 130, 246]                           // xanh dương
  }
  const handleExportPDF = async () => {
    try {
      const tasks = getDisplayTasks()
      if (!tasks?.length) {
        toast.error("Không có dữ liệu công việc để xuất PDF")
        return
      }
  
      const VN_FONT_REG = "/fonts/NotoSans-Regular.ttf"
      const VN_FONT_BOLD = "/fonts/NotoSans-Bold.ttf"
  
      const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
        let binary = ""
        const bytes = new Uint8Array(buffer)
        const chunk = 0x8000
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
        }
        return btoa(binary)
      }
  
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
  
      // --- Load & register Unicode fonts (Regular + Bold) ---
      const [bufReg, bufBold] = await Promise.all([fetch(VN_FONT_REG), fetch(VN_FONT_BOLD)])
        .then(async ([r1, r2]) => [await r1.arrayBuffer(), await r2.arrayBuffer()])
      pdf.addFileToVFS("NotoSans-Regular.ttf", arrayBufferToBase64(bufReg))
      pdf.addFileToVFS("NotoSans-Bold.ttf", arrayBufferToBase64(bufBold))
      pdf.addFont("NotoSans-Regular.ttf", "NotoSans", "normal")
      pdf.addFont("NotoSans-Bold.ttf", "NotoSans", "bold")
      pdf.setFont("NotoSans", "normal")
  
      // --- Helpers ---
      const daysBetween = (a: Date, b: Date) => Math.max(0, Math.round((+b - +a) / 86400000))
      const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x }
      const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
      const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
      const colorForTask = (t: any) => (
        t.is_critical_path ? [239, 68, 68] :
        t.is_overdue ? [245, 158, 11] :
        t.status === "done" ? [16, 185, 129] :
        [59, 130, 246]
      )
  
      // --- Project range ---
      const projectStart: Date =
        (projectData?.project?.start_date && new Date(projectData.project.start_date)) ||
        new Date(Math.min(...tasks.map((t: any) => +new Date(t.calculated_start_date || Date.now()))))
  
      const projectEnd: Date =
        (projectData?.project?.end_date && new Date(projectData.project.end_date)) ||
        new Date(Math.max(...tasks.map((t: any) => +new Date(t.calculated_end_date || Date.now()))))
  
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = { l: 40, t: 40, r: 40, b: 40 }
  
      // --- Header ---
      pdf.setFont("NotoSans", "bold"); pdf.setFontSize(16)
      pdf.text("BÁO CÁO TIẾN ĐỘ DỰ ÁN", margin.l, margin.t)
      pdf.setFont("NotoSans", "normal"); pdf.setFontSize(10)
      const prjName = projectData?.project?.name || projectId
      pdf.text(`Dự án: ${prjName}`, margin.l, margin.t + 18)
      pdf.text(`Ngày: ${new Date().toLocaleDateString("vi-VN")}`, margin.l, margin.t + 32)
  
      if (optimizationResult) {
        const kpiX = pageW - margin.r - 280
        const ru = optimizationResult.resource_utilization
        const ruStr = Number.isFinite(ru) ? `${(ru * 100).toFixed(1)}%` : "-"
        pdf.setFont("NotoSans", "bold"); pdf.setFontSize(11)
        pdf.text("Tối ưu hoá", kpiX, margin.t)
        pdf.setFont("NotoSans", "normal"); pdf.setFontSize(10)
        pdf.text(`Thuật toán: ${optimizationResult.algorithm_used || "CPM"}`, kpiX, margin.t + 16)
        pdf.text(`Makespan (gốc): ${optimizationResult.original_makespan} ngày`, kpiX, margin.t + 30)
        pdf.text(`Makespan (mới): ${optimizationResult.optimized_makespan} ngày`, kpiX, margin.t + 44)
        pdf.text(`Cải thiện: ${optimizationResult.improvement_percentage.toFixed(1)}%`, kpiX, margin.t + 58)
        pdf.text(`Hiệu suất NL: ${ruStr}`, kpiX, margin.t + 72)
      }
  
      // --- Mini-Gantt (vector) ---
      const nameColW = 260
      const chartX = margin.l + nameColW
      const chartY = margin.t + 78
      const chartW = pageW - chartX - margin.r
      const axisH = 26
      const rowH = 20
      const totalDays = Math.max(1, daysBetween(projectStart, projectEnd) + 1)
      const pxPerDay = chartW / totalDays
  
      // Nhãn thời gian: chọn độ phân giải tuỳ chiều dài dự án
      type Gran = "year" | "quarter" | "month" | "week"
      const chooseGranularity = (): Gran => {
        if (totalDays > 900) return "year"
        if (totalDays > 450) return "quarter"
        if (totalDays > 120) return "month"
        return "week"
      }
      const gran = chooseGranularity()
  
      const buildTicks = () => {
        const ticks: { x: number; label: string }[] = []
        pdf.setFont("NotoSans", "normal"); pdf.setFontSize(9)
  
        if (gran === "year") {
          let cur = new Date(projectStart.getFullYear(), 0, 1)
          while (cur <= projectEnd) {
            const x = chartX + daysBetween(projectStart, cur) * pxPerDay
            ticks.push({ x, label: `${cur.getFullYear()}` })
            cur = new Date(cur.getFullYear() + 1, 0, 1)
          }
        } else if (gran === "quarter") {
          let cur = new Date(projectStart.getFullYear(), Math.floor(projectStart.getMonth() / 3) * 3, 1)
          while (cur <= projectEnd) {
            const q = Math.floor(cur.getMonth() / 3) + 1
            const x = chartX + daysBetween(projectStart, cur) * pxPerDay
            ticks.push({ x, label: `Q${q} ${cur.getFullYear()}` })
            cur = addMonths(cur, 3)
          }
        } else if (gran === "month") {
          let cur = new Date(projectStart.getFullYear(), projectStart.getMonth(), 1)
          while (cur <= projectEnd) {
            const x = chartX + daysBetween(projectStart, cur) * pxPerDay
            const label = cur.toLocaleDateString("vi-VN", { month: "short", year: "numeric" }) // vd: "thg 7, 2024"
            ticks.push({ x, label })
            cur = addMonths(cur, 1)
          }
        } else { // week
          let cur = new Date(projectStart)
          // đưa về thứ Hai của tuần đó
          cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7))
          while (cur <= projectEnd) {
            const x = chartX + daysBetween(projectStart, cur) * pxPerDay
            const label = `Tuần ${cur.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`
            ticks.push({ x, label })
            cur = addDays(cur, 7)
          }
        }
  
        // Lọc bỏ các nhãn chồng đè dựa theo bề rộng chữ
        const filtered: typeof ticks = []
        let lastRight = -Infinity
        const pad = 8
        ticks.forEach(t => {
          const w = pdf.getTextWidth(t.label)
          if (t.x > lastRight + pad) {
            filtered.push(t)
            lastRight = t.x + w
          }
        })
        return filtered
      }
  
      const drawAxisAndGrid = (yTop: number, rowsThisPage: number) => {
        const ticks = buildTicks()
  
        // Trục trên
        pdf.setDrawColor(180); pdf.setLineWidth(0.8)
        pdf.line(chartX, yTop, chartX + chartW, yTop)
  
        // Nhãn + vạch chính
        pdf.setFont("NotoSans", "normal"); pdf.setFontSize(9); pdf.setTextColor(60)
        ticks.forEach(t => {
          pdf.setDrawColor(220); pdf.setLineWidth(0.5)
          pdf.line(t.x, yTop, t.x, yTop + rowsThisPage * rowH + 2)
          pdf.text(t.label, t.x + 2, yTop - 6)
        })
  
        // Lưới nhẹ theo tuần (nếu granularity >= month thì lưới mảnh hơn)
        const step = gran === "week" ? 7 : 14
        pdf.setDrawColor(245); pdf.setLineWidth(0.2)
        for (let d = 0; d <= totalDays; d += step) {
          const x = chartX + d * pxPerDay
          pdf.line(x, yTop, x, yTop + rowsThisPage * rowH + 2)
        }
      }
  
      const maxRowsPerPage = Math.floor((pageH - chartY - margin.b - axisH) / rowH)
  
      const drawMiniGanttPage = (slice: any[], pageIndex: number) => {
        if (pageIndex > 0) pdf.addPage()
        // Tiêu đề block
        pdf.setFont("NotoSans", "bold"); pdf.setFontSize(12)
        pdf.text(pageIndex === 0 ? "Biểu đồ Gantt (tóm tắt)" : "Biểu đồ Gantt (tiếp)", margin.l, chartY - 24)
  
        // “Tên công việc”
        pdf.setFont("NotoSans", "bold"); pdf.setFontSize(10); pdf.setTextColor(30)
        pdf.text("Tên công việc", margin.l, chartY - 8)
  
        // Trục thời gian + grid
        drawAxisAndGrid(chartY, slice.length)
  
        // Hàng task
        slice.forEach((t, idx) => {
          const rowTop = chartY + idx * rowH + 4
  
          // Tên (cắt gọn gàng)
          pdf.setFont("NotoSans", "normal"); pdf.setFontSize(9); pdf.setTextColor(60)
          const name = String(t.name || "")
          pdf.text(name, margin.l, rowTop + 11, { maxWidth: nameColW - 10 })
  
          // Bar
          const s = new Date(t.calculated_start_date || projectStart)
          const e = new Date(t.calculated_end_date || s)
          const startOff = clamp(daysBetween(projectStart, s), 0, totalDays)
          const endOff = clamp(daysBetween(projectStart, e), 0, totalDays)
          const x = chartX + startOff * pxPerDay
          const w = Math.max(2, (endOff - startOff + 1) * pxPerDay)
  
          const [r, g, b] = colorForTask(t)
          // nền bar nhạt
          pdf.setFillColor(r, g, b); pdf.setDrawColor(255); pdf.setLineWidth(0.3)
          pdf.rect(x, rowTop, w, rowH - 8, "F")
          // overlay progress (đậm hơn)
          const prog = clamp(Number(t.progress ?? 0), 0, 100)
          if (prog > 0) {
            // vẽ lớp đậm ở bên trái phản ánh % hoàn thành
            pdf.setFillColor(0, 0, 0)
            pdf.setGState?.(pdf.GState({ opacity: 0.15 })) // nếu jsPDF hỗ trợ
            pdf.rect(x, rowTop, (w * prog) / 100, rowH - 8, "F")
            pdf.setGState?.(pdf.GState({ opacity: 1 }))
          }
          // viền mảnh
          pdf.setDrawColor(255); pdf.rect(x, rowTop, w, rowH - 8)
        })
  
        // Chú giải
        const legendY = chartY + slice.length * rowH + 14
        const legend = [
          { c: [59, 130, 246],  t: "Đang thực hiện" },
          { c: [16, 185, 129],  t: "Hoàn thành" },
          { c: [245, 158, 11],  t: "Trễ hạn" },
          { c: [239, 68, 68],   t: "Critical path" },
        ]
        pdf.setFont("NotoSans", "normal"); pdf.setFontSize(9); pdf.setTextColor(60)
        let lx = margin.l
        legend.forEach((lg) => {
          pdf.setFillColor(lg.c[0], lg.c[1], lg.c[2])
          pdf.rect(lx, legendY - 8, 12, 12, "F")
          pdf.text(lg.t, lx + 18, legendY + 2)
          lx += 130
        })
      }
  
      for (let i = 0; i < tasks.length; i += maxRowsPerPage) {
        const slice = tasks.slice(i, i + maxRowsPerPage)
        drawMiniGanttPage(slice, i === 0 ? 0 : i / maxRowsPerPage)
      }
  
      // --- Schedule Table (tiếng Việt, font chuẩn) ---
      pdf.addPage()
      pdf.setFont("NotoSans", "bold"); pdf.setFontSize(13); pdf.setTextColor(20)
      pdf.text("Bảng lịch công việc (Schedule)", margin.l, margin.t)
  
      const scheduleRows = buildScheduleRows()
      autoTable(pdf, {
        startY: margin.t + 12,
        head: [[ "Tên công việc", "Bắt đầu", "Kết thúc", "Số ngày", "Trạng thái", "Tiến độ (%)" ]],
        body: scheduleRows.map((r: any) => [
          r["Tên công việc"] ?? "",
          r["Bắt đầu"] ?? "",
          r["Kết thúc"] ?? "",
          r["Số ngày"] ?? "",
          r["Trạng thái"] ?? "",
          r["Tiến độ (%)"] ?? "",
        ]),
        styles: { font: "NotoSans", fontStyle: "normal", fontSize: 9, cellPadding: 4, valign: "middle" },
        headStyles: { font: "NotoSans", fontStyle: "bold", fillColor: [33, 150, 243], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 249, 251] },
        margin: { left: margin.l, right: margin.r },
        columnStyles: { 0: { cellWidth: 260 } },
        didParseCell: (data) => {
          // căn giữa số/tiến độ
          if (data.section === "body" && (data.column.index === 3 || data.column.index === 5)) {
            data.cell.styles.halign = "center"
          }
        }
      })
  
      // --- Issues Table (nếu có) ---
      if (Object.keys(taskAnalysis).length) {
        pdf.addPage()
        pdf.setFont("NotoSans", "bold"); pdf.setFontSize(13); pdf.setTextColor(20)
        pdf.text("Phân tích vấn đề (Issues)", margin.l, margin.t)
  
        const issuesData = Object.values(taskAnalysis).map((a: any) => ({
          task: a.taskName,
          sev: a.severity,
          impact: a.impact?.impactDescription || "",
          topIssues: a.issues?.slice(0, 2).map((i: any) => i.title).join("; "),
          next: a.nextActions?.slice(0, 2).map((n: any) => `${n.action} (${n.priority})`).join("; "),
        }))
  
        autoTable(pdf, {
          startY: margin.t + 12,
          head: [[ "Công việc", "Mức độ", "Ảnh hưởng", "Vấn đề chính", "Hành động tiếp theo" ]],
          body: issuesData.map((x) => [x.task, x.sev, x.impact, x.topIssues, x.next]),
          styles: { font: "NotoSans", fontStyle: "normal", fontSize: 9, cellPadding: 4, valign: "top" },
          headStyles: { font: "NotoSans", fontStyle: "bold", fillColor: [244, 114, 182], textColor: 255 },
          alternateRowStyles: { fillColor: [252, 252, 252] },
          margin: { left: margin.l, right: margin.r },
          columnStyles: {
            0: { cellWidth: 220 },
            1: { cellWidth: 70, halign: "center" },
            2: { cellWidth: 240 },
            3: { cellWidth: 190 },
            4: { cellWidth: 220 },
          },
        })
      }
  
      // --- Footer page number ---
      const pageCount = pdf.getNumberOfPages()
      pdf.setFont("NotoSans", "normal"); pdf.setFontSize(9); pdf.setTextColor(120)
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i)
        pdf.text(`Trang ${i}/${pageCount}`, pageW - margin.r, pageH - 14, { align: "right" })
      }
  
      pdf.save(`Gantt_Report_${prjName}.pdf`)
      toast.success("Đã xuất PDF (TV & Gantt rõ ràng)")
    } catch (err) {
      console.error("Export PDF error:", err)
      toast.error("Xuất PDF thất bại")
    }
  }
  
  
  const handleExportExcel = () => {
    try {
      const rows = buildScheduleRows()
      const wb = XLSX.utils.book_new()
      const ws1 = XLSX.utils.json_to_sheet(rows)
      const colWidths = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 14) }))
      ;(ws1 as any)["!cols"] = colWidths
      XLSX.utils.book_append_sheet(wb, ws1, "Schedule")

      const issuesRows = Object.values(taskAnalysis).map((a:any)=>({
        "Task": a.taskName,
        "Severity": a.severity,
        "Impact": a.impact.impactDescription,
        "Issues": a.issues.map((i:any)=>i.title).join("; "),
        "Next actions": a.nextActions?.slice(0,3).map((n:any)=>`${n.action} (${n.priority})`).join("; ")
      }))
      const ws2 = XLSX.utils.json_to_sheet(issuesRows)
      ;(ws2 as any)["!cols"] = [ {wch:40},{wch:12},{wch:40},{wch:50},{wch:40} ]
      XLSX.utils.book_append_sheet(wb, ws2, "Issues")

      XLSX.writeFile(wb, `Gantt_Report_${projectData?.project?.name || projectId}.xlsx`)
      toast.success("Đã xuất Excel")
    } catch (err) {
      console.error("Export Excel error:", err)
      toast.error("Xuất Excel thất bại")
    }
  }

  // Initialize DHTMLX Gantt
  useEffect(() => {
    if (!ganttContainerRef.current || !projectData?.tasks) return

    const initGantt = async () => {
      try {
        const { gantt } = await import("dhtmlx-gantt")
        
        // Clear previous instance
        gantt.clearAll()
        
        // Configure Gantt
        gantt.config.date_format = "%Y-%m-%d"
        gantt.config.scale_unit = viewMode === "day" ? "day" : viewMode === "week" ? "week" : "month"
        gantt.config.date_scale = viewMode === "day" ? "%d %M" : viewMode === "week" ? "Tuần %W" : "%F %Y"
        gantt.config.subscales = viewMode === "day" ? [{ unit: "hour", step: 6, date: "%H:00" }] : []
        
        // Configure spacing and margins
        gantt.config.row_height = 50
        gantt.config.min_column_width = viewMode === "week" ? 150 : 80
        gantt.config.scale_height = 70
        
        // Configure task spacing
        gantt.config.task_height = 25
        gantt.config.link_line_width = 2
        gantt.config.link_arrow_size = 6
        
        // Add custom CSS classes for better spacing
        gantt.templates.scale_cell_class = function(date: any) {
          if (viewMode === "week") {
            return "gantt_scale_week"
          } else if (viewMode === "day") {
            return "gantt_scale_day"
          } else {
            return "gantt_scale_month"
          }
        }
        
        // Custom scale text template for week view
        gantt.templates.date_scale = function(date: any) {
          if (viewMode === "week") {
            const weekStart = new Date(date)
            const weekEnd = new Date(date)
            weekEnd.setDate(weekStart.getDate() + 6)
            
            const startDay = weekStart.getDate()
            const startMonth = weekStart.getMonth() + 1
            const endDay = weekEnd.getDate()
            const endMonth = weekEnd.getMonth() + 1
            
            return `Tuần ${startDay}/${startMonth}-${endDay}/${endMonth}`
          } else if (viewMode === "day") {
            return date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })
          } else {
            return date.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
          }
        }
        
        // Set up columns
        gantt.config.columns = [
          { name: "text", label: "Task name", width: 200, tree: true },
          { name: "start_date", label: "Start", width: 80, align: "center" },
          { name: "duration", label: "Duration", width: 60, align: "center" },
          { name: "progress", label: "Progress", width: 60, align: "center", template: (obj: any) => Math.round(obj.progress * 100) + "%" }
        ]

        // Convert tasks to DHTMLX format
        const sortedTasks = getDisplayTasks().sort((a: Task, b: Task) => (a.level || 0) - (b.level || 0))
        console.log(`Gantt: Total tasks: ${projectData.tasks.length}, Display tasks: ${sortedTasks.length}, Show without deps: ${showTasksWithoutDependencies}`)
        
        // Analyze task issues and dependencies
        const analysis = analyzeTaskIssues(sortedTasks, projectData.dependencies || [])
        setTaskAnalysis(analysis)
        
        const tasks = sortedTasks.map((task: Task) => ({
          id: task.id,
          text: task.name,
          start_date: task.calculated_start_date ? new Date(task.calculated_start_date) : new Date(),
          duration: task.duration_days || 1,
          progress: task.progress / 100,
          open: true,
          color: task.is_critical_path ? "#ef4444" : task.is_overdue ? "#f59e0b" : task.status === "done" ? "#10b981" : "#3b82f6",
          analysis: taskAnalysis[task.id] || null
        }))

        // Convert dependencies to DHTMLX format
        const links = (projectData.dependencies || []).map((dep: any, index: number) => ({
          id: index + 1,
          source: dep.depends_on_id,
          target: dep.task_id,
          type: "0" // finish-to-start
        }))

        // Initialize Gantt
        if (ganttContainerRef.current) {
          gantt.init(ganttContainerRef.current)
          gantt.parse({ data: tasks, links })
        }

      } catch (error) {
        console.error("Error initializing Gantt:", error)
        toast.error("Lỗi khi khởi tạo Gantt chart")
      }
    }

    initGantt()

    // Cleanup
    return () => {
      if (ganttContainerRef.current) {
        const { gantt } = require("dhtmlx-gantt")
        gantt.clearAll()
      }
    }
  }, [projectData, viewMode, showTasksWithoutDependencies])

  useEffect(() => {
    if (!projectId) return

    async function fetchProjectDataAndOptimize() {
      try {
        setIsLoading(true)

        const response = await fetch(`/api/projects/${projectId}/gantt`)
        if (!response.ok) {
          throw new Error(`Không thể tải dữ liệu dự án: ${response.status}`)
        }

        const data = await response.json()

        if (data.tasks && data.tasks.length > 0 && data.project?.start_date) {
          const projectStartDate = new Date(data.project.start_date)
          const tasksWithDates = calculateTaskDates(data.tasks, data.dependencies || [], projectStartDate)

          data.tasks = tasksWithDates

          const latestEndDate = new Date(
            Math.max(...tasksWithDates.map((t) => new Date(t.calculated_end_date || 0).getTime())),
          )
          data.project.end_date = latestEndDate.toISOString()
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
    window.location.reload()
  }

  const handleExport = () => {
    toast.success("Tính năng xuất file sẽ được phát triển!")
  }

  const analyzeTaskIssues = (tasks: Task[], dependencies: any[]) => {
    const analysis: Record<string, any> = {}
    const dependencyMap = new Map<string, string[]>()
    const reverseDependencyMap = new Map<string, string[]>()
    
    // Build dependency maps
    dependencies.forEach((dep: any) => {
      if (!dependencyMap.has(dep.task_id)) {
        dependencyMap.set(dep.task_id, [])
      }
      dependencyMap.get(dep.task_id)!.push(dep.depends_on_id)
      
      if (!reverseDependencyMap.has(dep.depends_on_id)) {
        reverseDependencyMap.set(dep.depends_on_id, [])
      }
      reverseDependencyMap.get(dep.depends_on_id)!.push(dep.task_id)
    })
    
    tasks.forEach((task) => {
      const issues: any[] = []
      
      // Check if task is overdue
      if (task.is_overdue) {
        const overdueAnalysis = analyzeOverdueTask(task, tasks, dependencies)
        issues.push(overdueAnalysis)
      }
      
      // Check if task is on critical path
      if (task.is_critical_path) {
        const criticalAnalysis = analyzeCriticalTask(task, tasks, dependencies)
        issues.push(criticalAnalysis)
      }
      
      // Check dependency issues
      const dependencyIssues = analyzeDependencyIssues(task, tasks, dependencyMap, reverseDependencyMap)
      issues.push(...dependencyIssues)
      
      // Only add to analysis if there are real issues
      if (issues.length > 0) {
        const realIssues = issues.filter(issue => issue.hasRealProblem)
        if (realIssues.length > 0) {
          analysis[task.id] = {
            taskId: task.id,
            taskName: task.name,
            issues: realIssues,
            severity: calculateSeverity(realIssues),
            impact: calculateDetailedImpact(task, reverseDependencyMap, tasks),
            currentStatus: getTaskCurrentStatus(task),
            nextActions: generateNextActions(task, realIssues, tasks, dependencies)
          }
        }
      }
    })
    
    return analysis
  }
  
  const analyzeOverdueTask = (task: Task, allTasks: Task[], dependencies: any[]) => {
    const today = new Date()
    const endDate = task.calculated_end_date ? new Date(task.calculated_end_date) : new Date()
    const daysOverdue = Math.ceil((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24))
    
    // Only consider it a real problem if overdue by more than 1 day
    const hasRealProblem = daysOverdue > 1
    
    return {
      type: 'overdue',
      severity: daysOverdue > 7 ? 'critical' : daysOverdue > 3 ? 'high' : 'medium',
      title: `Task bị trễ ${daysOverdue} ngày`,
      description: `Dự kiến hoàn thành: ${endDate.toLocaleDateString('vi-VN')} | Thực tế: ${today.toLocaleDateString('vi-VN')}`,
      rootCause: determineOverdueRootCause(task, allTasks, dependencies),
      affectedTasks: findAffectedTasks(task.id, dependencies),
      recommendations: generateOverdueRecommendations(task, daysOverdue),
      hasRealProblem,
      daysOverdue
    }
  }
  
  const analyzeCriticalTask = (task: Task, allTasks: Task[], dependencies: any[]) => {
    return {
      type: 'critical',
      severity: 'critical',
      title: 'Task thuộc Critical Path',
      description: 'Task này nằm trên đường găng - bất kỳ sự chậm trễ nào sẽ ảnh hưởng đến toàn bộ dự án',
      rootCause: 'Task có thời gian dài nhất trong chuỗi dependency',
      affectedTasks: findAffectedTasks(task.id, dependencies),
      recommendations: [
        'Ưu tiên cao nhất cho task này',
        'Tăng cường tài nguyên nếu cần thiết',
        'Theo dõi tiến độ hàng ngày',
        'Có kế hoạch dự phòng'
      ]
    }
  }
  
  const analyzeDependencyIssues = (task: Task, allTasks: Task[], dependencyMap: Map<string, string[]>, reverseDependencyMap: Map<string, string[]>) => {
    const issues: any[] = []
    const taskDependencies = dependencyMap.get(task.id) || []
    
    taskDependencies.forEach((depId) => {
      const depTask = allTasks.find(t => t.id === depId)
      if (depTask && (depTask.is_overdue || depTask.status !== 'done')) {
        issues.push({
          type: 'dependency',
          severity: depTask.is_overdue ? 'high' : 'medium',
          title: `Phụ thuộc vào task bị trễ: ${depTask.name}`,
          description: `Task này không thể bắt đầu vì task phụ thuộc chưa hoàn thành`,
          rootCause: `Task "${depTask.name}" ${depTask.is_overdue ? 'bị trễ hạn' : 'chưa hoàn thành'}`,
          affectedTasks: [task.id],
          recommendations: [
            'Đẩy nhanh tiến độ task phụ thuộc',
            'Xem xét thay đổi thứ tự thực hiện nếu có thể',
            'Phân bổ thêm tài nguyên cho task phụ thuộc'
          ]
        })
      }
    })
    
    return issues
  }
  
  const determineOverdueRootCause = (task: Task, allTasks: Task[], dependencies: any[]) => {
    const taskDependencies = dependencies.filter((dep: any) => dep.task_id === task.id)
    
    if (taskDependencies.length > 0) {
      const delayedDeps = taskDependencies.filter((dep: any) => {
        const depTask = allTasks.find(t => t.id === dep.depends_on_id)
        return depTask && depTask.is_overdue
      })
      
      if (delayedDeps.length > 0) {
        const depTask = allTasks.find(t => t.id === delayedDeps[0].depends_on_id)
        return `Task phụ thuộc "${depTask?.name}" bị trễ, kéo theo task này trễ`
      }
    }
    
    return 'Thời gian ước tính ban đầu không chính xác hoặc thiếu tài nguyên'
  }
  
  const findAffectedTasks = (taskId: string, dependencies: any[]) => {
    const affected: string[] = []
    const queue = [taskId]
    const visited = new Set<string>()
    
    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)
      
      const dependentTasks = dependencies.filter((dep: any) => dep.depends_on_id === current)
      dependentTasks.forEach((dep: any) => {
        affected.push(dep.task_id)
        queue.push(dep.task_id)
      })
    }
    
    return affected
  }
  
  const generateOverdueRecommendations = (task: Task, daysOverdue: number) => {
    const recommendations = []
    
    if (daysOverdue > 7) {
      recommendations.push('Cần can thiệp khẩn cấp - task đã trễ quá 1 tuần')
    }
    
    recommendations.push('Tăng cường tài nguyên cho task này')
    recommendations.push('Làm việc thêm giờ nếu cần thiết')
    recommendations.push('Xem xét chia nhỏ task thành các phần nhỏ hơn')
    
    return recommendations
  }
  
  const calculateSeverity = (issues: any[]) => {
    if (issues.some(issue => issue.severity === 'critical')) return 'critical'
    if (issues.some(issue => issue.severity === 'high')) return 'high'
    if (issues.some(issue => issue.severity === 'medium')) return 'medium'
    return 'low'
  }
  
  const calculateDetailedImpact = (task: Task, reverseDependencyMap: Map<string, string[]>, allTasks: Task[]) => {
    const affectedTaskIds = reverseDependencyMap.get(task.id) || []
    const affectedTasks = affectedTaskIds.map(id => allTasks.find(t => t.id === id)).filter(Boolean)
    
    const criticalAffected = affectedTasks.filter(t => t?.is_critical_path).length
    const overdueAffected = affectedTasks.filter(t => t?.is_overdue).length
    
    return {
      directImpact: affectedTaskIds.length,
      totalImpact: affectedTaskIds.length + 1,
      affectedTaskIds,
      criticalAffected,
      overdueAffected,
      impactDescription: generateImpactDescription(affectedTaskIds.length, criticalAffected, overdueAffected)
    }
  }
  
  const generateImpactDescription = (totalAffected: number, criticalAffected: number, overdueAffected: number) => {
    if (criticalAffected > 0) {
      return `Ảnh hưởng đến ${criticalAffected} task Critical Path - có thể làm trễ toàn bộ dự án`
    }
    if (overdueAffected > 0) {
      return `Làm trễ thêm ${overdueAffected} task đã bị trễ`
    }
    if (totalAffected > 0) {
      return `Có thể làm trễ ${totalAffected} task khác`
    }
    return 'Không ảnh hưởng đến task khác'
  }
  
  const getTaskCurrentStatus = (task: Task) => {
    const today = new Date()
    const startDate = task.calculated_start_date ? new Date(task.calculated_start_date) : new Date()
    const endDate = task.calculated_end_date ? new Date(task.calculated_end_date) : new Date()
    
    if (task.status === 'done') {
      return {
        status: 'completed',
        description: 'Task đã hoàn thành',
        color: 'green'
      }
    }
    
    if (task.is_overdue) {
      const daysOverdue = Math.ceil((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24))
      return {
        status: 'overdue',
        description: `Đã trễ ${daysOverdue} ngày`,
        color: 'red'
      }
    }
    
    if (today < startDate) {
      return {
        status: 'not_started',
        description: 'Chưa đến thời gian bắt đầu',
        color: 'gray'
      }
    }
    
    if (today >= startDate && today <= endDate) {
      const progress = task.progress || 0
      return {
        status: 'in_progress',
        description: `Đang thực hiện (${progress}%)`,
        color: 'blue'
      }
    }
    
    return {
      status: 'unknown',
      description: 'Trạng thái không xác định',
      color: 'gray'
    }
  }
  
  const generateNextActions = (task: Task, issues: any[], allTasks: Task[], dependencies: any[]) => {
    const actions = []
    
    // Check if task is blocked by dependencies
    const taskDependencies = dependencies.filter((dep: any) => dep.task_id === task.id)
    const blockingTasks = taskDependencies.map((dep: any) => {
      const depTask = allTasks.find(t => t.id === dep.depends_on_id)
      return depTask
    }).filter(t => t && t.status !== 'done')
    
    if (blockingTasks.length > 0) {
      actions.push({
        priority: 'high',
        action: 'Giải quyết task phụ thuộc',
        description: `Cần hoàn thành ${blockingTasks.length} task trước: ${blockingTasks.map(t => t?.name).join(', ')}`,
        deadline: 'Ngay lập tức'
      })
    }
    
    // Check if task is critical
    if (task.is_critical_path) {
      actions.push({
        priority: 'critical',
        action: 'Ưu tiên cao nhất',
        description: 'Task này thuộc Critical Path - bất kỳ sự chậm trễ nào sẽ ảnh hưởng toàn dự án',
        deadline: 'Hôm nay'
      })
    }
    
    // Check if task is overdue
    if (task.is_overdue) {
      const today = new Date()
      const endDate = task.calculated_end_date ? new Date(task.calculated_end_date) : new Date()
      const daysOverdue = Math.ceil((today.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24))
      
      actions.push({
        priority: 'high',
        action: 'Khẩn cấp hoàn thành',
        description: `Task đã trễ ${daysOverdue} ngày - cần tăng cường tài nguyên`,
        deadline: 'Trong 24h'
      })
    }
    
    // Add general actions based on task status
    if (task.status === 'in_progress') {
      actions.push({
        priority: 'medium',
        action: 'Theo dõi tiến độ hàng ngày',
        description: 'Cập nhật progress và báo cáo vấn đề nếu có',
        deadline: 'Hàng ngày'
      })
    }
    
    return actions
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

      {/* Task Analysis Panel */}
      {Object.keys(taskAnalysis).length > 0 && (
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Phân tích Task có vấn đề
              <Badge variant="destructive" className="ml-2">
                {Object.keys(taskAnalysis).length} task
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.values(taskAnalysis).map((analysis: any) => (
                <div key={analysis.taskId} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        analysis.severity === 'critical' ? 'bg-red-500' :
                        analysis.severity === 'high' ? 'bg-orange-500' :
                        analysis.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}></div>
                      <h4 className="font-semibold text-gray-900">{analysis.taskName}</h4>
                      <Badge variant={
                        analysis.severity === 'critical' ? 'destructive' :
                        analysis.severity === 'high' ? 'secondary' :
                        'outline'
                      }>
                        {analysis.severity === 'critical' ? 'Nghiêm trọng' :
                         analysis.severity === 'high' ? 'Cao' :
                         analysis.severity === 'medium' ? 'Trung bình' : 'Thấp'}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTaskForAnalysis(
                        selectedTaskForAnalysis === analysis.taskId ? null : analysis.taskId
                      )}
                    >
                      {selectedTaskForAnalysis === analysis.taskId ? 'Thu gọn' : 'Chi tiết'}
                    </Button>
                  </div>

                  {/* Current Status */}
                  <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-3 h-3 rounded-full bg-${analysis.currentStatus.color}-500`}></div>
                      <span className="font-medium text-gray-900">Trạng thái hiện tại:</span>
                      <span className="text-sm text-gray-600">{analysis.currentStatus.description}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {analysis.impact.impactDescription}
                    </div>
                  </div>

                  {/* Next Actions */}
                  <div className="mb-3">
                    <h5 className="font-medium text-gray-900 mb-2">Hành động cần thực hiện:</h5>
                    <div className="space-y-2">
                      {analysis.nextActions.slice(0, 2).map((action: any, index: number) => (
                        <div key={index} className={`p-2 rounded border-l-4 ${
                          action.priority === 'critical' ? 'border-red-500 bg-red-50' :
                          action.priority === 'high' ? 'border-orange-500 bg-orange-50' :
                          'border-blue-500 bg-blue-50'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{action.action}</span>
                            <Badge variant={
                              action.priority === 'critical' ? 'destructive' :
                              action.priority === 'high' ? 'secondary' : 'outline'
                            } className="text-xs">
                              {action.deadline}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600">{action.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Detailed Analysis */}
                  {selectedTaskForAnalysis === analysis.taskId && (
                    <div className="space-y-4 mt-4 pt-4 border-t">
                      {/* Blocking Tasks */}
                      {analysis.nextActions.some((action: any) => action.action === 'Giải quyết task phụ thuộc') && (
                        <div className="bg-red-50 rounded-lg p-4 border-l-4 border-red-500">
                          <h5 className="font-medium text-red-900 mb-2">Task đang bị chặn bởi:</h5>
                          <div className="space-y-2">
                            {analysis.nextActions
                              .filter((action: any) => action.action === 'Giải quyết task phụ thuộc')
                              .map((action: any, index: number) => (
                                <div key={index} className="bg-white p-2 rounded border">
                                  <p className="text-sm text-red-700">{action.description}</p>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* All Issues */}
                      {analysis.issues.map((issue: any, index: number) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-2 h-2 rounded-full ${
                              issue.severity === 'critical' ? 'bg-red-500' :
                              issue.severity === 'high' ? 'bg-orange-500' :
                              'bg-yellow-500'
                            }`}></div>
                            <h5 className="font-medium text-gray-900">{issue.title}</h5>
                          </div>
                          
                          <p className="text-sm text-gray-600 mb-3">{issue.description}</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h6 className="font-medium text-gray-800 mb-2">Nguyên nhân:</h6>
                              <p className="text-sm text-gray-600 bg-white p-2 rounded border">
                                {issue.rootCause}
                              </p>
                            </div>
                            
                            <div>
                              <h6 className="font-medium text-gray-800 mb-2">Giải pháp:</h6>
                              <ul className="text-sm text-gray-600 space-y-1">
                                {issue.recommendations.slice(0, 3).map((rec: string, recIndex: number) => (
                                  <li key={recIndex} className="flex items-start gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                                    <span>{rec}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* All Actions */}
                      <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
                        <h5 className="font-medium text-blue-900 mb-3">Tất cả hành động cần thực hiện:</h5>
                        <div className="space-y-2">
                          {analysis.nextActions.map((action: any, index: number) => (
                            <div key={index} className={`p-3 rounded border ${
                              action.priority === 'critical' ? 'border-red-300 bg-red-100' :
                              action.priority === 'high' ? 'border-orange-300 bg-orange-100' :
                              'border-blue-300 bg-blue-100'
                            }`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-sm">{action.action}</span>
                                <Badge variant={
                                  action.priority === 'critical' ? 'destructive' :
                                  action.priority === 'high' ? 'secondary' : 'outline'
                                } className="text-xs">
                                  {action.deadline}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-700">{action.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
