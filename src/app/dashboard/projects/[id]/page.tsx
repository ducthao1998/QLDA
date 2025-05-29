import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
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

  // Check if user has access to this project
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    redirect('/login')
  }

  const { data: currentUser } = await supabase
    .from('users')
    .select('org_unit, position')
    .eq('id', authUser.id)
    .single()

  if (!currentUser || currentUser.org_unit !== project.users.org_unit) {
    redirect('/dashboard/projects')
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

  const userPermissions = {
    canEdit: currentUser.position.toLowerCase() === "quản lý",
    canDelete: currentUser.position.toLowerCase() === "quản lý"
  }

  return <ProjectDetails 
    projectId={id} 
    initialProject={project} 
    initialPhases={phases || []} 
    userPermissions={userPermissions}
  />
}

