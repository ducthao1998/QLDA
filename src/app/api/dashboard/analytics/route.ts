import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const period = searchParams.get("period") || "30d"
    const orgUnit = searchParams.get("org_unit") || "all"

    // Mock data for demonstration - replace with actual database queries
    const mockData = {
      overview: {
        total_projects: 24,
        active_projects: 18,
        total_tasks: 156,
        completed_tasks: 89,
        overdue_tasks: 12,
        users_count: 32,
        completion_rate: 57.1,
        on_time_rate: 84.2,
      },
      task_statistics: {
        by_status: [
          { status: "Hoàn thành", count: 89, percentage: 57.1 },
          { status: "Đang thực hiện", count: 34, percentage: 21.8 },
          { status: "Chờ xử lý", count: 21, percentage: 13.5 },
          { status: "Quá hạn", count: 12, percentage: 7.7 },
        ],
        by_template: [
          { template_name: "Nghiên cứu", count: 45, avg_duration: 12.5 },
          { template_name: "Phát triển", count: 38, avg_duration: 18.2 },
          { template_name: "Kiểm thử", count: 28, avg_duration: 8.7 },
          { template_name: "Triển khai", count: 25, avg_duration: 15.3 },
          { template_name: "Bảo trì", count: 20, avg_duration: 6.8 },
        ],
        by_phase: [
          { phase_name: "Khởi tạo", count: 32, completion_rate: 78.1 },
          { phase_name: "Lập kế hoạch", count: 28, completion_rate: 64.3 },
          { phase_name: "Thực hiện", count: 56, completion_rate: 48.2 },
          { phase_name: "Giám sát", count: 24, completion_rate: 66.7 },
          { phase_name: "Kết thúc", count: 16, completion_rate: 87.5 },
        ],
        by_classification: [
          { classification: "A", count: 68, avg_progress: 72.4 },
          { classification: "B", count: 54, avg_progress: 58.9 },
          { classification: "C", count: 34, avg_progress: 45.2 },
        ],
      },
      user_statistics: {
        by_user: [
          {
            user_id: "1",
            full_name: "Nguyễn Văn An",
            position: "Trưởng phòng",
            org_unit: "Phòng CNTT",
            total_tasks: 15,
            completed_tasks: 12,
            in_progress_tasks: 2,
            overdue_tasks: 1,
            completion_rate: 80.0,
            avg_task_duration: 14.2,
            workload_score: 75,
          },
          {
            user_id: "2",
            full_name: "Trần Thị Bình",
            position: "Chuyên viên",
            org_unit: "Phòng Nhân sự",
            total_tasks: 12,
            completed_tasks: 9,
            in_progress_tasks: 3,
            overdue_tasks: 0,
            completion_rate: 75.0,
            avg_task_duration: 11.8,
            workload_score: 65,
          },
          {
            user_id: "3",
            full_name: "Lê Văn Cường",
            position: "Kỹ sư",
            org_unit: "Phòng CNTT",
            total_tasks: 18,
            completed_tasks: 14,
            in_progress_tasks: 3,
            overdue_tasks: 1,
            completion_rate: 77.8,
            avg_task_duration: 16.5,
            workload_score: 85,
          },
        ],
        skills_utilization: [
          { skill_name: "Lập trình", skill_field: "CNTT", users_count: 8, tasks_count: 45, utilization_rate: 78.2 },
          {
            skill_name: "Quản lý dự án",
            skill_field: "Quản lý",
            users_count: 5,
            tasks_count: 32,
            utilization_rate: 65.4,
          },
          { skill_name: "Thiết kế", skill_field: "Sáng tạo", users_count: 6, tasks_count: 28, utilization_rate: 58.9 },
          {
            skill_name: "Phân tích",
            skill_field: "Nghiên cứu",
            users_count: 4,
            tasks_count: 24,
            utilization_rate: 72.1,
          },
        ],
        workload_distribution: [
          { org_unit: "Phòng CNTT", total_users: 12, total_tasks: 68, avg_workload: 5.7, completion_rate: 74.2 },
          { org_unit: "Phòng Nhân sự", total_users: 8, total_tasks: 42, avg_workload: 5.3, completion_rate: 69.8 },
          { org_unit: "Phòng Tài chính", total_users: 6, total_tasks: 28, avg_workload: 4.7, completion_rate: 82.1 },
          { org_unit: "Phòng Hành chính", total_users: 6, total_tasks: 18, avg_workload: 3.0, completion_rate: 88.9 },
        ],
      },
      time_statistics: {
        monthly_trends: [
          { month: "T1/2024", completed_tasks: 28, created_tasks: 35, overdue_tasks: 3, completion_rate: 80.0 },
          { month: "T2/2024", completed_tasks: 32, created_tasks: 38, overdue_tasks: 2, completion_rate: 84.2 },
          { month: "T3/2024", completed_tasks: 29, created_tasks: 42, overdue_tasks: 4, completion_rate: 69.0 },
          { month: "T4/2024", completed_tasks: 35, created_tasks: 41, overdue_tasks: 3, completion_rate: 85.4 },
        ],
        weekly_productivity: [
          { week: "T1", productivity_score: 78.5, tasks_completed: 8, avg_completion_time: 12.3 },
          { week: "T2", productivity_score: 82.1, tasks_completed: 9, avg_completion_time: 11.8 },
          { week: "T3", productivity_score: 75.9, tasks_completed: 7, avg_completion_time: 13.2 },
          { week: "T4", productivity_score: 88.2, tasks_completed: 11, avg_completion_time: 10.5 },
        ],
        deadline_performance: [
          { period: "T1", on_time: 25, late: 3, early: 2, on_time_rate: 83.3 },
          { period: "T2", on_time: 28, late: 2, early: 2, on_time_rate: 87.5 },
          { period: "T3", on_time: 22, late: 4, early: 3, on_time_rate: 75.9 },
          { period: "T4", on_time: 31, late: 2, early: 2, on_time_rate: 88.6 },
        ],
      },
      advanced_analytics: {
        bottlenecks: [
          {
            type: "Thiếu nhân lực chuyên môn",
            description: "Phòng CNTT đang thiếu 2-3 lập trình viên có kinh nghiệm",
            impact_score: 85,
            affected_tasks: 12,
            recommendations: [
              "Tuyển dụng thêm 2 lập trình viên senior",
              "Đào tạo nâng cao cho nhân viên hiện tại",
              "Thuê ngoài một số công việc không cốt lõi",
            ],
          },
          {
            type: "Quy trình phê duyệt chậm",
            description: "Thời gian chờ phê duyệt trung bình 3-5 ngày",
            impact_score: 72,
            affected_tasks: 8,
            recommendations: [
              "Số hóa quy trình phê duyệt",
              "Phân quyền phê duyệt cho cấp trung",
              "Thiết lập SLA cho từng loại phê duyệt",
            ],
          },
        ],
        predictions: {
          project_completion_forecast: [
            {
              project_name: "Hệ thống quản lý nhân sự",
              predicted_completion: "2024-06-15",
              confidence: 87,
              risk_factors: ["Thiếu tester", "Yêu cầu thay đổi"],
            },
            {
              project_name: "Website doanh nghiệp",
              predicted_completion: "2024-05-20",
              confidence: 92,
              risk_factors: ["Phụ thuộc bên thứ 3"],
            },
          ],
          resource_needs: [
            { skill_name: "Lập trình Frontend", current_capacity: 4, predicted_demand: 6, gap: 2 },
            { skill_name: "Quản lý dự án", current_capacity: 3, predicted_demand: 4, gap: 1 },
            { skill_name: "UI/UX Design", current_capacity: 2, predicted_demand: 2, gap: 0 },
          ],
        },
        kpis: {
          efficiency_score: 78.5,
          quality_score: 82.1,
          resource_utilization: 75.9,
          customer_satisfaction: 88.2,
          innovation_index: 65.4,
        },
      },
    }

    return NextResponse.json(mockData)
  } catch (error: any) {
    console.error("Error in GET /api/dashboard/analytics:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
