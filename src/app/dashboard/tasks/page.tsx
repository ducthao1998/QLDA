import { TasksList } from "@/components/tasks-list"
import { Button } from "@/components/ui/button"
import { PlusIcon } from "lucide-react"
import Link from "next/link"

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Nhiệm Vụ</h1>
        <Button asChild>
          <Link href="/dashboard/tasks/new">
            <PlusIcon className="mr-2 h-4 w-4" />
            Nhiệm Vụ Mới
          </Link>
        </Button>
      </div>
      <TasksList />
    </div>
  )
}
