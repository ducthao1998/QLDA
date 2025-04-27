import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { ProjectForm } from "@/components/project/project-form"

export default async function EditProjectPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  // Lấy thông tin dự án
  const { data: project, error } = await supabase.from("projects").select("*").eq("id", params.id).single()

  if (error || !project) {
    notFound()
  }

  // Chuyển đổi định dạng ngày tháng cho form
  const formattedProject = {
    ...project,
    start_date: new Date(project.start_date),
    deadline: new Date(project.deadline),
    priority: project.priority.toString(),
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Chỉnh Sửa Dự Án</h1>
        <p className="text-muted-foreground mt-2">Cập nhật thông tin dự án</p>
      </div>
      <ProjectForm project={formattedProject} />
    </div>
  )
}
