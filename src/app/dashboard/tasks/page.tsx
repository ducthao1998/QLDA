import { TasksList } from "@/components/task/tasks-list"
import { Button } from "@/components/ui/button"
import { PlusIcon } from "lucide-react"
import Link from "next/link"

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Công việc</h1>
      </div>
      <TasksList />
    </div>
  )
}
