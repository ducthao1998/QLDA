import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { TaskEditForm } from "@/components/task/task-edit-form"
import type { Task } from "@/app/types/table-types"

type Params = { id: string }

type TaskWithRelations = Task & {
  projects?: {
    name: string
  }
  users?: {
    full_name: string
    position?: string
    org_unit?: string
  }
}

export default async function EditTaskPage({ params }: { params: Params }) {
  const { id } = await params
  const supabase = await createClient()

  try {
    const { data: task, error } = (await supabase
      .from("tasks")
      .select(`
        *,
        users:assigned_to (
          full_name,
          position,
          org_unit
        ),
        projects (
          name
        )
      `)
      .eq("id", id)
      .single()) as { data: TaskWithRelations | null; error: any }

    if (error || !task) {
      notFound()
    }

    return (
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Chỉnh sửa công việc</h1>
          <p className="text-muted-foreground mt-2">Dự án: {task.projects?.name}</p>
        </div>

        <TaskEditForm initialData={task} projectId={task.project_id} />
      </div>
    )
  } catch (error) {
    console.error("Error in EditTaskPage:", error)
    notFound()
  }
}
