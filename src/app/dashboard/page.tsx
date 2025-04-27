"use client"

import { useEffect, useState } from "react"
import { calculateProjectProgress } from "@/algorithm/project-progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import { DashboardMetrics } from "@/components/dashboard-metrics"
import { ProjectsOverview } from "@/components/project/projects-overview"
import { RecentActivity } from "@/components/recent-activity"
import { UpcomingDeadlines } from "@/components/upcoming-deadlines"

interface ProjectProgress {
  id: string
  name: string
  progress: number
  status: "on_time" | "late" | "ahead"
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<ProjectProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProjects() {
      try {
        const response = await fetch("/api/projects")
        if (!response.ok) throw new Error("Failed to load projects")
        const data = await response.json()
        
        if (!data.projects || !Array.isArray(data.projects)) {
          throw new Error("Invalid projects data")
        }

        // Calculate progress for each project
        const projectsWithProgress = await Promise.all(
          data.projects.map(async (project: any) => {
            const progress = await calculateProjectProgress(project.id)
            return {
              id: project.id,
              name: project.name,
              progress: progress.overallProgress,
              status: progress.status
            }
          })
        )
        
        setProjects(projectsWithProgress)
      } catch (error) {
        console.error("Error loading projects:", error)
        toast.error("Không thể tải danh sách dự án")
        setProjects([])
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Tổng Quan</h1>
      <DashboardMetrics />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProjectsOverview />
        <UpcomingDeadlines />
      </div>
      <RecentActivity />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.length > 0 ? (
          projects.map((project) => (
            <Card key={project.id}>
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Tiến độ</span>
                    <span>{project.progress}%</span>
                  </div>
                  <Progress value={project.progress} />
                  <div className="text-sm text-muted-foreground">
                    Trạng thái: {project.status === "on_time" ? "Đúng tiến độ" : 
                                project.status === "late" ? "Chậm tiến độ" : "Vượt tiến độ"}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <p className="text-muted-foreground">Chưa có dự án nào</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
