"use client"

import type React from "react"
import { useState, Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import {
  CalendarIcon,
  FileEditIcon,
  UsersIcon,
  BarChart4Icon,
  AlertTriangleIcon,
  CheckCircleIcon,
  PauseCircleIcon,
  ClipboardListIcon,
  InfoIcon,
  FolderKanban,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProjectTasks } from "@/components/project/project-tasks"
import { ProjectRaci } from "@/components/project/project-raci"
import { toast } from "sonner"
import type { Project as BaseProject } from "@/app/types/table-types"
import { LoadingSpinner } from "@/components/ui/loading"
import type { UserPermissions } from "@/lib/permissions"

// Mở rộng kiểu Project để bao gồm thông tin user được join
type Project = BaseProject & {
  users?: {
    full_name: string | null
    position: string | null
    org_unit: string | null
  } | null
}

interface ProjectPhase {
  id: string
  project_id: string
  name: string
  description: string
  order_no: number
  status: string
  created_at: string
  updated_at: string
}

interface ProjectDetailsProps {
  projectId: string
  initialProject?: Project
  initialPhases?: ProjectPhase[]
  userPermissions: UserPermissions
}

const statusMap: Record<
  string,
  {
    label: string
    variant: "default" | "secondary" | "destructive" | "outline"
    color: string
    icon: React.ReactNode
  }
> = {
  planning: {
    label: "Lập kế hoạch",
    variant: "secondary",
    color: "bg-gray-100 text-gray-800",
    icon: <ClipboardListIcon className="h-4 w-4" />,
  },
  in_progress: {
    label: "Đang thực hiện",
    variant: "default",
    color: "bg-green-100 text-green-800",
    icon: <BarChart4Icon className="h-4 w-4" />,
  },
  on_hold: {
    label: "Tạm dừng",
    variant: "outline",
    color: "bg-amber-100 text-amber-800",
    icon: <PauseCircleIcon className="h-4 w-4" />,
  },
  completed: {
    label: "Hoàn thành",
    variant: "default",
    color: "bg-emerald-100 text-emerald-800",
    icon: <CheckCircleIcon className="h-4 w-4" />,
  },
  archived: {
    label: "Lưu trữ",
    variant: "secondary",
    color: "bg-gray-200 text-gray-600",
    icon: <AlertTriangleIcon className="h-4 w-4" />,
  },
  cancelled: {
    label: "Đã hủy",
    variant: "destructive",
    color: "bg-red-100 text-red-800",
    icon: <AlertTriangleIcon className="h-4 w-4" />,
  },
}

export function ProjectDetails({ projectId, initialProject, initialPhases, userPermissions }: ProjectDetailsProps) {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ProjectDetailsContent
        projectId={projectId}
        initialProject={initialProject}
        initialPhases={initialPhases}
        userPermissions={userPermissions}
      />
    </Suspense>
  )
}

function ProjectDetailsContent({ projectId, initialProject, initialPhases, userPermissions }: ProjectDetailsProps) {
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(initialProject || null)
  const [phases, setPhases] = useState<ProjectPhase[]>(initialPhases || [])
  const [isLoading, setIsLoading] = useState(!initialProject)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchProject = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/projects/${projectId}`)
      if (!response.ok) {
        throw new Error("Không thể tải thông tin dự án")
      }
      const data = await response.json()
      setProject(data.project)
    } catch (error) {
      console.error("Lỗi khi tải dự án:", error)
      toast.error("Lỗi", {
        description: "Không thể tải thông tin dự án.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchPhases = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/phases`)
      if (!response.ok) {
        throw new Error("Không thể tải các giai đoạn")
      }
      const data = await response.json()
      setPhases(data.phases || [])
    } catch (error) {
      console.error("Lỗi khi tải giai đoạn:", error)
      toast.error("Lỗi", {
        description: "Không thể tải danh sách giai đoạn.",
      })
      setPhases([])
    }
  }

  useEffect(() => {
    if (!initialProject) {
      fetchProject()
    }
    if (!initialPhases) {
      fetchPhases()
    }
  }, [projectId])

  async function handleDelete() {
    try {
      setIsDeleting(true)
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Có lỗi xảy ra khi xóa dự án")
      }
      toast.success("Xóa dự án thành công")
      router.push("/dashboard/projects")
      router.refresh()
    } catch (error) {
      toast.error("Lỗi", {
        description: error instanceof Error ? error.message : "Có lỗi xảy ra khi xóa dự án",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading || !project) {
    return <LoadingSpinner />
  }

  const statusInfo = statusMap[project.status] || {
    label: project.status,
    color: "bg-gray-100 text-gray-800",
    icon: <InfoIcon className="h-4 w-4" />,
  }
  const creatorInfo = project.users

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground mt-2">{project.description}</p>
        </div>
        {userPermissions.canEditProject && (
          <Button asChild>
            <Link href={`/dashboard/projects/${projectId}/edit`}>
              <FileEditIcon className="mr-2 h-4 w-4" />
              Chỉnh sửa
            </Link>
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          {userPermissions.canViewTasks && <TabsTrigger value="tasks">Công việc</TabsTrigger>}
          {userPermissions.canViewTeam && <TabsTrigger value="team">Đội ngũ</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Trạng thái</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={statusInfo.color}>
                  <span className="flex items-center gap-1.5">
                    {statusInfo.icon}
                    {statusInfo.label}
                  </span>
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Ngày bắt đầu</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm text-muted-foreground">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  <span>
                    {project.start_date ? format(new Date(project.start_date), "dd/MM/yyyy", { locale: vi }) : "Chưa xác định"}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Người tạo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center text-sm">
                  <UsersIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>{creatorInfo?.full_name || "Không xác định"}</span>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  {creatorInfo?.position && creatorInfo?.org_unit
                    ? `${creatorInfo.position}, ${creatorInfo.org_unit}`
                    : creatorInfo?.position || creatorInfo?.org_unit || ""}
                </p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Thông tin chi tiết</CardTitle>
              <CardDescription>Các thông tin phân loại của dự án.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center text-sm">
                <FolderKanban className="h-4 w-4 mr-2 text-muted-foreground" />
                <strong>Địa điểm thực hiện:</strong>
                <span className="ml-2">{project.project_field || "Chưa xác định"}</span>
              </div>
              <div className="flex items-center text-sm">
                <InfoIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                <strong>Phân loại:</strong>
                <span className="ml-2">
                  {project.classification ? `Nhóm ${project.classification}` : "Chưa xác định"}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <InfoIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                <strong>Tổng mức đầu tư:</strong>
                <span className="ml-2">{(project as any).total_investment || "Chưa xác định"}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        {userPermissions.canViewTasks && (
          <TabsContent value="tasks">
            <ProjectTasks projectId={project.id} />
          </TabsContent>
        )}

        {userPermissions.canViewTeam && (
          <TabsContent value="team">
            <ProjectRaci projectId={project.id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
