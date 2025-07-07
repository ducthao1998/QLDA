"use client"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Shield,
  User,
  Briefcase,
  Award,
  Calendar,
  Phone,
  Mail,
  Edit,
  Save,
  X,
  TrendingUp,
  Clock,
  CheckCircle,
  Key,
  BarChart3,
  Target,
  Building,
  Star,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { createClient } from "@/lib/supabase/client"


interface UserProfile {
  id: string
  full_name: string
  position: string
  org_unit: string
  email: string
  phone_number: string | null
  created_at: string
  updated_at: string
}

interface UserStats {
  total_projects: number
  total_tasks: number
  completed_tasks: number
  in_progress_tasks: number
  completion_rate: number
  on_time_rate: number
}

interface UserSkill {
  skill_id: number
  skill_name: string
  skill_field: string | null
  completed_tasks_count: number
  total_experience_days: number | null
  last_activity_date: string | null
}

interface RecentProject {
  id: string
  name: string
  classification: string | null
  status: string
  role: string
  tasks_assigned: number
  tasks_completed: number
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [skills, setSkills] = useState<UserSkill[]>([])
  const [projects, setProjects] = useState<RecentProject[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>({})
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  useEffect(() => {
    fetchProfileData()
  }, [])

  const fetchProfileData = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) throw new Error("Not authenticated")

      // Fetch user profile
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single()

      if (userError) throw userError
      setProfile(userData)

      // Fetch user statistics
      const statsResponse = await fetch(`/api/profile/stats`)
      if (!statsResponse.ok) throw new Error("Failed to fetch stats")
      const statsData = await statsResponse.json()
      setStats(statsData.stats)

      // Fetch user skills
      const skillsResponse = await fetch(`/api/profile/skills`)
      if (!skillsResponse.ok) throw new Error("Failed to fetch skills")
      const skillsData = await skillsResponse.json()
      setSkills(skillsData.skills || [])

      // Fetch recent projects
      const projectsResponse = await fetch(`/api/profile/projects`)
      if (!projectsResponse.ok) throw new Error("Failed to fetch projects")
      const projectsData = await projectsResponse.json()
      setProjects(projectsData.projects || [])

    } catch (error) {
      console.error("Error fetching profile:", error)
      toast.error("Lỗi khi tải thông tin cá nhân")
    } finally {
      setLoading(false)
    }
  }

  const handleEditProfile = () => {
    if (profile) {
      setEditedProfile({
        full_name: profile.full_name,
        phone_number: profile.phone_number,
      })
      setIsEditing(true)
    }
  }

  const handleSaveProfile = async () => {
    try {
      const response = await fetch("/api/profile/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedProfile),
      })

      if (!response.ok) throw new Error("Failed to update profile")

      toast.success("Cập nhật thông tin thành công")
      setIsEditing(false)
      fetchProfileData()
    } catch (error) {
      console.error("Error updating profile:", error)
      toast.error("Lỗi khi cập nhật thông tin")
    }
  }

  const handleChangePassword = async () => {
    try {
      // Validate passwords
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        toast.error("Mật khẩu mới không khớp")
        return
      }

      if (passwordData.newPassword.length < 6) {
        toast.error("Mật khẩu mới phải có ít nhất 6 ký tự")
        return
      }

      const response = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to change password")
      }

      toast.success("Đổi mật khẩu thành công")
      setChangePasswordOpen(false)
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    } catch (error: any) {
      console.error("Error changing password:", error)
      toast.error(error.message || "Lỗi khi đổi mật khẩu")
    }
  }

  const getPositionBadge = (position: string) => {
    const colors: Record<string, string> = {
      "quản lý": "bg-red-500",
      "chỉ huy": "bg-blue-500",
      "cán bộ": "bg-green-500",
    }
    return colors[position.toLowerCase()] || "bg-gray-500"
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return <div>Không tìm thấy thông tin người dùng</div>
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Thông tin cá nhân</h1>
        <div className="flex gap-2">
          <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Key className="h-4 w-4 mr-2" />
                Đổi mật khẩu
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Đổi mật khẩu</DialogTitle>
                <DialogDescription>
                  Nhập mật khẩu hiện tại và mật khẩu mới để thay đổi
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, currentPassword: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="newPassword">Mật khẩu mới</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, newPassword: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setChangePasswordOpen(false)}>
                  Hủy
                </Button>
                <Button onClick={handleChangePassword}>Đổi mật khẩu</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {!isEditing ? (
            <Button onClick={handleEditProfile}>
              <Edit className="h-4 w-4 mr-2" />
              Chỉnh sửa
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                <X className="h-4 w-4 mr-2" />
                Hủy
              </Button>
              <Button onClick={handleSaveProfile}>
                <Save className="h-4 w-4 mr-2" />
                Lưu
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${profile.full_name}`} />
              <AvatarFallback>{profile.full_name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 grid gap-4">
              <div>
                <h2 className="text-2xl font-bold">
                  {isEditing ? (
                    <Input
                      value={editedProfile.full_name}
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile, full_name: e.target.value })
                      }
                    />
                  ) : (
                    profile.full_name
                  )}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={getPositionBadge(profile.position)}>
                    <Shield className="h-3 w-3 mr-1" />
                    {profile.position}
                  </Badge>
                  <Badge variant="outline">
                    <Building className="h-3 w-3 mr-1" />
                    {profile.org_unit}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="text-sm">Email</span>
                  </div>
                  <p className="font-medium">{profile.email}</p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span className="text-sm">Số điện thoại</span>
                  </div>
                  {isEditing ? (
                    <Input
                      value={editedProfile.phone_number || ""}
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile, phone_number: e.target.value })
                      }
                      placeholder="Nhập số điện thoại"
                    />
                  ) : (
                    <p className="font-medium">{profile.phone_number || "Chưa cập nhật"}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">Ngày tham gia</span>
                  </div>
                  <p className="font-medium">
                    {profile.created_at && !isNaN(new Date(profile.created_at).getTime())
                      ? format(new Date(profile.created_at), "dd/MM/yyyy", { locale: vi })
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics & Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
          <TabsTrigger value="skills">Kỹ năng</TabsTrigger>
          <TabsTrigger value="projects">Dự án</TabsTrigger>
          <TabsTrigger value="performance">Hiệu suất</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Tổng dự án</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total_projects}</div>
                  <p className="text-xs text-muted-foreground">Đã tham gia</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Công việc</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total_tasks}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.in_progress_tasks} đang thực hiện
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Tỷ lệ hoàn thành</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.completion_rate.toFixed(1)}%</div>
                  <Progress value={stats.completion_rate} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Đúng hạn</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.on_time_rate.toFixed(1)}%</div>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Tỷ lệ đúng deadline</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Thông tin hệ thống</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">User ID</span>
                <code className="text-sm">{profile.id}</code>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Cập nhật lần cuối</span>
                <span>{profile.updated_at && !isNaN(new Date(profile.updated_at).getTime())
                  ? format(new Date(profile.updated_at), "dd/MM/yyyy HH:mm", { locale: vi })
                  : "N/A"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Quyền hạn</span>
                <Badge variant={profile.position.toLowerCase() === "quản lý" ? "default" : "secondary"}>
                  {profile.position.toLowerCase() === "quản lý" ? "Quản trị viên" : 
                   profile.position.toLowerCase() === "chỉ huy" ? "Chỉ huy" : "Cán bộ"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Skills Tab */}
        <TabsContent value="skills" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ma trận kỹ năng</CardTitle>
              <CardDescription>
                Các kỹ năng và kinh nghiệm qua các công việc đã hoàn thành
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {skills.length > 0 ? (
                  skills.map((skill) => (
                    <div key={skill.skill_id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{skill.skill_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {skill.skill_field || "Chưa phân loại"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{skill.completed_tasks_count} công việc</p>
                          {skill.last_activity_date && !isNaN(new Date(skill.last_activity_date).getTime()) && (
                            <p className="text-xs text-muted-foreground">
                              Lần cuối: {format(new Date(skill.last_activity_date), "dd/MM/yyyy", { locale: vi })}
                            </p>
                          )}
                        </div>
                      </div>
                      <Progress value={Math.min(100, skill.completed_tasks_count * 10)} />
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Chưa có dữ liệu kỹ năng
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dự án gần đây</CardTitle>
              <CardDescription>
                Các dự án đã và đang tham gia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {projects.length > 0 ? (
                  projects.map((project) => (
                    <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium">{project.name}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{project.role}</Badge>
                          {project.classification && (
                            <Badge variant="secondary">Nhóm {project.classification}</Badge>
                          )}
                          <Badge variant={project.status === "active" ? "default" : "secondary"}>
                            {project.status === "active" ? "Đang hoạt động" : "Đã kết thúc"}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {project.tasks_completed}/{project.tasks_assigned} công việc
                        </p>
                        <Progress 
                          value={project.tasks_assigned > 0 ? (project.tasks_completed / project.tasks_assigned) * 100 : 0} 
                          className="w-20"
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Chưa tham gia dự án nào
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Chỉ số hiệu suất
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Tỷ lệ hoàn thành</span>
                    <span className="font-medium">{stats?.completion_rate.toFixed(1)}%</span>
                  </div>
                  <Progress value={stats?.completion_rate || 0} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Đúng deadline</span>
                    <span className="font-medium">{stats?.on_time_rate.toFixed(1)}%</span>
                  </div>
                  <Progress value={stats?.on_time_rate || 0} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Đánh giá
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <div className="flex justify-center gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-6 w-6 ${
                          star <= 4 ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-2xl font-bold">4.0/5.0</p>
                  <p className="text-sm text-muted-foreground mt-1">Đánh giá trung bình</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Thống kê chi tiết</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Công việc hoàn thành</span>
                  </div>
                  <span className="font-medium">{stats?.completed_tasks || 0}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span>Đang thực hiện</span>
                  </div>
                  <span className="font-medium">{stats?.in_progress_tasks || 0}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-500" />
                    <span>Tổng công việc</span>
                  </div>
                  <span className="font-medium">{stats?.total_tasks || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}