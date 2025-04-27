import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { PlusIcon, ClockIcon, AlertCircleIcon, MoreHorizontalIcon, UserIcon, CalendarIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TaskCard } from "../task/taskcard"
import { TasksSkeleton } from "../task/task-skeleton"
import { AddTaskDialog } from "../task/add-task-dialog"

// Status appearance mappings


// Dialog to add a new task


// Placeholder skeleton grid

// Main component tying everything together
export function ProjectTasks({ projectId }: { projectId: string }) {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchTasks() {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`)
      if (!res.ok) throw new Error("Không thể tải danh sách nhiệm vụ")
      const json = await res.json()
      setTasks(json.tasks || [])
    } catch {
      toast.error("Lỗi", { description: "Không thể tải danh sách nhiệm vụ" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTasks() }, [projectId])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Danh sách nhiệm vụ</h2>
        <AddTaskDialog projectId={projectId} onCreated={fetchTasks} />
      </div>

      {loading ? (
        <TasksSkeleton />
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <p className="text-muted-foreground mb-4">Chưa có nhiệm vụ nào trong dự án này</p>
            <AddTaskDialog projectId={projectId} onCreated={fetchTasks} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} projectId={projectId} onStatusChange={fetchTasks} />
          ))}
        </div>
      )}
    </div>
  )
}
