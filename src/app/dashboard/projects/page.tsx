import { ProjectsList } from "@/components/projects-list"
import { Button } from "@/components/ui/button"
import { PlusIcon } from "lucide-react"
import Link from "next/link"

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dự Án</h1>
        <Button asChild>
          <Link href="/dashboard/projects/new">
            <PlusIcon className="mr-2 h-4 w-4" />
            Dự Án Mới
          </Link>
        </Button>
      </div>
      <ProjectsList />
    </div>
  )
}
