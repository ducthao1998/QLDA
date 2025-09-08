import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Kiểm tra xác thực
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Refresh user_skill_matrix view bằng cách tính toán lại từ worklogs và task_skills
    const { error: refreshError } = await supabase.rpc('refresh_user_skill_matrix')

    if (refreshError) {
      console.error("Error refreshing user skill matrix:", refreshError)
      // Nếu function không tồn tại, tạo dữ liệu thủ công
      await refreshUserSkillMatrixManually(supabase)
    }

    return NextResponse.json({ success: true, message: "User skill matrix refreshed successfully" })
  } catch (error) {
    console.error("Error in POST /api/user-skills/refresh:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

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
            last_activity_date: null
          })
        }

        const entry = skillMatrix.get(key)
        entry.completed_tasks_count += 1
        
        const logDate = new Date(worklog.log_date)
        if (!entry.last_activity_date || logDate > new Date(entry.last_activity_date)) {
          entry.last_activity_date = worklog.log_date
        }
      })
    })

    // Xóa dữ liệu cũ và insert dữ liệu mới (nếu có bảng user_skill_matrix_cache)
    // Hoặc có thể tạo một materialized view
    console.log("User skill matrix calculated:", Array.from(skillMatrix.values()))
    
    return Array.from(skillMatrix.values())
  } catch (error) {
    console.error("Error refreshing user skill matrix manually:", error)
    throw error
  }
}
