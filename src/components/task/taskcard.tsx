import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Task, TaskStatus } from "@/app/types/table-types"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { Calendar, Tag, User } from "lucide-react"
import Link from "next/link"

interface TaskCardProps {
  task: Task & {
    task_skills?: {
      skills: {
        id: number
        name: string
      }
    }[]
    users?: {
      full_name: string
      position?: string
      org_unit?: string
    }
  }
  projectId: string
  onStatusChange: () => Promise<void>
}

export function TaskCard({ task, projectId, onStatusChange }: TaskCardProps) {
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {task.name}
        </CardTitle>
        <Badge variant={task.status === "done" ? "secondary" : "default"}>
          {task.status}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {task.task_skills && task.task_skills.length > 0 && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Tag className="mr-2 h-4 w-4" />
              <div className="flex flex-wrap gap-1">
                {task.task_skills.map((taskSkill) => (
                  <Badge key={taskSkill.skills.id} variant="outline" className="text-xs">
                    {taskSkill.skills.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {task.start_date && task.end_date && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Calendar className="mr-2 h-4 w-4" />
              <span>
                {format(new Date(task.start_date), "dd/MM/yyyy", { locale: vi })} - 
                {format(new Date(task.end_date), "dd/MM/yyyy", { locale: vi })}
              </span>
            </div>
          )}

          {task.users && (
            <div className="flex items-center text-sm text-muted-foreground">
              <User className="mr-2 h-4 w-4" />
              <span>Người thực hiện: {task.users.full_name}</span>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/tasks/${task.id}`}>
                Xem chi tiết
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}