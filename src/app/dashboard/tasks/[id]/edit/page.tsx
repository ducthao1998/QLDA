import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { TaskEditForm } from "@/components/task/task-edit-form"
import type { Task } from "@/app/types/table-types"

type Params = { id: string }

type TaskWithRelations = Task & {
  projects?: {
    name: string
  }
  task_raci?: Array<{
    user_id: string
    role: string
    users: {
      full_name: string
      position?: string
      org_unit?: string
    }
  }>
}

export default async function EditTaskPage({ params }: { params: Params }) {
  const { id } = await params
  const supabase = await createClient()

  console.log("EditTaskPage: Fetching task with ID:", id)

  try {
    // Fetch task without assigned_to, include RACI for responsible user
    const { data: task, error } = await supabase
      .from("tasks")
      .select(`
        *,
        projects (
          name
        ),
        task_raci (
          user_id,
          role,
          users (
            full_name,
            position,
            org_unit
          )
        )
      `)
      .eq("id", id)
      .single()

    console.log("EditTaskPage: Task data:", task)
    console.log("EditTaskPage: Error:", error)

    if (error || !task) {
      console.log("EditTaskPage: Task not found or error occurred")
      notFound()
    }

    // Find the responsible user (role = 'R') from RACI
    const responsibleUser = task.task_raci?.find(raci => raci.role === 'R')
    const responsibleUserName = responsibleUser?.users?.full_name || 'Chưa phân công'

    return (
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Chỉnh sửa công việc</h1>
          <div className="text-muted-foreground mt-2 space-y-1">
            <p>Dự án: {task.projects?.name}</p>
            <p>Người thực hiện: {responsibleUserName}</p>
          </div>
        </div>

        <TaskEditForm 
          initialData={task as Task} 
          projectId={task.project_id} 
        />
      </div>
    )
  } catch (error) {
    console.error("Error in EditTaskPage:", error)
    notFound()
  }
}