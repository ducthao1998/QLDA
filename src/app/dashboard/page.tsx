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
  AreaChart,
  Area,
} from "recharts"
import { TrendingUp, Users, CheckCircle, Clock, AlertTriangle, Target, Calendar, BarChart3, Activity, Award, RefreshCw, FileText, Building, Info, HelpCircle } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { format, subDays, startOfMonth } from "date-fns"
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
      compliance_score: number
      process_optimization: number
    }
  }
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D", "#FFC658", "#FF7C7C"]

const STATUS_LABELS: Record<string, string> = {
  todo: "Chưa bắt đầu",
  in_progress: "Đang thực hiện",
  review: "Đang xem xét",
  done: "Hoàn thành",
  blocked: "Bị chặn",
  archived: "Lưu trữ",
}

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
      if (!response.ok) {
        throw new Error("Failed to fetch dashboard data")
      }
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
        setDateRange({ from: startOfMonth(now), to: now })
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

  if (!data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Không thể tải dữ liệu</h3>
          <p className="text-muted-foreground mb-4">Vui lòng thử lại sau</p>
          <Button onClick={fetchDashboardData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Thử lại
          </Button>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 p-6 pb-16">
      {/* Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Quản Lý Dự Án</h1>
          <p className="text-muted-foreground">Thống kê toàn diện về dự án, công việc và hiệu suất thực hiện</p>
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
              <SelectItem value="C12">C12</SelectItem>
              <SelectItem value="Phòng CNTT">Phòng CNTT</SelectItem>
              <SelectItem value="Phòng Kế hoạch">Phòng Kế hoạch</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchDashboardData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Làm mới
          </Button>
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Xuất báo cáo
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng số dự án</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.total_projects}</div>
            <p className="text-xs text-muted-foreground">{data.overview.active_projects} đang triển khai</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Tỷ lệ hoàn thành</CardTitle>
              <UITooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Tỷ lệ công việc đã hoàn thành trên tổng số công việc được tạo</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.overview.completed_tasks} / {data.overview.total_tasks} công việc
                  </p>
                </TooltipContent>
              </UITooltip>
            </div>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.completion_rate?.toFixed(1)}%</div>
            <Progress value={data.overview.completion_rate} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {data.overview.completed_tasks} / {data.overview.total_tasks} công việc
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Đúng tiến độ</CardTitle>
              <UITooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Tỷ lệ công việc hoàn thành đúng hoặc trước hạn</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tính trên các công việc đã hoàn thành
                  </p>
                </TooltipContent>
              </UITooltip>
            </div>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.on_time_rate?.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{data.overview.overdue_tasks} công việc trễ tiến độ</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Hiệu suất thực hiện</CardTitle>
              <UITooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Chỉ số tổng hợp đánh giá hiệu suất làm việc</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Kết hợp: Tỷ lệ hoàn thành (40%) + Chất lượng (40%) + Sử dụng nguồn lực (20%)
                  </p>
                </TooltipContent>
              </UITooltip>
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.advanced_analytics.kpis.efficiency_score?.toFixed(1)}</div>
            <div className="flex items-center gap-2 mt-2">
              <Badge
                variant={data.advanced_analytics.kpis.efficiency_score > 80 ? "default" : "secondary"}
                className="text-xs"
              >
                {data.advanced_analytics.kpis.efficiency_score > 80 ? "Tốt" : "Cần cải thiện"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

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
            Tiến độ
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Phân tích
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Phân bố trạng thái công việc</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.task_statistics.by_status.map((item) => ({
                        ...item,
                        name: STATUS_LABELS[item.status] || item.status,
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage?.toFixed(1)}%`}
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
                <CardTitle>Chỉ số hiệu suất chính</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Hiệu suất thực hiện</span>
                    <UITooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Chỉ số tổng hợp: Hoàn thành + Chất lượng + Nguồn lực</p>
                      </TooltipContent>
                    </UITooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={data.advanced_analytics.kpis.efficiency_score} className="w-20" />
                    <span className="text-sm font-medium">
                      {data.advanced_analytics.kpis.efficiency_score?.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Chất lượng công việc</span>
                    <UITooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Tỷ lệ công việc hoàn thành đúng hạn trên tổng số hoàn thành</p>
                      </TooltipContent>
                    </UITooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={data.advanced_analytics.kpis.quality_score} className="w-20" />
                    <span className="text-sm font-medium">
                      {data.advanced_analytics.kpis.quality_score?.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Sử dụng nguồn lực</span>
                    <UITooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Mức độ sử dụng hiệu quả nguồn lực nhân sự</p>
                        <p className="text-xs text-muted-foreground mt-1">Dựa trên khối lượng công việc trung bình</p>
                      </TooltipContent>
                    </UITooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={data.advanced_analytics.kpis.resource_utilization} className="w-20" />
                    <span className="text-sm font-medium">
                      {data.advanced_analytics.kpis.resource_utilization?.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Tuân thủ quy trình</span>
                    <UITooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Mức độ tuân thủ quy trình làm việc</p>
                        <p className="text-xs text-muted-foreground mt-1">Dựa trên hiệu suất và chất lượng</p>
                      </TooltipContent>
                    </UITooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={data.advanced_analytics.kpis.compliance_score} className="w-20" />
                    <span className="text-sm font-medium">
                      {data.advanced_analytics.kpis.compliance_score?.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Tối ưu hóa quy trình</span>
                    <UITooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Mức độ tối ưu hóa trong quy trình làm việc</p>
                        <p className="text-xs text-muted-foreground mt-1">Dựa trên hiệu quả sử dụng nguồn lực</p>
                      </TooltipContent>
                    </UITooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={data.advanced_analytics.kpis.process_optimization} className="w-20" />
                    <span className="text-sm font-medium">
                      {data.advanced_analytics.kpis.process_optimization?.toFixed(1)}%
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
                {data.advanced_analytics.bottlenecks.length > 0 ? (
                  data.advanced_analytics.bottlenecks.slice(0, 3).map((bottleneck, index) => (
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
                  ))
                ) : (
                  <div className="text-center py-4">
                    <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Không có cảnh báo</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Dự báo hoàn thành dự án</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.advanced_analytics.predictions.project_completion_forecast.length > 0 ? (
                  data.advanced_analytics.predictions.project_completion_forecast.slice(0, 3).map((forecast, index) => (
                    <div key={index} className="space-y-2 p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{forecast.project_name}</span>
                        <Badge variant={forecast.confidence > 80 ? "default" : "secondary"}>
                          {forecast.confidence?.toFixed(0)}% tin cậy
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
                  ))
                ) : (
                  <div className="text-center py-4">
                    <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Chưa có dự báo</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-6">
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
                <CardTitle>Phân loại dự án</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.task_statistics.by_classification}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ classification, count }) => `Nhóm ${classification}: ${count}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {data.task_statistics.by_classification.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
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
                      <p className="text-2xl font-bold">{item.avg_progress?.toFixed(1)}%</p>
                      <p className="text-sm text-muted-foreground">Tiến độ trung bình</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Phân bố khối lượng công việc theo đơn vị</CardTitle>
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
                <CardTitle>Sử dụng kỹ năng chuyên môn</CardTitle>
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
              <CardTitle>Bảng xếp hạng hiệu suất cán bộ</CardTitle>
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
                            <p className="text-lg font-bold text-green-600">{user.completion_rate?.toFixed(1)}%</p>
                            <p className="text-xs text-muted-foreground">Tỷ lệ</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={user.completion_rate} className="w-24" />
                          <Badge 
                            variant={user.workload_score > 80 ? "destructive" : user.workload_score > 60 ? "secondary" : "default"}
                            className="text-xs"
                          >
                            {user.workload_score > 80 ? "Cao" : user.workload_score > 60 ? "Vừa" : "Thấp"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time Tab */}
        <TabsContent value="time" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Hiệu suất theo tuần</CardTitle>
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
                      name="Điểm hiệu suất"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Hiệu suất đúng hạn</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.time_statistics.deadline_performance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="on_time" fill="#00C49F" name="Đúng hạn" />
                    <Bar dataKey="late" fill="#FF8042" name="Trễ hạn" />
                    <Bar dataKey="early" fill="#0088FE" name="Sớm hạn" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Thống kê thời gian hoàn thành</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {data.time_statistics.deadline_performance.map((item, index) => (
                  <div key={index} className="text-center p-4 border rounded-lg">
                    <h4 className="font-semibold mb-2">{item.period}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">Đúng hạn:</span>
                        <span className="font-medium text-green-600">{item.on_time}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Trễ hạn:</span>
                        <span className="font-medium text-red-600">{item.late}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">Sớm hạn:</span>
                        <span className="font-medium text-blue-600">{item.early}</span>
                      </div>
                      <div className="pt-2 border-t">
                        <span className="text-lg font-bold">{item.on_time_rate?.toFixed(1)}%</span>
                        <p className="text-xs text-muted-foreground">Tỷ lệ đúng hạn</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Phân tích điểm nghẽn</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.advanced_analytics.bottlenecks.length > 0 ? (
                  data.advanced_analytics.bottlenecks.map((bottleneck, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{bottleneck.type}</h4>
                        <Badge variant="destructive">
                          Mức độ: {bottleneck.impact_score}/10
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{bottleneck.description}</p>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm">Ảnh hưởng {bottleneck.affected_tasks} công việc</span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Khuyến nghị:</p>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {bottleneck.recommendations.map((rec, recIndex) => (
                            <li key={recIndex} className="flex items-start gap-2">
                              <span className="text-primary">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-lg font-semibold">Không có điểm nghẽn</p>
                    <p className="text-muted-foreground">Hệ thống đang hoạt động tốt</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Dự báo nhu cầu nguồn lực</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.advanced_analytics.predictions.resource_needs.map((resource, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{resource.skill_name}</h4>
                      <Badge variant={resource.gap > 0 ? "destructive" : "default"}>
                        {resource.gap > 0 ? `Thiếu ${resource.gap}` : "Đủ"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Hiện tại:</p>
                        <p className="font-medium">{resource.current_capacity}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Dự báo cần:</p>
                        <p className="font-medium">{resource.predicted_demand}</p>
                      </div>
                    </div>
                    <Progress 
                      value={(resource.current_capacity / resource.predicted_demand) * 100} 
                      className="mt-2"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Tổng quan chỉ số KPI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {data.advanced_analytics.kpis.efficiency_score?.toFixed(1)}
                  </div>
                  <p className="text-sm font-medium">Hiệu suất</p>
                  <Progress value={data.advanced_analytics.kpis.efficiency_score} className="mt-2" />
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {data.advanced_analytics.kpis.quality_score?.toFixed(1)}
                  </div>
                  <p className="text-sm font-medium">Chất lượng</p>
                  <Progress value={data.advanced_analytics.kpis.quality_score} className="mt-2" />
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {data.advanced_analytics.kpis.resource_utilization?.toFixed(1)}
                  </div>
                  <p className="text-sm font-medium">Nguồn lực</p>
                  <Progress value={data.advanced_analytics.kpis.resource_utilization} className="mt-2" />
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-orange-600 mb-2">
                    {data.advanced_analytics.kpis.compliance_score?.toFixed(1)}
                  </div>
                  <p className="text-sm font-medium">Tuân thủ</p>
                  <Progress value={data.advanced_analytics.kpis.compliance_score} className="mt-2" />
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-red-600 mb-2">
                    {data.advanced_analytics.kpis.process_optimization?.toFixed(1)}
                  </div>
                  <p className="text-sm font-medium">Tối ưu hóa</p>
                  <Progress value={data.advanced_analytics.kpis.process_optimization} className="mt-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </TooltipProvider>
  )
}
