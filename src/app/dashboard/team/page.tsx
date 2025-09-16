import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TeamList } from "@/components/team/team-list"
import { WorkloadDashboard } from "@/components/team/workload-dashboard"
import { UserPerformance } from "@/components/team/user-performance"
import { AddUserDialog } from "@/components/team/add-user-dialog"
import SkillFieldsManagement from "@/components/team/skill-matrix"
import { UsersIcon } from "lucide-react"

export default function PersonnelPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      {/* Gradient Hero */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 p-8 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <UsersIcon className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Quản Lý Nhân Sự</h1>
                  <p className="text-blue-100 mt-1">Quản lý đội ngũ, kỹ năng và phân công nhân sự</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AddUserDialog />
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="team" className="w-full">
        <TabsList className="mb-4 grid grid-cols-2 w-full md:w-auto md:grid-cols-2">
          <TabsTrigger value="team">Danh Sách Nhân Sự</TabsTrigger>
          <TabsTrigger value="skills">Ma Trận Kỹ Năng</TabsTrigger>
          {/* <TabsTrigger value="workload">Phân Tích Khối Lượng Công Việc</TabsTrigger>
          <TabsTrigger value="performance">Hiệu Suất Nhân Sự</TabsTrigger> */}
        </TabsList>
        <TabsContent value="team">
          <TeamList />
        </TabsContent>
        <TabsContent value="skills">
          <SkillFieldsManagement />
        </TabsContent>
        {/* <TabsContent value="workload">
          <WorkloadDashboard />
        </TabsContent>
        <TabsContent value="performance">
          <UserPerformance />
        </TabsContent> */}
      </Tabs>
    </div>
  )
}
