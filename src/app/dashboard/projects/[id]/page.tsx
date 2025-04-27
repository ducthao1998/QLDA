import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { ProjectDetails } from "@/components/project/project-details" 

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const supabase = await createClient()
  console.log("ALO??")
  // Lấy thông tin dự án
  const { data: project, error } = await supabase
  .from('projects')
  .select(`
    *,
    users!created_by (
      full_name,
      position,
      org_unit
    )
  `)
  .eq('id', id)
  .single()


  if (error || !project) {
    notFound()
  }

  return <ProjectDetails project={project} />
}
