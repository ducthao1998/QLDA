import { TeamList } from "@/components/team-list"
import { Button } from "@/components/ui/button"
import { PlusIcon } from "lucide-react"
import Link from "next/link"

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Nhóm</h1>
        <Button asChild>
          <Link href="/dashboard/team/new">
            <PlusIcon className="mr-2 h-4 w-4" />
            Thêm Thành Viên
          </Link>
        </Button>
      </div>
      <TeamList />
    </div>
  )
}
