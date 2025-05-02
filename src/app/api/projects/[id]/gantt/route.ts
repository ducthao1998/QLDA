import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  try {
    const { id: projectId } = params

    // Lấy thông tin dự án
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, description, status, start_date, end_date")
      .eq("id", projectId)
      .single()

    if (projectError) {
      throw projectError
    }

    // Lấy danh sách công việc của dự án
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        id, 
        name, 
        status, 
        start_date, 
        end_date, 
        phase_id,
        assigned_to,
        note,
        unit_in_charge,
        legal_basis,
        max_retries,
        users:assigned_to (
          id,
          full_name,
          position,
          org_unit
        )
      `)
      .eq("project_id", projectId)
      .order("start_date", { ascending: true })

    if (tasksError) {
      throw tasksError
    }

    // Lấy danh sách phụ thuộc giữa các công việc
    const { data: dependencies, error: dependenciesError } = await supabase
      .from("task_dependencies")
      .select("task_id, depends_on_id")
      .in(
        "task_id",
        tasks.map((task) => task.id),
      )

    if (dependenciesError) {
      throw dependenciesError
    }

    // Lấy danh sách giai đoạn của dự án
    const { data: phases, error: phasesError } = await supabase
      .from("project_phases")
      .select("id, name, order_no")
      .eq("project_id", projectId)
      .order("order_no", { ascending: true })

    if (phasesError) {
      throw phasesError
    }

    // Lấy danh sách kỹ năng của các công việc
    const { data: taskSkills, error: taskSkillsError } = await supabase
      .from("task_skills")
      .select("task_id, skill_id, skills(id, name)")
      .in(
        "task_id",
        tasks.map((task) => task.id),
      )

    if (taskSkillsError) {
      throw taskSkillsError
    }

    // Lấy danh sách RACI của các công việc
    const { data: raciData, error: raciError } = await supabase
      .from("task_raci")
      .select(`
        task_id, 
        user_id, 
        role,
        users:user_id (
          id,
          full_name,
          position,
          org_unit
        )
      `)
      .in(
        "task_id",
        tasks.map((task) => task.id),
      )

    if (raciError) {
      throw raciError
    }

    // Xử lý dữ liệu để thêm thông tin phụ thuộc và kỹ năng vào công việc
    const tasksWithDependencies = tasks.map((task) => {
      const taskDependencies = dependencies.filter((dep) => dep.task_id === task.id).map((dep) => dep.depends_on_id)

      const skills = taskSkills.filter((skill) => skill.task_id === task.id).map((skill) => skill.skills)

      const raci = raciData.filter((r) => r.task_id === task.id)

      return {
        ...task,
        dependencies: taskDependencies,
        skills,
        raci,
      }
    })

    return NextResponse.json({
      project,
      tasks: tasksWithDependencies,
      phases,
    })
  } catch (error) {
    console.error("Error fetching gantt data:", error)
    return NextResponse.json({ error: "Không thể lấy dữ liệu biểu đồ Gantt" }, { status: 500 })
  }
}
