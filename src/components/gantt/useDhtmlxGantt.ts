import { useEffect } from "react"
import type { RefObject } from "react"
import { toast } from "sonner"
import { analyzeTaskIssues } from "./analysis"
import { Task, ViewModeType } from "./types"

export const useDhtmlxGantt = (
  containerRef: RefObject<HTMLDivElement>,
  projectData: any,
  viewMode: ViewModeType,
  showTasksWithoutDependencies: boolean,
  getDisplayTasks: () => Task[],
  setTaskAnalysis: (a: Record<string, any>) => void,
  taskAnalysis: Record<string, any>,
) => {
  useEffect(() => {
    if (!containerRef.current || !projectData?.tasks) return

    const init = async () => {
      try {
        const { gantt } = await import("dhtmlx-gantt")
        gantt.clearAll()
        gantt.config.date_format = "%Y-%m-%d"
        gantt.config.scale_unit = viewMode === "day" ? "day" : viewMode === "week" ? "week" : "month"
        gantt.config.date_scale = viewMode === "day" ? "%d %M" : viewMode === "week" ? "Tuần %W" : "%F %Y"
        gantt.config.subscales = viewMode === "day" ? [{ unit: "hour", step: 6, date: "%H:00" }] : []
        gantt.config.row_height = 50
        gantt.config.min_column_width = viewMode === "week" ? 150 : 80
        gantt.config.scale_height = 70
        gantt.config.task_height = 25
        gantt.config.link_line_width = 2
        gantt.config.link_arrow_size = 6
        gantt.config.duration_unit = "day"

        // Try to enable PRO critical path plugin if available (but still apply our own classes)
        try {
          if (typeof (gantt as any).plugins === "function") {
            ;(gantt as any).plugins({ critical_path: true })
          }
          if (typeof (gantt as any).isCriticalTask === "function") {
            gantt.config.highlight_critical_path = true
          }
        } catch {}

        gantt.templates.scale_cell_class = function () {
          if (viewMode === "week") return "gantt_scale_week"
          if (viewMode === "day") return "gantt_scale_day"
          return "gantt_scale_month"
        }

        gantt.templates.date_scale = function (date: any) {
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
            return date.toLocaleDateString("vi-VN", { day: "numeric", month: "short" })
          }
          return date.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })
        }

        // Highlight critical path tasks and links (always apply our custom classes)
        gantt.templates.task_class = function (_start: any, _end: any, task: any) {
          const classes = []
          const inSet = (() => {
            try { return criticalSet?.has(String(task.id)) } catch { return false }
          })()
          const isCrit = !!(task.isCritical || task.is_critical_path || (task as any)._critical || inSet)
          if (isCrit) classes.push("gantt-task-critical")
          return classes.join(" ")
        }
        
        gantt.templates.link_class = function (link: any) {
          try {
            const s = gantt.getTask(link.source)
            const t = gantt.getTask(link.target)
            const sCrit = s?.isCritical || s?.is_critical_path
            const tCrit = t?.isCritical || t?.is_critical_path
            if (sCrit && tCrit) return "gantt-link-critical"
          } catch {}
          return ""
        }

        gantt.config.columns = [
          { name: "text", label: "Task name", width: 200, tree: true },
          { name: "start_date", label: "Start", width: 80, align: "center" },
          { name: "duration", label: "Duration", width: 60, align: "center" },
          { name: "progress", label: "Progress", width: 60, align: "center", template: (obj: any) => Math.round(obj.progress * 100) + "%" },
        ]

        const sortedTasks = getDisplayTasks().sort((a: Task, b: Task) => (a.level || 0) - (b.level || 0))
        const analysis = analyzeTaskIssues(sortedTasks, projectData.dependencies || [])
        setTaskAnalysis(analysis)
        const criticalPathIds = (projectData?.cpm_details?.criticalPath || []).map((x: any) => String(x))
        const criticalDetailIds = (projectData?.cpm_details?.taskDetails || [])
          .filter((td: any) => td?.isCritical)
          .map((td: any) => String(td.taskId))
        const criticalSet = new Set<string>([...criticalPathIds, ...criticalDetailIds])
        const tasks = sortedTasks.map((task: Task) => ({
          id: String(task.id),
          text: task.name,
          // Use string date matching gantt.config.date_format ("%Y-%m-%d")
          start_date: task.calculated_start_date
            ? new Date(task.calculated_start_date).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
          duration: task.duration_days || 1,
          progress: (task.progress ?? 0) / 100,
          open: true,
          // Keep both flags to be robust across API/FE naming
          is_critical_path: !!(task as any).is_critical_path || criticalSet.has(String(task.id)),
          isCritical: !!(task as any).is_critical_path || criticalSet.has(String(task.id)),
          analysis: taskAnalysis[task.id] || null,
        }))
        const links = (projectData.dependencies || []).map((dep: any, index: number) => ({
          id: String(index + 1),
          source: String(dep.depends_on_id),
          target: String(dep.task_id),
          type: "0",
          ...(typeof dep.lag === "number" ? { lag: dep.lag } : {}),
        }))
        // Force critical path styling through multiple approaches
        gantt.attachEvent("onTaskLoading", (t: any) => {
          try {
            const isCrit = !!(t.is_critical_path || t.isCritical || (t as any)._critical || criticalSet.has(String(t.id)))
            if (isCrit) {
              // Apply class directly to task object
              t.$class = (t.$class ? t.$class + " " : "") + "gantt-task-critical"
              // Also set a custom property for template access
              t._critical = true
            }
            // eslint-disable-next-line no-console
            console.log("[load]", t.id, "critical:", isCrit, "class:", t.$class)
          } catch {}
          return true
        })

        // Ensure class assignment on creation
        gantt.attachEvent("onTaskCreated", (t: any) => {
          try {
            const isCrit = !!(t.is_critical_path || t.isCritical || (t as any)._critical || criticalSet.has(String(t.id)))
            if (isCrit) {
              t.$class = (t.$class ? t.$class + " " : "") + "gantt-task-critical"
              t._critical = true
            }
            // eslint-disable-next-line no-console
            console.log("[created]", t.id, "critical:", isCrit, "class:", t.$class)
          } catch {}
          return true
        })

        // Ensure class right before display
        gantt.attachEvent("onBeforeTaskDisplay", (id: any, t: any) => {
          try {
            const isCrit = !!(t.is_critical_path || t.isCritical || (t as any)._critical || criticalSet.has(String(id)))
            if (isCrit && (!t.$class || !String(t.$class).includes("gantt-task-critical"))) {
              t.$class = (t.$class ? t.$class + " " : "") + "gantt-task-critical"
            }
            // eslint-disable-next-line no-console
            console.log("[before-display]", id, "critical:", isCrit, "class:", t.$class)
          } catch {}
          return true
        })
        
        gantt.attachEvent("onAfterTaskAdd", (id: any, t: any) => {
          try {
            const isCrit = !!(t.is_critical_path || t.isCritical)
            // eslint-disable-next-line no-console
            console.log("[added]", id, "critical:", isCrit)
            
            // Force re-render of this specific task
            if (isCrit) {
              setTimeout(() => {
                try {
                  gantt.refreshTask(id)
                } catch {}
              }, 100)
            }
          } catch {}
        })
        
        // Additional event to ensure styling is applied after rendering
        gantt.attachEvent("onAfterTaskDrag", (id: any, task: any) => {
          try {
            const isCrit = !!(task.is_critical_path || task.isCritical || task._critical)
            if (isCrit) {
              // Find the DOM element and apply class directly
              const taskElement = gantt.$task_data.querySelector(`[task_id="${id}"]`)
              if (taskElement && !taskElement.classList.contains("gantt-task-critical")) {
                taskElement.classList.add("gantt-task-critical")
                // eslint-disable-next-line no-console
                console.log("[DOM] Applied critical class to task", id)
              }
            }
          } catch {}
        })
        
        // Use onGanttRender event to apply styling after full render
        gantt.attachEvent("onGanttRender", () => {
          try {
            // Apply critical styling to all critical tasks after render
            gantt.eachTask((task: any) => {
              const isCrit = !!(task.is_critical_path || task.isCritical || task._critical)
              if (isCrit) {
                const taskElement = gantt.$task_data.querySelector(`[task_id="${task.id}"]`) ||
                  gantt.$task_data.querySelector(`.gantt_task_line[task_id="${task.id}"]`) ||
                  gantt.$task_data.querySelector(`[data-task-id="${task.id}"]`)
                if (taskElement && !taskElement.classList.contains("gantt-task-critical")) {
                  taskElement.classList.add("gantt-task-critical")
                  // eslint-disable-next-line no-console
                  console.log("[Render] Applied critical class to task", task.id)
                }
              }
            })
          } catch {}
        })
        if (containerRef.current) {
          gantt.init(containerRef.current)
          gantt.parse({ data: tasks, links })
          
          // Force refresh and re-render to ensure styling is applied
          setTimeout(() => {
            try {
              gantt.refreshData()
              gantt.render()
              
              // Manual DOM manipulation as fallback
              tasks.forEach((task: any) => {
                if (task.isCritical || task.is_critical_path) {
                  const taskElement = containerRef.current?.querySelector(`[task_id="${task.id}"]`)
                  if (taskElement && !taskElement.classList.contains("gantt-task-critical")) {
                    taskElement.classList.add("gantt-task-critical")
                    // eslint-disable-next-line no-console
                    console.log("[Manual] Applied critical class to task", task.id)
                  }
                }
              })

              // Apply classes in bulk based on criticalSet
              if (containerRef.current) {
                const bars = containerRef.current.querySelectorAll('.gantt_task_line[task_id]')
                bars.forEach((el: Element) => {
                  const id = el.getAttribute('task_id') || ''
                  if (criticalSet.has(String(id))) {
                    if (!el.classList.contains('gantt-task-critical')) {
                      el.classList.add('gantt-task-critical')
                      // eslint-disable-next-line no-console
                      console.log('[Bulk] Applied critical class to task', id)
                    }
                  }
                })
              }
              
              // Debug: verify final state
              gantt.eachTask((t: any) => {
                const isCrit = !!(t.is_critical_path || t.isCritical)
                // eslint-disable-next-line no-console
                console.log("[final]", t.id, "critical:", isCrit, "class:", t.$class)
              })
            } catch (e) {
              console.error("Error in post-render styling:", e)
            }
          }, 200)

          // Expose debug helpers
          try {
            ;(window as any).__ganttDebug = {
              criticalSet: Array.from(criticalSet),
              has: (id: string) => criticalSet.has(String(id)),
              dump: (id: string) => {
                try {
                  const t = gantt.getTask(String(id))
                  return { id: String(id),
                    inSet: criticalSet.has(String(id)),
                    isCritical: t?.isCritical,
                    is_critical_path: t?.is_critical_path,
                    $class: t?.$class,
                  }
                } catch (e) { return { error: String(e) } }
              },
              force: (id: string) => {
                try {
                  const el = (containerRef.current as any)?.querySelector?.(`[task_id="${id}"]`) ||
                             (containerRef.current as any)?.querySelector?.(`.gantt_task_line[task_id="${id}"]`) ||
                             (containerRef.current as any)?.querySelector?.(`[data-task-id="${id}"]`)
                  if (el) { el.classList.add('gantt-task-critical'); return true }
                  return false
                } catch { return false }
              }
            }
          } catch {}
        }
      } catch (error) {
        console.error("Error initializing Gantt:", error)
        toast.error("Lỗi khi khởi tạo Gantt chart")
      }
    }

    init()

    return () => {
      if (containerRef.current) {
        const { gantt } = require("dhtmlx-gantt")
        gantt.clearAll()
      }
    }
  }, [containerRef, projectData, viewMode, showTasksWithoutDependencies])
}
