import { ProjectForm } from "@/components/project/project-form"

export default function NewProjectPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tạo Dự Án Mới</h1>
        <p className="text-muted-foreground mt-2">Điền thông tin chi tiết để tạo dự án mới</p>
      </div>
      <ProjectForm />
    </div>
  )
}
