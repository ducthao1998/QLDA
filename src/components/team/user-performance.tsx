"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts"
import type { UserPerformance as UserPerformanceType } from "@/app/types/table-types"
interface PieChartData {
    name: string;
    value: number;
  }
export function UserPerformance() {
  const [performanceData, setPerformanceData] = useState<UserPerformanceType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all")

  useEffect(() => {
    fetchPerformanceData()
  }, [])

  const fetchPerformanceData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/user-performance")
      if (!response.ok) {
        throw new Error("Không thể tải dữ liệu hiệu suất")
      }
      const data = await response.json()
      setPerformanceData(data.performance)
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

  const getPerformanceColor = (score: number) => {
    if (score >= 0.8) return "text-green-600"
    if (score >= 0.6) return "text-yellow-600"
    return "text-red-600"
  }

  const getPerformanceLabel = (score: number) => {
    if (score >= 0.8) return "Xuất sắc"
    if (score >= 0.6) return "Khá"
    if (score >= 0.4) return "Trung bình"
    return "Cần cải thiện"
  }

  const filteredData = performanceData.filter((user) => {
    if (filter === "all") return true
    if (filter === "high") return user.perf_score >= 0.8
    if (filter === "medium") return user.perf_score >= 0.6 && user.perf_score < 0.8
    if (filter === "low") return user.perf_score < 0.6
  })

  const pieChartData = [
    { name: "Xuất sắc", value: performanceData.filter((u) => u.perf_score >= 0.8).length },
    { name: "Khá", value: performanceData.filter((u) => u.perf_score >= 0.6 && u.perf_score < 0.8).length },
    { name: "Trung bình", value: performanceData.filter((u) => u.perf_score >= 0.4 && u.perf_score < 0.6).length },
    { name: "Cần cải thiện", value: performanceData.filter((u) => u.perf_score < 0.4).length },
  ]

  const COLORS = ["#4CAF50", "#FFC107", "#FF9800", "#F44336"]

  const lineChartData = performanceData
    .sort((a, b) => b.perf_score - a.perf_score)
    .slice(0, 10)
    .map((user) => ({
      name: user.full_name.split(" ").pop() || user.full_name,
      "Tỉ lệ đúng hạn": user.pct_on_time * 100,
      "Điểm chất lượng": user.avg_quality * 20, // Chuyển thang 1-5 thành thang 20-100
    }))

  if (isLoading) {
    return <div className="flex justify-center p-8">Đang tải dữ liệu...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Hiệu Suất Nhân Sự</h2>
        <Select value={filter} onValueChange={(value) => setFilter(value as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Lọc theo hiệu suất" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="high">Hiệu suất cao</SelectItem>
            <SelectItem value="medium">Hiệu suất trung bình</SelectItem>
            <SelectItem value="low">Hiệu suất thấp</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Phân Bố Hiệu Suất</CardTitle>
            <CardDescription>Tỉ lệ nhân sự theo mức hiệu suất</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }: { name: PieChartData['name'], percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 10 Nhân Sự Hiệu Suất Cao</CardTitle>
            <CardDescription>So sánh tỉ lệ đúng hạn và điểm chất lượng</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={lineChartData}
                  margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Tỉ lệ đúng hạn" stroke="#8884d8" activeDot={{ r: 8 }} />
                  <Line type="monotone" dataKey="Điểm chất lượng" stroke="#82ca9d" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bảng Xếp Hạng Hiệu Suất</CardTitle>
          <CardDescription>Chi tiết hiệu suất của từng nhân sự</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhân sự</TableHead>
                <TableHead>Tỉ lệ đúng hạn</TableHead>
                <TableHead>Điểm chất lượng</TableHead>
                <TableHead>Điểm hiệu suất</TableHead>
                <TableHead>Xếp loại</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={`/abstract-geometric-shapes.png?height=32&width=32&query=${user.full_name}`} />
                        <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                      </Avatar>
                      <span>{user.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span>{(user.pct_on_time * 100).toFixed(1)}%</span>
                      <Progress value={user.pct_on_time * 100} className="h-2" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className={`h-3 w-3 rounded-full ${
                            i < Math.round(user.avg_quality) ? "bg-yellow-400" : "bg-gray-200"
                          }`}
                        />
                      ))}
                      <span className="ml-2">{user.avg_quality.toFixed(1)}/5</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className={getPerformanceColor(user.perf_score)}>
                        {(user.perf_score * 100).toFixed(0)}%
                      </span>
                      <Progress value={user.perf_score * 100} className="h-2" />
                    </div>
                  </TableCell>
                  <TableCell className={getPerformanceColor(user.perf_score)}>
                    {getPerformanceLabel(user.perf_score)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
