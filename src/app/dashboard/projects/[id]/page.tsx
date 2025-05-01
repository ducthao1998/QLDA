  import { createClient } from "@/lib/supabase/server"
  import { notFound } from "next/navigation"
  import { ProjectDetails } from "@/components/project/project-details" 

  export default async function ProjectPage({ params }: { params: { id: string } }) {
    const supabase = await createClient()
    const { id } = await params

    // Lấy thông tin dự án
    const { data: project, error: projectError } = await supabase
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

    if (projectError || !project) {
      notFound()
    }

    // Lấy danh sách phase của dự án
    const { data: phases, error: phasesError } = await supabase
      .from('project_phases')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: true })

    if (phasesError) {
      console.error('Error fetching phases:', phasesError)
    }

    return <ProjectDetails projectId={id} initialProject={project} initialPhases={phases || []} />
  }

