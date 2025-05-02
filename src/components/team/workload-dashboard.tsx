"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import type { User, Task } from "@/app/types/table-types"

interface UserWorkload {
  user: User
  activeTasks: number
  totalHours: number
  utilizationPercent: number
  overloaded: boolean
  tasks: Task[]
}

export function WorkloadDashboard() {
  const [workloads, setWorkloads] = useState<UserWorkload[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [timeframe, setTimeframe] = useState<"week" | "month" | "quarter">("week")

  useEffect(() => {
    fetchWorkloadData(timeframe)
  }, [timeframe])

  const fetchWorkloadData = async (period: "week" | "month" | "quarter") => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/workload?period=${period}`)
      if (!response.ok) {
        throw new Error("Không thể tải dữ liệu khối lượng công việc")
      }
      const data = await response.json()
      setWorkloads(data.workloads)
    } catch (error) {
      toast.error("Lỗi khi tải dữ liệu", {
        description: error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
  }

  const chartData = workloads.map((workload) => ({
    name: workload.user.full_name.split(" ").pop() || workload.user.full_name,
    "Số giờ đã phân công": workload.totalHours,
  }))

  if (isLoading) {
    return <div className="flex justify-center p-8">Đang tải dữ liệu...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Phân Tích Khối Lượng Công Việc</h2>
        <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as "week" | "month" | "quarter")}>
          <TabsList>
            <TabsTrigger value="week">Tuần</TabsTrigger>
            <TabsTrigger value="month">Tháng</TabsTrigger>
            <TabsTrigger value="quarter">Quý</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workloads.map((workload) => (
          <Card key={workload.user.id} className={workload.overloaded ? "border-red-400" : ""}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-2">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={`/abstract-geometric-shapes.png?height=40&width=40&query=${workload.user.full_name}`}
                    />
                    <AvatarFallback>{getInitials(workload.user.full_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">{workload.user.full_name}</CardTitle>
                    <CardDescription className="text-xs">
                      {workload.user.position} • {workload.user.org_unit}
                    </CardDescription>
                  </div>
                </div>
                {workload.overloaded && <Badge variant="destructive">Quá tải</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Công suất sử dụng</span>
                    <span className={workload.overloaded ? "text-red-500 font-medium" : ""}>
                      {workload.utilizationPercent}%
                    </span>
                  </div>
                  <Progress value={workload.utilizationPercent} className={workload.overloaded ? "bg-red-100" : ""} />
                </div>
                <div className="flex justify-between text-sm">
                  <span>Nhiệm vụ đang thực hiện:</span>
                  <span>{workload.activeTasks}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tổng số giờ đã phân công:</span>
                  <span>{workload.totalHours} giờ</span>
                </div>
               
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Biểu Đồ Phân Bổ Công Việc</CardTitle>
          <CardDescription>So sánh khối lượng công việc đã phân công với công suất tối đa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 60,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Số giờ đã phân công" fill="#8884d8" />
                <Bar dataKey="Công suất tối đa" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
