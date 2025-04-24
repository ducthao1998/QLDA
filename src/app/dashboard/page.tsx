import { DashboardMetrics } from "@/components/dashboard-metrics"
import { ProjectsOverview } from "@/components/projects-overview"
import { RecentActivity } from "@/components/recent-activity"
import { UpcomingDeadlines } from "@/components/upcoming-deadlines"

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Tổng Quan</h1>
      <DashboardMetrics />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProjectsOverview />
        <UpcomingDeadlines />
      </div>
      <RecentActivity />
    </div>
  )
}
