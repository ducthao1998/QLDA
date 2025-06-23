import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { optimizeSchedule } from "@/algorithm/schedule-optimizer"

interface TaskSkill {
  task_id: string;
  skill: {
    id: string;
    name: string;
  };
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id: projectId } = await params
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

    // Lấy danh sách task dependencies
    const { data: taskDependencies, error: dependenciesError } = await supabase
      .from("task_dependencies")
      .select(`
        task_id,
        depends_on_id,
        dependency_task:tasks!task_dependencies_depends_on_id_fkey (
          id,
          name,
          status,
          start_date,
          end_date
        )
      `)
      .in("task_id", tasks.map((task) => task.id))

    if (dependenciesError) {
      throw dependenciesError
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

      // Lấy dependencies cho task này
      const dependencies = (taskDependencies || [])
        .filter((dep) => dep.task_id === task.id)
        .map((dep) => {
          let progressPercentage = 0
          let depTask = null
          
          if (dep.dependency_task) {
            depTask = Array.isArray(dep.dependency_task) ? dep.dependency_task[0] : dep.dependency_task
            
            if (depTask) {
              // Tính progress dựa trên status
              switch (depTask.status) {
                case "done":
                  progressPercentage = 100
                  break
                case "in_progress":
                  progressPercentage = 50
                  break
                case "review":
                  progressPercentage = 80
                  break
                case "blocked":
                  progressPercentage = 25
                  break
                default:
                  progressPercentage = 0
              }
            }
          }

          return {
            id: dep.depends_on_id,
            progress_percentage: progressPercentage,
            status: depTask?.status || "todo"
          }
        })

      return {
        ...task,
        dependencies,
        skills,
      }
    })

    // Gọi thuật toán tối ưu hóa
    const optimizedSchedule = await optimizeSchedule(
      tasksWithDependencies,
      taskDependencies || [],
      [], // scheduleDetails will be empty initially
      { 
        algorithm, 
        objective: { type: objective },
        constraints: {
          max_duration: undefined,
          max_cost: undefined,
          min_resource_utilization: 0.7,
          respect_dependencies: true,
          respect_skills: true,
          respect_availability: true
        }
      },
      project,
      users,
      userSkills,
      taskSkills,
      null // scheduleRun will be created after optimization
    )

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
    const scheduleDetails = optimizedSchedule.schedule_changes.map((change) => ({
      run_id: scheduleRun.id,
      task_id: change.task_id,
      start_ts: change.new_start,
      finish_ts: change.new_start, // You may want to calculate this based on task duration
      assigned_user: change.new_assignee,
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
