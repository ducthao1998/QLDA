"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { ProjectsOverview } from "@/components/dashboard/projects-overview"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { UpcomingDeadlines } from "@/components/dashboard/upcoming-deadlines"
import { ProjectProgressChart } from "@/components/dashboard/project-progress-chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardMetrics } from "@/components/dashboard/dashboard-metrics"

interface ProjectData {
  id: string
  name: string
  progress: number
  status: "on_time" | "late" | "ahead"
  tasks: {
    todo: number
    in_progress: number
    done: number
  }
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(false)
  }, [])

  return (
    <div className="space-y-6 p-6 pb-16">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Tổng Quan</h1>
        <p className="text-muted-foreground">Xem tổng quan về các dự án, nhiệm vụ và hoạt động gần đây.</p>
      </div>

      <DashboardMetrics />

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Tổng Quan</TabsTrigger>
          <TabsTrigger value="analytics">Phân Tích</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ProjectsOverview />
            <UpcomingDeadlines />
          </div>

          <RecentActivity />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Skeleton className="h-[400px]" />
              <Skeleton className="h-[400px]" />
            </div>
          ) : (
            <ProjectProgressChart />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
