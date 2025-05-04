"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

interface Project {
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

export function ProjectsOverview() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProjects() {
      try {
        const response = await fetch("/api/dashboard/project-stats")
        if (!response.ok) throw new Error("Failed to load projects")
        const data = await response.json()
        setProjects(data.projects || [])
      } catch (error) {
        console.error("Error loading projects:", error)
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dự Án Đang Hoạt Động</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dự Án Đang Hoạt Động</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {projects.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Không có dự án nào đang hoạt động</p>
          ) : (
            projects.map((project) => (
              <div key={project.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{project.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {project.tasks.done}/{project.tasks.todo + project.tasks.in_progress + project.tasks.done} nhiệm vụ
                  </span>
                </div>
                <Progress value={project.progress} className="h-2" />
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
