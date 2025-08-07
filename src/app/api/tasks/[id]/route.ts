import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { Task } from "@/app/types/table-types"
import { optimizeTask } from "@/services/task-optimization"

async function refreshUserSkillMatrixManually(supabase: any) {
  try {
    // Lấy tất cả worklogs với thông tin task và skills
    const { data: worklogData, error: worklogError } = await supabase
      .from('worklogs')
      .select(`
        user_id,
        task_id,
        spent_hours,
        log_date,
        tasks!inner(
          id,
          name,
          task_skills!inner(
            skill_id,
            skills!inner(
              id,
              name,
              field
            )
          )
        ),
        users!inner(
          id,
          full_name
        )
      `)

    if (worklogError) {
      throw worklogError
    }

    // Tính toán user skill matrix
    const skillMatrix = new Map()

    worklogData?.forEach((worklog: any) => {
      const userId = worklog.user_id
      const userName = worklog.users.full_name
      const task = worklog.tasks

      task.task_skills?.forEach((taskSkill: any) => {
        const skill = taskSkill.skills
        const skillId = skill.id
        const skillName = skill.name
        const skillField = skill.field

        const key = `${userId}-${skillId}`
        
        if (!skillMatrix.has(key)) {
          skillMatrix.set(key, {
            user_id: userId,
            full_name: userName,
            skill_id: skillId,
            skill_name: skillName,
            skill_field: skillField,
            completed_tasks_count: 0,
            total_experience_days: 0,
            last_activity_date: null
          })
        }

        const entry = skillMatrix.get(key)
        entry.completed_tasks_count += 1
        entry.total_experience_days += Math.ceil(worklog.spent_hours / 8) // Convert hours to days
        
        const logDate = new Date(worklog.log_date)
        if (!entry.last_activity_date || logDate > new Date(entry.last_activity_date)) {
          entry.last_activity_date = worklog.log_date
        }
      })
    })

    console.log("User skill matrix calculated:", Array.from(skillMatrix.values()))
    
    return Array.from(skillMatrix.values())
  } catch (error) {
    console.error("Error refreshing user skill matrix manually:", error)
    throw error
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    // Kiểm tra session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !session) {
      console.error("Session error:", sessionError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const id = await params.id;
    console.log("Fetching task with ID:", id)
    
    const { data: task, error } = await supabase
      .from("tasks")
      .select(`
        *,
        users:assigned_to (
          full_name,
          position,
          org_unit
        ),
        projects (
          name
        )
      `)
      .eq("id", id)
      .single()

    console.log("Task data:", task)
    console.log("Error:", error)

    if (error) {
      console.error("Error fetching task:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Tính toán các thông số tối ưu
    const optimizationResult = await optimizeTask(task)
    
    // Kết hợp kết quả tối ưu với thông tin task
    const taskWithOptimization = {
      ...task,
      ...optimizationResult
    }

    return NextResponse.json(taskWithOptimization)
  } catch (error) {
    console.error("Error in GET /api/tasks/[id]:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const taskId = params.id

    // Kiểm tra xác thực
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    
    // Lấy thông tin task hiện tại để so sánh
    const { data: currentTask, error: fetchError } = await supabase
      .from("tasks")
      .select(`
        *,
        task_raci(user_id, role),
        task_skills(skill_id)
      `)
      .eq("id", taskId)
      .single()

    if (fetchError || !currentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const taskData: Partial<Task> = {
      ...body,
      updated_at: new Date().toISOString()
    }

    // Cập nhật task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .update(taskData)
      .eq("id", taskId)
      .select()
      .single()

    if (taskError) {
      console.error("Error updating task:", taskError)
      return NextResponse.json({ error: taskError.message }, { status: 500 })
    }

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Kiểm tra nếu task được chuyển sang trạng thái "done"
    const isTaskCompleted = currentTask.status !== "done" && body.status === "done"
    
    if (isTaskCompleted) {
      try {
        // Tự động tạo worklogs cho những người có role "R" (Responsible) hoặc assigned_to
        const responsibleUsers = (currentTask.task_raci as any[])?.filter(raci => raci.role === "R") || []
        
        // Nếu không có RACI assignment, sử dụng assigned_to
        const usersToCreateWorklogs = responsibleUsers.length > 0 
          ? responsibleUsers.map(raci => ({ user_id: raci.user_id }))
          : currentTask.assigned_to 
            ? [{ user_id: currentTask.assigned_to }]
            : []
        
        if (usersToCreateWorklogs.length > 0) {
          const currentDate = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
          const durationDays = currentTask.duration_days || 1
          const hoursPerDay = 8 // Giả định 8 giờ/ngày
          const totalHours = durationDays * hoursPerDay
          const hoursPerUser = Math.ceil(totalHours / usersToCreateWorklogs.length)

          // Tạo worklogs cho từng user
          for (const userInfo of usersToCreateWorklogs) {
            await supabase.from("worklogs").insert({
              task_id: taskId,
              user_id: userInfo.user_id,
              spent_hours: hoursPerUser,
              log_date: currentDate,
              note: `Tự động tạo khi hoàn thành task: ${currentTask.name}`
            })
          }

          // Cập nhật task_progress với actual_finish
          const now = new Date().toISOString()
          await supabase.from("task_progress").insert({
            task_id: taskId,
            actual_finish: now,
            status_snapshot: "on_time", // Có thể tính toán dựa trên due_date
            snapshot_at: now
          })

          // Ghi lại lịch sử
          await supabase.from("task_history").insert({
            task_id: taskId,
            user_id: user.id,
            action: "task_completed",
            from_val: currentTask.status,
            to_val: "done",
            at: now
          })

          console.log(`Auto-created worklogs for task ${taskId} completion`)

          // Tự động refresh user_skill_matrix sau khi tạo worklogs
          try {
            await refreshUserSkillMatrixManually(supabase)
            console.log('User skill matrix refreshed successfully')
          } catch (refreshError) {
            console.error('Error refreshing user skill matrix:', refreshError)
          }
        }
      } catch (worklogError) {
        console.error("Error creating auto worklogs:", worklogError)
        // Không fail toàn bộ request nếu tạo worklog lỗi
      }
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error("Error in PATCH /api/tasks/[id]:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const taskId = params.id

    // Kiểm tra xác thực
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Xóa task
    const { error: deleteError } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)

    if (deleteError) {
      console.error("Error deleting task:", deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/tasks/[id]:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}
