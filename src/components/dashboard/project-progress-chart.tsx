"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Chart, registerables } from "chart.js"

Chart.register(...registerables)

interface ProjectData {
  id: string
  name: string
  progress: number
  tasks: {
    todo: number
    in_progress: number
    done: number
  }
}

export function ProjectProgressChart() {
  const [projects, setProjects] = useState<ProjectData[]>([])
  const barChartRef = useRef<HTMLCanvasElement>(null)
  const pieChartRef = useRef<HTMLCanvasElement>(null)
  const barChartInstance = useRef<Chart | null>(null)
  const pieChartInstance = useRef<Chart | null>(null)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch("/api/dashboard/project-stats")
        if (!response.ok) throw new Error("Failed to fetch project stats")
        const data = await response.json()
        setProjects(data.projects)
      } catch (error) {
        console.error("Error fetching project stats:", error)
      }
    }

    fetchProjects()
  }, [])

  useEffect(() => {
    if (!projects.length) return

    // Tạo biểu đồ cột cho tiến độ dự án
    if (barChartRef.current) {
      if (barChartInstance.current) {
        barChartInstance.current.destroy()
      }

      const ctx = barChartRef.current.getContext("2d")
      if (ctx) {
        barChartInstance.current = new Chart(ctx, {
          type: "bar",
          data: {
            labels: projects.map((project) => project.name),
            datasets: [
              {
                label: "Tiến độ (%)",
                data: projects.map((project) => project.progress),
                backgroundColor: "rgba(37, 99, 235, 0.8)",
                borderColor: "rgba(37, 99, 235, 1)",
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                  callback: (value: string | number) => typeof value === 'number' ? value + "%" : value,
                },
              },
            },
            plugins: {
              legend: {
                display: false,
              },
            },
          },
        })
      }
    }

    // Tạo biểu đồ tròn cho phân bố nhiệm vụ
    if (pieChartRef.current) {
      if (pieChartInstance.current) {
        pieChartInstance.current.destroy()
      }

      const ctx = pieChartRef.current.getContext("2d")
      if (ctx) {
        // Tính tổng số nhiệm vụ theo trạng thái
        const todoTasks = projects.reduce((sum, project) => sum + project.tasks.todo, 0)
        const inProgressTasks = projects.reduce((sum, project) => sum + project.tasks.in_progress, 0)
        const doneTasks = projects.reduce((sum, project) => sum + project.tasks.done, 0)

        pieChartInstance.current = new Chart(ctx, {
          type: "pie",
          data: {
            labels: ["Chưa bắt đầu", "Đang thực hiện", "Hoàn thành"],
            datasets: [
              {
                data: [todoTasks, inProgressTasks, doneTasks],
                backgroundColor: ["rgba(239, 68, 68, 0.8)", "rgba(245, 158, 11, 0.8)", "rgba(34, 197, 94, 0.8)"],
                borderColor: ["rgba(239, 68, 68, 1)", "rgba(245, 158, 11, 1)", "rgba(34, 197, 94, 1)"],
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: "bottom",
              },
            },
          },
        })
      }
    }

    return () => {
      if (barChartInstance.current) {
        barChartInstance.current.destroy()
      }
      if (pieChartInstance.current) {
        pieChartInstance.current.destroy()
      }
    }
  }, [projects])

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle>Thống Kê Dự Án</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="progress">
          <TabsList className="mb-4">
            <TabsTrigger value="progress">Tiến Độ Dự Án</TabsTrigger>
            <TabsTrigger value="distribution">Phân Bố Nhiệm Vụ</TabsTrigger>
          </TabsList>
          <TabsContent value="progress">
            <div className="h-[300px]">
              <canvas ref={barChartRef} />
            </div>
          </TabsContent>
          <TabsContent value="distribution">
            <div className="h-[300px]">
              <canvas ref={pieChartRef} />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
