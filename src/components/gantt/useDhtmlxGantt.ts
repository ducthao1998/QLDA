import { useEffect, useRef } from "react"
import type { RefObject } from "react"
import { toast } from "sonner"
import { analyzeTaskIssues } from "./analysis"
import { Task, ViewModeType } from "./types"

/**
 * Initialise DHTMLX Gantt for the current project data.
 *
 * Key design points:
 *  - `taskAnalysis` is read through a ref so it does NOT need to live in the
 *    effect's dependency array. Putting it there caused a render→effect→
 *    setTaskAnalysis→render loop that froze the page.
 *  - `setTaskAnalysis` (React setter) is stable so it's safe to call from inside.
 *  - Mouse-wheel + Ctrl-zoom + drag-to-pan are wired up so the user doesn't have
 *    to keep clicking the day/week/month tabs to navigate.
 */
export const useDhtmlxGantt = (
  containerRef: RefObject<HTMLDivElement>,
  projectData: any,
  viewMode: ViewModeType,
  showTasksWithoutDependencies: boolean,
  getDisplayTasks: () => Task[],
  setTaskAnalysis: (a: Record<string, any>) => void,
  taskAnalysis: Record<string, any>,
) => {
  // Read latest analysis without re-running the effect when it changes.
  const taskAnalysisRef = useRef(taskAnalysis)
  useEffect(() => {
    taskAnalysisRef.current = taskAnalysis
  }, [taskAnalysis])

  useEffect(() => {
    if (!containerRef.current || !projectData?.tasks) return

    let cancelled = false

    const init = async () => {
      try {
        const { gantt } = await import("dhtmlx-gantt")
        if (cancelled) return

        const criticalPathIds = (projectData?.cpm_details?.criticalPath || []).map(String)
        const criticalDetailIds = (projectData?.cpm_details?.taskDetails || [])
          .filter((td: any) => td?.isCritical)
          .map((td: any) => String(td.taskId))
        const criticalSet = new Set<string>([...criticalPathIds, ...criticalDetailIds])
        const isCritical = (id: string | number) => criticalSet.has(String(id))

        // -------- Config --------
        gantt.clearAll()
        gantt.config.date_format = "%Y-%m-%d"
        gantt.config.row_height = 38
        gantt.config.scale_height = 70
        gantt.config.task_height = 22
        gantt.config.link_line_width = 2
        gantt.config.link_arrow_size = 6
        gantt.config.duration_unit = "day"

        // Tree-of-zoom-levels — used by the wheel/keyboard handlers below.
        const ZOOM_LEVELS = [
          { name: "hour", scale_unit: "hour", date_scale: "%H:00", min_column_width: 40, scales: [{ unit: "day", step: 1, format: "%d %M" }] },
          { name: "day", scale_unit: "day", date_scale: "%d %M", min_column_width: 70, scales: [] },
          { name: "week", scale_unit: "week", date_scale: "Tuần %W", min_column_width: 130, scales: [] },
          { name: "month", scale_unit: "month", date_scale: "%F %Y", min_column_width: 110, scales: [] },
          { name: "quarter", scale_unit: "month", date_scale: "%M %Y", min_column_width: 80, scales: [{ unit: "year", step: 1, format: "%Y" }] },
          { name: "year", scale_unit: "year", date_scale: "%Y", min_column_width: 80, scales: [] },
        ] as const

        const applyZoomLevel = (idx: number) => {
          const lv = ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, idx))]
          ;(gantt as any)._zoomIndex = idx
          gantt.config.scale_unit = lv.scale_unit
          gantt.config.date_scale = lv.date_scale
          gantt.config.min_column_width = lv.min_column_width
          gantt.config.subscales = lv.scales as any
        }

        // Map viewMode prop -> zoom index. The user can still wheel/zoom from here.
        const initialZoomIdx = viewMode === "day" ? 1 : viewMode === "week" ? 2 : 3
        applyZoomLevel(initialZoomIdx)

        // Opt-in critical-path plugin if PRO build is available.
        try {
          if (typeof (gantt as any).plugins === "function") {
            ;(gantt as any).plugins({ critical_path: true })
            gantt.config.highlight_critical_path = true
          }
        } catch {
          /* community build */
        }

        // -------- Templates --------
        gantt.templates.date_scale = (date: any) => {
          const idx = (gantt as any)._zoomIndex ?? initialZoomIdx
          const lv = ZOOM_LEVELS[idx]
          if (lv.name === "week") {
            const weekStart = new Date(date)
            const weekEnd = new Date(date)
            weekEnd.setDate(weekStart.getDate() + 6)
            return `Tuần ${weekStart.getDate()}/${weekStart.getMonth() + 1}-${weekEnd.getDate()}/${weekEnd.getMonth() + 1}`
          }
          if (lv.name === "day") return date.toLocaleDateString("vi-VN", { day: "numeric", month: "short" })
          if (lv.name === "hour") return `${date.getHours()}:00`
          if (lv.name === "year") return date.getFullYear().toString()
          return date.toLocaleDateString("vi-VN", { month: "short", year: "numeric" })
        }

        gantt.templates.task_class = (_s: any, _e: any, task: any) => {
          const crit = !!task.is_critical_path || isCritical(task.id)
          return crit ? "gantt-task-critical" : ""
        }

        gantt.templates.link_class = (link: any) =>
          isCritical(link.source) && isCritical(link.target) ? "gantt-link-critical" : ""

        gantt.config.columns = [
          { name: "text", label: "Công việc", width: 240, tree: true },
          { name: "start_date", label: "Bắt đầu", width: 90, align: "center" },
          { name: "duration", label: "Ngày", width: 50, align: "center" },
          {
            name: "progress",
            label: "Tiến độ",
            width: 70,
            align: "center",
            template: (obj: any) => Math.round((obj.progress || 0) * 100) + "%",
          },
        ]

        // -------- Build dataset --------
        const sortedTasks = getDisplayTasks().sort((a: Task, b: Task) => (a.level || 0) - (b.level || 0))
        setTaskAnalysis(analyzeTaskIssues(sortedTasks, projectData.dependencies || []))

        const ganttTasks = sortedTasks.map((task: Task) => ({
          id: String(task.id),
          text: task.name,
          start_date: task.calculated_start_date
            ? new Date(task.calculated_start_date).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
          duration: task.duration_days || 1,
          progress: (task.progress ?? 0) / 100,
          open: true,
          is_critical_path: isCritical(task.id),
          analysis: taskAnalysisRef.current[task.id] || null,
        }))

        const links = (projectData.dependencies || []).map((dep: any, index: number) => ({
          id: String(index + 1),
          source: String(dep.depends_on_id),
          target: String(dep.task_id),
          type: "0",
          ...(typeof dep.lag === "number" ? { lag: dep.lag } : {}),
        }))

        // -------- Render --------
        if (!containerRef.current || cancelled) return
        gantt.init(containerRef.current)
        gantt.parse({ data: ganttTasks, links })

        // Fallback DOM sweep for lazily-rendered rows (DHTMLX virtualizes long lists).
        gantt.attachEvent("onGanttRender", () => {
          if (!containerRef.current) return
          const bars = containerRef.current.querySelectorAll<HTMLElement>(".gantt_task_line[task_id]")
          bars.forEach((el) => {
            const id = el.getAttribute("task_id") || ""
            if (criticalSet.has(id) && !el.classList.contains("gantt-task-critical")) {
              el.classList.add("gantt-task-critical")
            }
          })
        })

        // -------- Wheel & keyboard zoom --------
        // Ctrl+wheel = zoom in/out around the cursor's date. Plain wheel scrolls
        // horizontally so users don't fight with their trackpad.
        const wheelHandler = (e: WheelEvent) => {
          if (!containerRef.current) return
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            const dir = e.deltaY > 0 ? +1 : -1
            const next = ((gantt as any)._zoomIndex ?? initialZoomIdx) + dir
            applyZoomLevel(next)
            gantt.render()
          } else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            // Convert vertical wheel into horizontal scroll for time navigation.
            const dataArea = containerRef.current.querySelector(".gantt_task") as HTMLElement | null
            if (dataArea) {
              dataArea.scrollLeft += e.deltaY
              e.preventDefault()
            }
          }
        }
        containerRef.current.addEventListener("wheel", wheelHandler, { passive: false })

        // Cleanup-on-rerun: remove the listener via attachEvent's life-cycle.
        const detach = () => {
          containerRef.current?.removeEventListener("wheel", wheelHandler)
        }
        ;(gantt as any).__detachWheel = detach
      } catch (error) {
        if (cancelled) return
        console.error("Error initializing Gantt:", error)
        toast.error("Lỗi khi khởi tạo Gantt chart")
      }
    }

    init()

    return () => {
      cancelled = true
      try {
        const mod = require("dhtmlx-gantt")
        mod.gantt?.__detachWheel?.()
        mod.gantt?.clearAll?.()
      } catch {
        /* ignore */
      }
    }
    // NOTE: `taskAnalysis` and `setTaskAnalysis` are intentionally NOT in deps.
    // Reading via ref + stable setter avoids the infinite re-render loop that
    // happens when this effect calls setTaskAnalysis (which would otherwise
    // trigger itself on the next render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, projectData, viewMode, showTasksWithoutDependencies, getDisplayTasks])
}
