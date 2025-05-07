import { ProjectsList } from "@/components/project/projects-list"
import { Button } from "@/components/ui/button"
import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

export default async function ProjectsPage() {
  const supabase = await createClient()
  
  // Get current user's position
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) {
    return null
  }

  const { data: currentUser } = await supabase
    .from("users")
    .select("position")
    .eq("id", authUser.id)
    .single()

  const isManager = currentUser?.position?.toLowerCase() === "quản lý"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dự Án</h1>
        {isManager && (
          <Button asChild>
            <Link href="/dashboard/projects/new">
              <PlusIcon className="mr-2 h-4 w-4" />
              Dự Án Mới
            </Link>
          </Button>
        )}
      </div>
      <ProjectsList />
    </div>
  )
}
