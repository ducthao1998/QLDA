import * as XLSX from "xlsx"

export const exportGanttToExcel = (
  scheduleRows: any[],
  taskAnalysis: Record<string, any>,
  filename: string,
) => {
  const wb = XLSX.utils.book_new()
  const ws1 = XLSX.utils.json_to_sheet(scheduleRows)
  const colWidths = Object.keys(scheduleRows[0] || {}).map((k) => ({ wch: Math.max(k.length, 14) }))
  ;(ws1 as any)["!cols"] = colWidths
  XLSX.utils.book_append_sheet(wb, ws1, "Schedule")

  const issuesRows = Object.values(taskAnalysis).map((a: any) => ({
    Task: a.taskName,
    Severity: a.severity,
    Impact: a.impact.impactDescription,
    Issues: a.issues.map((i: any) => i.title).join("; "),
    "Next actions": a.nextActions?.slice(0, 3).map((n: any) => `${n.action} (${n.priority})`).join("; "),
  }))
  const ws2 = XLSX.utils.json_to_sheet(issuesRows)
  ;(ws2 as any)["!cols"] = [{ wch: 40 }, { wch: 12 }, { wch: 40 }, { wch: 50 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, ws2, "Issues")

  XLSX.writeFile(wb, filename)
}


