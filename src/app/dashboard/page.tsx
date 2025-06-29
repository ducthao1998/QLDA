"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts"
import {
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  Target,
  Calendar,
  BarChart3,
  Activity,
  Award,
  Zap,
  Download,
  RefreshCw,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format, subDays, startOfMonth, endOfMonth } from "date-fns"
import { vi } from "date-fns/locale"

interface DashboardData {
  overview: {
    total_projects: number
    active_projects: number
    total_tasks: number
    completed_tasks: number
    overdue_tasks: number
    users_count: number
    completion_rate: number
    on_time_rate: number
  }
  task_statistics: {
    by_status: Array<{ status: string; count: number; percentage: number }>
    by_template: Array<{ template_name: string; count: number; avg_duration: number }>
    by_phase: Array<{ phase_name: string; count: number; completion_rate: number }>
    by_classification: Array<{ classification: string; count: number; avg_progress: number }>
  }
  user_statistics: {
    by_user: Array<{
      user_id: string
      full_name: string
      position: string
      org_unit: string
      total_tasks: number
      completed_tasks: number
      in_progress_tasks: number
      overdue_tasks: number
      completion_rate: number
      avg_task_duration: number
      workload_score: number
    }>
    skills_utilization: Array<{
      skill_name: string
      skill_field: string
      users_count: number
      tasks_count: number
      utilization_rate: number
    }>
    workload_distribution: Array<{
      org_unit: string
      total_users: number
      total_tasks: number
      avg_workload: number
      completion_rate: number
    }>
  }
  time_statistics: {
    monthly_trends: Array<{
      month: string
      completed_tasks: number
      created_tasks: number
      overdue_tasks: number
      completion_rate: number
    }>
    weekly_productivity: Array<{
      week: string
      productivity_score: number
      tasks_completed: number
      avg_completion_time: number
    }>
    deadline_performance: Array<{
      period: string
      on_time: number
      late: number
      early: number
      on_time_rate: number
    }>
  }
  advanced_analytics: {
    bottlenecks: Array<{
      type: string
      description: string
      impact_score: number
      affected_tasks: number
      recommendations: string[]
    }>
    predictions: {
      project_completion_forecast: Array<{
        project_name: string
        predicted_completion: string
        confidence: number
        risk_factors: string[]
      }>
      resource_needs: Array<{
        skill_name: string
        current_capacity: number
        predicted_demand: number
        gap: number
      }>
    }
    kpis: {
      efficiency_score: number
      quality_score: number
      resource_utilization: number
      customer_satisfaction: number
      innovation_index: number
    }
  }
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D", "#FFC658", "#FF7C7C"]

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  })
  const [selectedPeriod, setSelectedPeriod] = useState("30d")
  const [selectedOrgUnit, setSelectedOrgUnit] = useState("all")

  useEffect(() => {
    fetchDashboardData()
  }, [dateRange, selectedPeriod, selectedOrgUnit])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
        period: selectedPeriod,
        org_unit: selectedOrgUnit,
      })

      const response = await fetch(`/api/dashboard/analytics?${params}`)
      if (!response.ok) throw new Error("Failed to fetch dashboard data")

      const result = await response.json()
      setData(result)
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      toast.error("Lỗi khi tải dữ liệu dashboard")
    } finally {
      setLoading(false)
    }
  }

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period)
    const now = new Date()
    switch (period) {
      case "7d":
        setDateRange({ from: subDays(now, 7), to: now })
        break
      case "30d":
        setDateRange({ from: subDays(now, 30), to: now })
        break
      case "90d":
        setDateRange({ from: subDays(now, 90), to: now })
        break
      case "1y":
        setDateRange({ from: subDays(now, 365), to: now })
        break
      case "month":
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) })
        break
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6 pb-16">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 pb-16">
      {/* Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Phân Tích</h1>
          <p className="text-muted-foreground">Thống kê toàn diện về dự án, công việc và hiệu suất làm việc</p>
        </div>

        <div className="flex items-center gap-4">
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 ngày</SelectItem>
              <SelectItem value="30d">30 ngày</SelectItem>
              <SelectItem value="90d">90 ngày</SelectItem>
              <SelectItem value="1y">1 năm</SelectItem>
              <SelectItem value="month">Tháng này</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedOrgUnit} onValueChange={setSelectedOrgUnit}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Đơn vị" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả đơn vị</SelectItem>
              <SelectItem value="it">Phòng CNTT</SelectItem>
              <SelectItem value="hr">Phòng Nhân sự</SelectItem>
              <SelectItem value="finance">Phòng Tài chính</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={fetchDashboardData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Làm mới
          </Button>

          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Xuất báo cáo
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tổng số dự án</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.total_projects}</div>
              <p className="text-xs text-muted-foreground">{data.overview.active_projects} đang hoạt động</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tỷ lệ hoàn thành</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.completion_rate.toFixed(1)}%</div>
              <Progress value={data.overview.completion_rate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Đúng hạn</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.overview.on_time_rate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">{data.overview.overdue_tasks} công việc quá hạn</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Hiệu suất tổng thể</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.advanced_analytics.kpis.efficiency_score.toFixed(1)}</div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="default" className="text-xs">
                  Xuất sắc
                </Badge>
                <span className="text-xs text-green-600">+12% so với tháng trước</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Tổng quan
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Công việc
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Nhân sự
          </TabsTrigger>
          <TabsTrigger value="time" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Thời gian
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Nâng cao
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {data && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Phân bố trạng thái công việc</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={data.task_statistics.by_status}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="count"
                        >
                          {data.task_statistics.by_status.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Xu hướng hoàn thành theo tháng</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={data.time_statistics.monthly_trends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="completed_tasks"
                          stackId="1"
                          stroke="#8884d8"
                          fill="#8884d8"
                          name="Hoàn thành"
                        />
                        <Area
                          type="monotone"
                          dataKey="created_tasks"
                          stackId="1"
                          stroke="#82ca9d"
                          fill="#82ca9d"
                          name="Tạo mới"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Top 5 KPIs</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Hiệu suất</span>
                      <div className="flex items-center gap-2">
                        <Progress value={data.advanced_analytics.kpis.efficiency_score} className="w-20" />
                        <span className="text-sm font-medium">
                          {data.advanced_analytics.kpis.efficiency_score.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Chất lượng</span>
                      <div className="flex items-center gap-2">
                        <Progress value={data.advanced_analytics.kpis.quality_score} className="w-20" />
                        <span className="text-sm font-medium">
                          {data.advanced_analytics.kpis.quality_score.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Sử dụng tài nguyên</span>
                      <div className="flex items-center gap-2">
                        <Progress value={data.advanced_analytics.kpis.resource_utilization} className="w-20" />
                        <span className="text-sm font-medium">
                          {data.advanced_analytics.kpis.resource_utilization.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Hài lòng khách hàng</span>
                      <div className="flex items-center gap-2">
                        <Progress value={data.advanced_analytics.kpis.customer_satisfaction} className="w-20" />
                        <span className="text-sm font-medium">
                          {data.advanced_analytics.kpis.customer_satisfaction.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Chỉ số đổi mới</span>
                      <div className="flex items-center gap-2">
                        <Progress value={data.advanced_analytics.kpis.innovation_index} className="w-20" />
                        <span className="text-sm font-medium">
                          {data.advanced_analytics.kpis.innovation_index.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Cảnh báo & Khuyến nghị</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.advanced_analytics.bottlenecks.slice(0, 3).map((bottleneck, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{bottleneck.type}</p>
                          <p className="text-xs text-muted-foreground">{bottleneck.description}</p>
                          <Badge variant="outline" className="text-xs">
                            Ảnh hưởng: {bottleneck.affected_tasks} công việc
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Dự báo hoàn thành dự án</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.advanced_analytics.predictions.project_completion_forecast
                      .slice(0, 3)
                      .map((forecast, index) => (
                        <div key={index} className="space-y-2 p-3 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{forecast.project_name}</span>
                            <Badge variant={forecast.confidence > 80 ? "default" : "secondary"}>
                              {forecast.confidence}% tin cậy
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Dự kiến: {format(new Date(forecast.predicted_completion), "dd/MM/yyyy", { locale: vi })}
                          </p>
                          {forecast.risk_factors.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {forecast.risk_factors.slice(0, 2).map((risk, riskIndex) => (
                                <Badge key={riskIndex} variant="outline" className="text-xs">
                                  {risk}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-6">
          {data && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Thống kê theo loại công việc</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data.task_statistics.by_template}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="template_name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#8884d8" name="Số lượng" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tiến độ theo giai đoạn</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data.task_statistics.by_phase}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="phase_name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="completion_rate" fill="#82ca9d" name="Tỷ lệ hoàn thành (%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Chi tiết theo phân loại dự án</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {data.task_statistics.by_classification.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className="text-lg px-3 py-1">
                            {item.classification}
                          </Badge>
                          <div>
                            <p className="font-medium">Dự án nhóm {item.classification}</p>
                            <p className="text-sm text-muted-foreground">{item.count} công việc</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{item.avg_progress.toFixed(1)}%</p>
                          <p className="text-sm text-muted-foreground">Tiến độ trung bình</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          {data && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Phân bố khối lượng công việc</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data.user_statistics.workload_distribution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="org_unit" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="avg_workload" fill="#8884d8" name="Khối lượng TB" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Sử dụng kỹ năng</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data.user_statistics.skills_utilization.slice(0, 8)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="skill_name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="utilization_rate" fill="#82ca9d" name="Tỷ lệ sử dụng (%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Bảng xếp hạng hiệu suất</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {data.user_statistics.by_user
                      .sort((a, b) => b.completion_rate - a.completion_rate)
                      .slice(0, 10)
                      .map((user, index) => (
                        <div key={user.user_id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">{user.full_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {user.position} - {user.org_unit}
                              </p>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <p className="text-sm font-medium">{user.total_tasks}</p>
                                <p className="text-xs text-muted-foreground">Tổng CV</p>
                              </div>
                              <div className="text-center">
                                <p className="text-sm font-medium">{user.completed_tasks}</p>
                                <p className="text-xs text-muted-foreground">Hoàn thành</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-green-600">{user.completion_rate.toFixed(1)}%</p>
                                <p className="text-xs text-muted-foreground">Tỷ lệ</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={user.completion_rate} className="w-20" />
                              <Badge
                                variant={
                                  user.workload_score > 80
                                    ? "destructive"
                                    : user.workload_score > 60
                                      ? "secondary"
                                      : "default"
                                }
                                className="text-xs"
                              >
                                {user.workload_score > 80
                                  ? "Quá tải"
                                  : user.workload_score > 60
                                    ? "Bình thường"
                                    : "Nhàn rỗi"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Time Tab */}
        <TabsContent value="time" className="space-y-6">
          {data && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Xu hướng năng suất theo tuần</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={data.time_statistics.weekly_productivity}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="week" />
                        <YAxis />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="productivity_score"
                          stroke="#8884d8"
                          strokeWidth={2}
                          name="Điểm năng suất"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Hiệu suất đáp ứng deadline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data.time_statistics.deadline_performance}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="on_time" stackId="a" fill="#10b981" name="Đúng hạn" />
                        <Bar dataKey="late" stackId="a" fill="#ef4444" name="Trễ hạn" />
                        <Bar dataKey="early" stackId="a" fill="#3b82f6" name="Sớm hạn" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Phân tích chi tiết theo thời gian</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {data.time_statistics.monthly_trends.slice(-3).map((trend, index) => (
                      <div key={index} className="space-y-4 p-4 border rounded-lg">
                        <div className="text-center">
                          <h4 className="font-semibold text-lg">{trend.month}</h4>
                          <p className="text-sm text-muted-foreground">Tháng</p>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm">Hoàn thành:</span>
                            <span className="font-medium">{trend.completed_tasks}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Tạo mới:</span>
                            <span className="font-medium">{trend.created_tasks}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Quá hạn:</span>
                            <span className="font-medium text-red-600">{trend.overdue_tasks}</span>
                          </div>
                          <div className="pt-2 border-t">
                            <div className="flex justify-between items-center">
                              <span className="text-sm">Tỷ lệ hoàn thành:</span>
                              <Badge variant={trend.completion_rate > 80 ? "default" : "secondary"}>
                                {trend.completion_rate.toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-6">
          {data && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      Phân tích điểm nghẽn
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {data.advanced_analytics.bottlenecks.map((bottleneck, index) => (
                      <div key={index} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{bottleneck.type}</h4>
                          <Badge
                            variant={
                              bottleneck.impact_score > 80
                                ? "destructive"
                                : bottleneck.impact_score > 50
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            Mức độ: {bottleneck.impact_score}/100
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{bottleneck.description}</p>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Khuyến nghị:</p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {bottleneck.recommendations.map((rec, recIndex) => (
                              <li key={recIndex} className="flex items-start gap-2">
                                <span className="text-primary">•</span>
                                {rec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-blue-600" />
                      Dự báo nhu cầu tài nguyên
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {data.advanced_analytics.predictions.resource_needs.map((need, index) => (
                      <div key={index} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{need.skill_name}</h4>
                          <Badge variant={need.gap > 0 ? "destructive" : "default"}>
                            {need.gap > 0 ? `Thiếu ${need.gap}` : "Đủ"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="text-center">
                            <p className="font-medium">{need.current_capacity}</p>
                            <p className="text-muted-foreground">Hiện tại</p>
                          </div>
                          <div className="text-center">
                            <p className="font-medium">{need.predicted_demand}</p>
                            <p className="text-muted-foreground">Dự báo</p>
                          </div>
                          <div className="text-center">
                            <p className={`font-medium ${need.gap > 0 ? "text-red-600" : "text-green-600"}`}>
                              {need.gap > 0 ? `+${need.gap}` : need.gap}
                            </p>
                            <p className="text-muted-foreground">Chênh lệch</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-600" />
                    Bảng điều khiển KPI tổng hợp
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    <div className="text-center space-y-2">
                      <div className="text-3xl font-bold text-blue-600">
                        {data.advanced_analytics.kpis.efficiency_score.toFixed(1)}
                      </div>
                      <p className="text-sm font-medium">Hiệu suất</p>
                      <Progress value={data.advanced_analytics.kpis.efficiency_score} />
                    </div>
                    <div className="text-center space-y-2">
                      <div className="text-3xl font-bold text-green-600">
                        {data.advanced_analytics.kpis.quality_score.toFixed(1)}
                      </div>
                      <p className="text-sm font-medium">Chất lượng</p>
                      <Progress value={data.advanced_analytics.kpis.quality_score} />
                    </div>
                    <div className="text-center space-y-2">
                      <div className="text-3xl font-bold text-purple-600">
                        {data.advanced_analytics.kpis.resource_utilization.toFixed(1)}
                      </div>
                      <p className="text-sm font-medium">Tài nguyên</p>
                      <Progress value={data.advanced_analytics.kpis.resource_utilization} />
                    </div>
                    <div className="text-center space-y-2">
                      <div className="text-3xl font-bold text-orange-600">
                        {data.advanced_analytics.kpis.customer_satisfaction.toFixed(1)}
                      </div>
                      <p className="text-sm font-medium">Hài lòng KH</p>
                      <Progress value={data.advanced_analytics.kpis.customer_satisfaction} />
                    </div>
                    <div className="text-center space-y-2">
                      <div className="text-3xl font-bold text-red-600">
                        {data.advanced_analytics.kpis.innovation_index.toFixed(1)}
                      </div>
                      <p className="text-sm font-medium">Đổi mới</p>
                      <Progress value={data.advanced_analytics.kpis.innovation_index} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
