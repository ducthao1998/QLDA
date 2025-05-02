import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Task, TaskStatus } from "@/app/types/table-types"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { Calendar, Clock, User } from "lucide-react"
import Link from "next/link"

interface TaskCardProps {
  task: Task & {
    min_duration_hours?: number
    max_duration_hours?: number
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
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock className="mr-2 h-4 w-4" />
            <span>
              {task.min_duration_hours || 0} - {task.max_duration_hours || 0} giờ
            </span>
          </div>
          
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