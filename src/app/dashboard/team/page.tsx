import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TeamList } from "@/components/team/team-list"
import { SkillMatrix } from "@/components/team/skill-matrix"
import { WorkloadDashboard } from "@/components/team/workload-dashboard"
import { UserPerformance } from "@/components/team/user-performance"
import { AddUserDialog } from "@/components/team/add-user-dialog"

export default function PersonnelPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Quản Lý Nhân Sự</h1>
      </div>

      <Tabs defaultValue="team" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="team">Danh Sách Nhân Sự</TabsTrigger>
          <TabsTrigger value="skills">Ma Trận Kỹ Năng</TabsTrigger>
          {/* <TabsTrigger value="workload">Phân Tích Khối Lượng Công Việc</TabsTrigger>
          <TabsTrigger value="performance">Hiệu Suất Nhân Sự</TabsTrigger> */}
        </TabsList>
        <TabsContent value="team">
          <TeamList />
        </TabsContent>
        <TabsContent value="skills">
          <SkillMatrix />
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
