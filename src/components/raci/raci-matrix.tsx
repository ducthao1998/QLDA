"use client"

import { useEffect, useState, useMemo } from "react"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AlertCircleIcon, LayersIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RaciRole } from "@/app/types/table-types"

interface RaciTask {
  id: number
  name: string
  phase_name?: string
  status: string
}

interface RaciUser {
  id: string
  full_name: string
  position?: string
  org_unit?: string
}

interface RaciAssignment {
  task_id: number
  user_id: string
  role: RaciRole
}

interface RaciData {
  tasks: RaciTask[]
  users: RaciUser[]
  assignments: RaciAssignment[]
}

interface RaciMatrixProps {
  projectId: string | null
  searchTerm: string
  roleFilter: string | null
  phaseFilter: string | null
}

const roleStyles: Record<RaciRole, string> = {
  R: "bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200",
  A: "bg-green-100 text-green-800 border-green-300 hover:bg-green-200",
  C: "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200",
  I: "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200",
}

const statusStyles: Record<string, string> = {
  todo: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  review: "bg-yellow-100 text-yellow-800",
  done: "bg-green-100 text-green-800",
  blocked: "bg-red-100 text-red-800",
  archived: "bg-gray-100 text-gray-600",
}

export function RaciMatrix({ projectId, searchTerm, roleFilter, phaseFilter }: RaciMatrixProps) {
  const [raciData, setRaciData] = useState<RaciData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch RACI data when project changes
  useEffect(() => {
    if (!projectId) {
      setRaciData(null)
      return
    }

    const fetchRaciData = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/projects/${projectId}/raci`)
        if (!response.ok) throw new Error("Không thể tải dữ liệu RACI")

        const data = await response.json()
        setRaciData(data)
      } catch (err: any) {
        setError(err.message)
        console.error("Error fetching RACI data:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchRaciData()
  }, [projectId])

  // Filter and search logic
  const filteredData = useMemo(() => {
    if (!raciData) return null

    let filteredTasks = raciData.tasks

    // Search filter
    if (searchTerm) {
      filteredTasks = filteredTasks.filter((task) => task.name.toLowerCase().includes(searchTerm.toLowerCase()))
    }

    // Phase filter
    if (phaseFilter) {
      filteredTasks = filteredTasks.filter((task) => task.phase_name === phaseFilter)
    }

    // Role filter
    if (roleFilter) {
      const tasksWithRole = raciData.assignments
        .filter((assignment) => assignment.role === roleFilter)
        .map((assignment) => assignment.task_id)

      filteredTasks = filteredTasks.filter((task) => tasksWithRole.includes(task.id))
    }

    return {
      ...raciData,
      tasks: filteredTasks,
    }
  }, [raciData, searchTerm, phaseFilter, roleFilter])

  const findRole = (taskId: number, userId: string): RaciRole | undefined => {
    return filteredData?.assignments.find((a) => a.task_id === taskId && a.user_id === userId)?.role
  }

  const getRoleCount = (userId: string, role: RaciRole): number => {
    return filteredData?.assignments.filter((a) => a.user_id === userId && a.role === role).length || 0
  }

  if (!projectId) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <LayersIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Vui lòng chọn một dự án để xem ma trận RACI</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!filteredData || filteredData.tasks.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircleIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              {searchTerm || roleFilter || phaseFilter
                ? "Không tìm thấy công việc nào phù hợp với bộ lọc"
                : "Không có dữ liệu RACI cho dự án này"}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Ma trận RACI</CardTitle>
            <p className="text-sm text-muted-foreground">
              Hiển thị {filteredData.tasks.length} công việc và {filteredData.users.length} thành viên
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* User Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {filteredData.users.map((user) => (
              <div key={user.id} className="p-3 border rounded-lg bg-muted/30">
                <div className="font-medium text-sm">{user.full_name}</div>
                <div className="text-xs text-muted-foreground mb-2">
                  {user.position} • {user.org_unit}
                </div>
                <div className="flex gap-1">
                  {(["R", "A", "C", "I"] as RaciRole[]).map((role) => {
                    const count = getRoleCount(user.id, role)
                    return (
                      <Badge
                        key={role}
                        variant="outline"
                        className={cn("text-xs px-1 py-0", count > 0 ? roleStyles[role] : "opacity-30")}
                      >
                        {role}:{count}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* RACI Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[300px] border-r">
                      <div className="font-semibold">Công việc</div>
                    </TableHead>
                    {filteredData.users.map((user) => (
                      <TableHead key={user.id} className="text-center min-w-[120px]">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-help">
                                <div className="font-medium text-xs">{user.full_name}</div>
                                <div className="text-xs text-muted-foreground font-normal">{user.position}</div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <div className="font-medium">{user.full_name}</div>
                                <div>{user.position}</div>
                                <div className="text-muted-foreground">{user.org_unit}</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.tasks.map((task) => (
                    <TableRow key={task.id} className="hover:bg-muted/30">
                      <TableCell className="sticky left-0 bg-background z-10 border-r">
                        <div className="space-y-1">
                          <div className="font-medium text-sm">{task.name}</div>
                          <div className="flex items-center gap-2">
                            {task.phase_name && (
                              <Badge variant="outline" className="text-xs">
                                <LayersIcon className="h-3 w-3 mr-1" />
                                {task.phase_name}
                              </Badge>
                            )}
                            <Badge
                              variant="outline"
                              className={cn("text-xs", statusStyles[task.status] || statusStyles.todo)}
                            >
                              {task.status === "todo" && "Chưa bắt đầu"}
                              {task.status === "in_progress" && "Đang thực hiện"}
                              {task.status === "review" && "Đang xem xét"}
                              {task.status === "done" && "Hoàn thành"}
                              {task.status === "blocked" && "Bị chặn"}
                              {task.status === "archived" && "Lưu trữ"}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      {filteredData.users.map((user) => {
                        const role = findRole(task.id, user.id)
                        return (
                          <TableCell key={user.id} className="text-center">
                            {role ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      className={cn("cursor-pointer font-bold text-sm px-3 py-1", roleStyles[role])}
                                    >
                                      {role}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-sm">
                                      <div className="font-medium">{user.full_name}</div>
                                      <div>
                                        {role === "R" && "Responsible - Người thực hiện"}
                                        {role === "A" && "Accountable - Người chịu trách nhiệm"}
                                        {role === "C" && "Consulted - Người tư vấn"}
                                        {role === "I" && "Informed - Người được thông báo"}
                                      </div>
                                      <div className="text-muted-foreground">Công việc: {task.name}</div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
