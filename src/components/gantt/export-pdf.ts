import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Task } from "./types"
import { addDays, addMonths, clamp, daysBetween } from "./utils"

export interface ExportPdfParams {
  tasks: Task[]
  projectData: any
  projectId: string
  optimizationResult: any
  scheduleRows: any[]
  taskAnalysis: Record<string, any>
}

export const exportGanttToPdf = async ({
  tasks,
  projectData,
  projectId,
  optimizationResult,
  scheduleRows,
  taskAnalysis,
}: ExportPdfParams) => {
  const VN_FONT_REG = "/fonts/NotoSans-Regular.ttf"
  const VN_FONT_BOLD = "/fonts/NotoSans-Bold.ttf"

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = ""
    const bytes = new Uint8Array(buffer)
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    return btoa(binary)
  }

  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })

  const [bufReg, bufBold] = await Promise.all([fetch(VN_FONT_REG), fetch(VN_FONT_BOLD)]).then(
    async ([r1, r2]) => [await r1.arrayBuffer(), await r2.arrayBuffer()],
  )
  pdf.addFileToVFS("NotoSans-Regular.ttf", arrayBufferToBase64(bufReg))
  pdf.addFileToVFS("NotoSans-Bold.ttf", arrayBufferToBase64(bufBold))
  pdf.addFont("NotoSans-Regular.ttf", "NotoSans", "normal")
  pdf.addFont("NotoSans-Bold.ttf", "NotoSans", "bold")
  pdf.setFont("NotoSans", "normal")

  const projectStart: Date =
    (projectData?.project?.start_date && new Date(projectData.project.start_date)) ||
    new Date(Math.min(...tasks.map((t: any) => +new Date(t.calculated_start_date || Date.now()))))

  const projectEnd: Date =
    (projectData?.project?.end_date && new Date(projectData.project.end_date)) ||
    new Date(Math.max(...tasks.map((t: any) => +new Date(t.calculated_end_date || Date.now()))))

  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = { l: 40, t: 40, r: 40, b: 40 }

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

  const nameColW = 260
  const chartX = margin.l + nameColW
  const chartY = margin.t + 78
  const chartW = pageW - chartX - margin.r
  const axisH = 26
  const rowH = 20
  const totalDays = Math.max(1, daysBetween(projectStart, projectEnd) + 1)
  const pxPerDay = chartW / totalDays

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
        const label = cur.toLocaleDateString("vi-VN", { month: "short", year: "numeric" })
        ticks.push({ x, label })
        cur = addMonths(cur, 1)
      }
    } else {
      let cur = new Date(projectStart)
      cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7))
      while (cur <= projectEnd) {
        const x = chartX + daysBetween(projectStart, cur) * pxPerDay
        const label = `Tuần ${cur.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })}`
        ticks.push({ x, label })
        cur = addDays(cur, 7)
      }
    }
    const filtered: typeof ticks = []
    let lastRight = -Infinity
    const pad = 8
    ticks.forEach((t) => {
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
    pdf.setDrawColor(180); pdf.setLineWidth(0.8)
    pdf.line(chartX, yTop, chartX + chartW, yTop)
    pdf.setFont("NotoSans", "normal"); pdf.setFontSize(9); pdf.setTextColor(60)
    ticks.forEach((t) => {
      pdf.setDrawColor(220); pdf.setLineWidth(0.5)
      pdf.line(t.x, yTop, t.x, yTop + rowsThisPage * rowH + 2)
      pdf.text(t.label, t.x + 2, yTop - 6)
    })
    const step = gran === "week" ? 7 : 14
    pdf.setDrawColor(245); pdf.setLineWidth(0.2)
    for (let d = 0; d <= totalDays; d += step) {
      const x = chartX + d * pxPerDay
      pdf.line(x, yTop, x, yTop + rowsThisPage * rowH + 2)
    }
  }

  const maxRowsPerPage = Math.floor((pageH - chartY - margin.b - axisH) / rowH)
  const colorForTask = (t: any) => (t.is_critical_path ? [239, 68, 68] : t.is_overdue ? [245, 158, 11] : t.status === "done" ? [16, 185, 129] : [59, 130, 246])

  const drawMiniGanttPage = (slice: any[], pageIndex: number) => {
    if (pageIndex > 0) pdf.addPage()
    pdf.setFont("NotoSans", "bold"); pdf.setFontSize(12)
    pdf.text(pageIndex === 0 ? "Biểu đồ Gantt (tóm tắt)" : "Biểu đồ Gantt (tiếp)", margin.l, chartY - 24)
    pdf.setFont("NotoSans", "bold"); pdf.setFontSize(10); pdf.setTextColor(30)
    pdf.text("Tên công việc", margin.l, chartY - 8)
    drawAxisAndGrid(chartY, slice.length)
    slice.forEach((t, idx) => {
      const rowTop = chartY + idx * rowH + 4
      pdf.setFont("NotoSans", "normal"); pdf.setFontSize(9); pdf.setTextColor(60)
      const name = String(t.name || "")
      pdf.text(name, margin.l, rowTop + 11, { maxWidth: nameColW - 10 })
      const s = new Date(t.calculated_start_date || projectStart)
      const e = new Date(t.calculated_end_date || s)
      const startOff = clamp(daysBetween(projectStart, s), 0, totalDays)
      const endOff = clamp(daysBetween(projectStart, e), 0, totalDays)
      const x = chartX + startOff * pxPerDay
      const w = Math.max(2, (endOff - startOff + 1) * pxPerDay)
      const [r, g, b] = colorForTask(t)
      pdf.setFillColor(r, g, b); pdf.setDrawColor(255); pdf.setLineWidth(0.3)
      pdf.rect(x, rowTop, w, rowH - 8, "F")
      const prog = clamp(Number(t.progress ?? 0), 0, 100)
      if (prog > 0) {
        pdf.setFillColor(0, 0, 0)
        ;(pdf as any).setGState?.((pdf as any).GState({ opacity: 0.15 }))
        pdf.rect(x, rowTop, (w * prog) / 100, rowH - 8, "F")
        ;(pdf as any).setGState?.((pdf as any).GState({ opacity: 1 }))
      }
      pdf.setDrawColor(255); pdf.rect(x, rowTop, w, rowH - 8)
    })
    const legendY = chartY + slice.length * rowH + 14
    const legend = [
      { c: [59, 130, 246], t: "Đang thực hiện" },
      { c: [16, 185, 129], t: "Hoàn thành" },
      { c: [245, 158, 11], t: "Trễ hạn" },
      { c: [239, 68, 68], t: "Critical path" },
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

  pdf.addPage()
  pdf.setFont("NotoSans", "bold"); pdf.setFontSize(13); pdf.setTextColor(20)
  pdf.text("Bảng lịch công việc (Schedule)", margin.l, margin.t)
  autoTable(pdf, {
    startY: margin.t + 12,
    head: [["Tên công việc", "Bắt đầu", "Kết thúc", "Số ngày", "Trạng thái", "Tiến độ (%)"]],
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
      if (data.section === "body" && (data.column.index === 3 || data.column.index === 5)) {
        data.cell.styles.halign = "center"
      }
    },
  })

  if (Object.keys(taskAnalysis).length) {
    pdf.addPage()
    pdf.setFont("NotoSans", "bold"); pdf.setFontSize(13); pdf.setTextColor(20)
    pdf.text("Phân tích vấn đề (Issues)", margin.l, margin.t)
    const issuesData = Object.values(taskAnalysis).map((a: any) => ({
      task: (a as any).taskName,
      sev: (a as any).severity,
      impact: (a as any).impact?.impactDescription || "",
      topIssues: (a as any).issues?.slice(0, 2).map((i: any) => i.title).join("; "),
      next: (a as any).nextActions?.slice(0, 2).map((n: any) => `${n.action} (${n.priority})`).join("; "),
    }))
    autoTable(pdf, {
      startY: margin.t + 12,
      head: [["Công việc", "Mức độ", "Ảnh hưởng", "Vấn đề chính", "Hành động tiếp theo"]],
      body: issuesData.map((x) => [x.task, x.sev, x.impact, x.topIssues, x.next]),
      styles: { font: "NotoSans", fontStyle: "normal", fontSize: 9, cellPadding: 4, valign: "top" },
      headStyles: { font: "NotoSans", fontStyle: "bold", fillColor: [244, 114, 182], textColor: 255 },
      alternateRowStyles: { fillColor: [252, 252, 252] },
      margin: { left: margin.l, right: margin.r },
      columnStyles: { 0: { cellWidth: 220 }, 1: { cellWidth: 70, halign: "center" }, 2: { cellWidth: 240 }, 3: { cellWidth: 190 }, 4: { cellWidth: 220 } },
    })
  }

  const pageCount = pdf.getNumberOfPages()
  pdf.setFont("NotoSans", "normal"); pdf.setFontSize(9); pdf.setTextColor(120)
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.text(`Trang ${i}/${pageCount}`, pageW - margin.r, pageH - 14, { align: "right" })
  }

  pdf.save(`Gantt_Report_${projectData?.project?.name || projectId}.pdf`)
}


