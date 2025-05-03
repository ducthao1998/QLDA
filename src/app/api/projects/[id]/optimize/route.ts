import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { optimizeSchedule } from "@/algorithm/schedule-optimizer"
import type { Task } from "@/algorithm/critical-path"

interface TaskSkill {
  task_id: string;
  skill: {
    id: string;
    name: string;
  };
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const projectId = params.id
  const body = await request.json()
  const { algorithm = "cpm", objective = "time" } = body

  try {
    // Lấy thông tin dự án
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, start_date, end_date")
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
        max_retries
      `)
      .eq("project_id", projectId)

    if (tasksError) {
      throw tasksError
    }

    // Lấy danh sách kỹ năng của các công việc
    const { data: taskSkills, error: taskSkillsError } = await supabase
      .from("task_skills")
      .select(`
        task_id,
        skill:skills (
          id,
          name
        )
      `)
      .in(
        "task_id",
        tasks.map((task) => task.id),
      ) as { data: TaskSkill[] | null, error: any }

    if (taskSkillsError) {
      throw taskSkillsError
    }

    if (!taskSkills) {
      throw new Error("Không thể lấy thông tin kỹ năng của công việc")
    }

    // Lấy danh sách người dùng và kỹ năng của họ
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, full_name, position")

    if (usersError) {
      throw usersError
    }

    const { data: userSkills, error: userSkillsError } = await supabase
      .from("user_skills")
      .select("user_id, skill_id, level")

    if (userSkillsError) {
      throw userSkillsError
    }

    // Chuẩn bị dữ liệu đầu vào cho thuật toán tối ưu hóa
    const tasksWithDependencies = tasks.map((task) => {
      const skills = taskSkills
        .filter((skill) => skill.task_id === task.id)
        .map((skill) => ({
          id: skill.skill.id,
          name: skill.skill.name
        }))

      return {
        ...task,
        dependencies: [], // Không còn dependencies nữa
        skills,
      }
    })

    // Gọi thuật toán tối ưu hóa
    const optimizedSchedule = optimizeSchedule({
      project,
      tasks: tasksWithDependencies,
      users: users.map((user) => {
        const skills = userSkills.filter((skill) => skill.user_id === user.id)
        return {
          ...user,
          skills,
        }
      }),
      algorithm,
      objective,
    })

    // Lưu kết quả tối ưu hóa vào cơ sở dữ liệu
    const { data: scheduleRun, error: runError } = await supabase
      .from("schedule_runs")
      .insert({
        project_id: projectId,
        algorithm,
        objective,
        generated_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .select("id")
      .single()

    if (runError) {
      throw runError
    }

    // Lưu chi tiết lịch trình
    const scheduleDetails = optimizedSchedule.tasks.map((task: Task) => ({
      run_id: scheduleRun.id,
      task_id: task.id,
      start_ts: task.optimized_start,
      finish_ts: task.optimized_end,
      assigned_user: task.assigned_to,
    }))

    const { error: detailsError } = await supabase.from("schedule_details").insert(scheduleDetails)

    if (detailsError) {
      throw detailsError
    }

    return NextResponse.json({
      run_id: scheduleRun.id,
      schedule: optimizedSchedule,
    })
  } catch (error) {
    console.error("Error optimizing schedule:", error)
    return NextResponse.json({ error: "Không thể tối ưu hóa lịch trình" }, { status: 500 })
  }
}
