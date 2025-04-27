import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { TaskForm } from "@/components/task/task-form"
import { Task } from "@/app/types/task"

type Params = Promise<{ id: string }>

export default async function EditTaskPage({ params }: { params: Params }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: task, error } = await supabase
    .from("tasks")
    .select(`
      *,
      users!assigned_to:user_id (
        full_name,
        position,
        org_unit
      ),
      projects (
        name
      )
    `)
    .eq("id", id)
    .single() as { data: Task | null, error: any }

  if (error || !task) {
    notFound()
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Chỉnh sửa công việc</h1>
        <p className="text-muted-foreground mt-2">
          Dự án: {task.projects?.name}
        </p>
      </div>

      <TaskForm 
        initialData={task}
        projectId={task.project_id}
        mode="edit"
      />
    </div>
  )
} 