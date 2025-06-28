"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FileDownIcon, FileSpreadsheetIcon, FileTextIcon, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface RaciExportProps {
  projectId: string | null
}

export function RaciExport({ projectId }: RaciExportProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (format: "excel" | "csv" | "pdf") => {
    if (!projectId) {
      toast.error("Vui lòng chọn dự án để xuất dữ liệu")
      return
    }

    try {
      setIsExporting(true)

      const response = await fetch(`/api/projects/${projectId}/raci/export?format=${format}`)
      if (!response.ok) throw new Error("Không thể xuất dữ liệu")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `raci-matrix-${projectId}.${format === "excel" ? "xlsx" : format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`Đã xuất ma trận RACI thành công (${format.toUpperCase()})`)
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Có lỗi xảy ra khi xuất dữ liệu")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={!projectId || isExporting}>
          {isExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDownIcon className="h-4 w-4 mr-2" />}
          Xuất dữ liệu
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("excel")}>
          <FileSpreadsheetIcon className="h-4 w-4 mr-2" />
          Xuất Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          <FileTextIcon className="h-4 w-4 mr-2" />
          Xuất CSV (.csv)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          <FileTextIcon className="h-4 w-4 mr-2" />
          Xuất PDF (.pdf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
