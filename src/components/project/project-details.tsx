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
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 p-8 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <FolderKanban className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
                  <p className="text-blue-100 mt-1">{project.description}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <UsersIcon className="h-4 w-4" />
                  <span>{creatorInfo?.full_name || "Không xác định"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  <span>
                    Bắt đầu: {project.start_date ? format(new Date(project.start_date), "dd/MM/yyyy", { locale: vi }) : "Chưa xác định"}
                  </span>
                </div>
                <Badge 
                  variant="secondary" 
                  className="bg-white/20 text-white border-white/30 hover:bg-white/30"
                >
                  <span className="flex items-center gap-1.5">
                    {statusInfo.icon}
                    {statusInfo.label}
                  </span>
                </Badge>
              </div>
            </div>
            
            {userPermissions.canEditProject && (
              <Button variant="secondary" asChild className="bg-white/20 hover:bg-white/30 text-white border-white/30">
                <Link href={`/dashboard/projects/${projectId}/edit`}>
                  <FileEditIcon className="mr-2 h-4 w-4" />
                  Chỉnh sửa
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Trạng thái</p>
                <p className="text-xl font-bold text-green-900">{statusInfo.label}</p>
              </div>
              <div className="h-10 w-10 bg-green-500 rounded-lg flex items-center justify-center">
                {statusInfo.icon}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Ngày bắt đầu</p>
                <p className="text-xl font-bold text-blue-900">
                  {project.start_date ? format(new Date(project.start_date), "dd/MM/yyyy", { locale: vi }) : "Chưa xác định"}
                </p>
              </div>
              <div className="h-10 w-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <CalendarIcon className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Người tạo</p>
                <p className="text-xl font-bold text-purple-900">{creatorInfo?.full_name || "Không xác định"}</p>
              </div>
              <div className="h-10 w-10 bg-purple-500 rounded-lg flex items-center justify-center">
                <UsersIcon className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600">Phân loại</p>
                <p className="text-xl font-bold text-amber-900">
                  {project.classification ? `Nhóm ${project.classification}` : "Chưa xác định"}
                </p>
              </div>
              <div className="h-10 w-10 bg-amber-500 rounded-lg flex items-center justify-center">
                <InfoIcon className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <InfoIcon className="h-4 w-4" />
            Tổng quan
          </TabsTrigger>
          {userPermissions.canViewTasks && (
            <TabsTrigger value="tasks" className="flex items-center gap-2">
              <ClipboardListIcon className="h-4 w-4" />
              Công việc
            </TabsTrigger>
          )}
          {/* {userPermissions.canViewTeam && (
            <TabsTrigger value="team" className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4" />
              Đội ngũ
            </TabsTrigger>
          )} */}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderKanban className="h-5 w-5" />
                  Thông tin dự án
                </CardTitle>
                <CardDescription>Chi tiết về dự án và phân loại</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FolderKanban className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Địa điểm thực hiện</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{project.project_field || "Chưa xác định"}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <InfoIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Phân loại</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {project.classification ? `Nhóm ${project.classification}` : "Chưa xác định"}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <InfoIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Tổng mức đầu tư</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{(project as any).total_investment || "Chưa xác định"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UsersIcon className="h-5 w-5" />
                  Thông tin người tạo
                </CardTitle>
                <CardDescription>Chi tiết về người tạo dự án</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
                  <div className="h-12 w-12 bg-blue-500 rounded-full flex items-center justify-center">
                    <UsersIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{creatorInfo?.full_name || "Không xác định"}</p>
                    <p className="text-sm text-gray-600">
                      {creatorInfo?.position && creatorInfo?.org_unit
                        ? `${creatorInfo.position}, ${creatorInfo.org_unit}`
                        : creatorInfo?.position || creatorInfo?.org_unit || "Chưa có thông tin"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>


        {userPermissions.canViewTasks && (
          <TabsContent value="tasks">
            <ProjectTasks projectId={project.id} />
          </TabsContent>
        )}
{/* 
        {userPermissions.canViewTeam && (
          <TabsContent value="team">
            <ProjectRaci projectId={project.id} />
          </TabsContent>
        )} */}
      </Tabs>
    </div>
  )
}
