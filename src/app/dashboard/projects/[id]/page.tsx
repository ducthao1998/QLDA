import { createClient } from "@/lib/supabase/server"
import { notFound, redirect } from "next/navigation"
import { ProjectDetails } from "@/components/project/project-details"
import { ProjectBoard } from "@/components/project/project-board"
import { getUserPermissions } from "@/lib/permissions"

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await params

  // Lấy thông tin dự án
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(`
      *,
      users!created_by (
        full_name,
        position,
        org_unit
      )
    `)
    .eq("id", id)
    .single()

  if (projectError || !project) {
    notFound()
  }

  // Check if user has access to this project
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) {
    redirect("/login")
  }

  // FIX: Removed updated_at column that doesn't exist
  const { data: currentUser } = await supabase
    .from("users")
    .select("id, email, phone_number, created_at, org_unit, position, full_name")
    .eq("id", authUser.id)
    .single()

  if (!currentUser) {
    redirect("/dashboard/projects")
  }

  // Lấy permissions dựa trên position
  const userPermissions = getUserPermissions(currentUser.position)

  // Lấy danh sách phase của dự án
  const { data: phases, error: phasesError } = await supabase
    .from("project_phases")
    .select("*")
    .eq("project_id", id)
    .order("order_no", { ascending: true })

  if (phasesError) {
    console.error("Error fetching phases:", phasesError)
  }

  // Render component khác nhau dựa trên viewMode
  if (userPermissions.viewMode === "board") {
    return (
      <ProjectBoard
        projectId={id}
        initialProject={project}
        initialPhases={phases || []}
        userPermissions={userPermissions}
        currentUser={currentUser}
      />
    )
  }

  // Render giao diện admin cho quản lý
  return (
    <ProjectDetails
      projectId={id}
      initialProject={project}
      initialPhases={[]}
      userPermissions={userPermissions}
    />
  )
}