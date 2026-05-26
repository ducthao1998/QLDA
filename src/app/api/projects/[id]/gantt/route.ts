import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { buildExperienceMatrix } from "@/algorithm/experience-matrix"
import { calculateCriticalPath } from "@/algorithm/critical-path"
import { computeEarliestSchedule } from "@/lib/scheduling"

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id: projectId } = await params

  try {
    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error("Authentication error:", authError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get project details
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single()

    if (projectError || !project) {
      console.error("Project error:", projectError)
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Get tasks with all related data according to table-types.ts
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        id,
        project_id,
        name,
        status,
        note,
        duration_days,
        template_id
      `)
      .eq("project_id", projectId)
      .order("id", { ascending: true })

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError)
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
    }

    // Get task dependencies
    const { data: dependencies, error: depsError } = await supabase
      .from("task_dependencies")
      .select("*")
      .in("task_id", tasks?.map(t => t.id.toString()) || [])

    if (depsError) {
      console.error("Error fetching dependencies:", depsError)
    }

    // Get task RACI assignments
    const { data: raciData, error: raciError } = await supabase
      .from("task_raci")
      .select(`
        task_id,
        user_id,
        role,
        users (
          id,
          full_name,
          position,
          org_unit
        )
      `)
      .in("task_id", tasks?.map(t => t.id.toString()) || [])

    if (raciError) {
      console.error("Error fetching RACI data:", raciError)
    }

    // Get task skills
    const { data: taskSkills, error: taskSkillsError } = await supabase
      .from("task_skills")
      .select(`
        task_id,
        skill_id,
        skills (
          id,
          name,
          field
        )
      `)
      .in("task_id", tasks?.map(t => t.id.toString()) || [])

    if (taskSkillsError) {
      console.error("Error fetching task skills:", taskSkillsError)
    }

    // Get task progress
    const { data: taskProgress, error: progressError } = await supabase
      .from("task_progress")
      .select("*")
      .in("task_id", tasks?.map(t => t.id.toString()) || [])

    if (progressError) {
      console.error("Error fetching task progress:", progressError)
    }

    // Get all users for experience matrix
    const { data: allUsers, error: usersError } = await supabase
      .from("users")
      .select("id, full_name, position, org_unit")

    if (usersError) {
      console.error("Error fetching users:", usersError)
    }

    // Get all skills for experience matrix
    const { data: allSkills, error: skillsError } = await supabase
      .from("skills")
      .select("id, name, field")

    if (skillsError) {
      console.error("Error fetching skills:", skillsError)
    }

    // Build Experience Matrix (Thuật toán 1 - Ưu tiên cao nhất)
    const userIds = allUsers?.map(u => u.id) || []
    const skillIds = allSkills?.map(s => s.id) || []
    const experienceMatrix = await buildExperienceMatrix(userIds, skillIds)

    // Compute earliest-start schedule (forward pass CPM) for the whole project.
    // This is the "staircase" baseline shown on Gantt before any optimization.
    const projectStart = new Date(project.start_date)
    const schedule = computeEarliestSchedule(
      (tasks || []).map((t) => ({ id: String(t.id), duration_days: t.duration_days })),
      dependencies || [],
      projectStart,
    )

    // Process tasks with enhanced data and dependency-aware scheduling
    const processedTasks = tasks?.map((task) => {
      // Find responsible user (role = 'R')
      const responsibleRaci = raciData?.find((r: any) => 
        r.task_id === task.id.toString() && r.role === "R"
      )
      const assignedUser = responsibleRaci?.users

      // Get task skills
      const requiredSkills = taskSkills?.filter((ts: any) => 
        ts.task_id === task.id.toString()
      ).map((ts: any) => ({
        id: ts.skill_id,
        name: ts.skills?.name,
        field: ts.skills?.field
      })) || []

      // Get task progress
      const progress = taskProgress?.find((tp: any) => 
        tp.task_id === task.id.toString()
      )

      // Calculate progress percentage
      let progressPercentage = 0
      if (task.status === "done") {
        progressPercentage = 100
      } else if (task.status === "in_progress") {
        // Use actual progress data if available
        if (progress?.actual_start && progress?.planned_finish) {
          const start = new Date(progress.actual_start)
          const plannedEnd = new Date(progress.planned_finish)
          const now = new Date()

          if (now >= plannedEnd) {
            progressPercentage = 90 // Should be done but isn't
          } else if (now >= start) {
            const totalDuration = plannedEnd.getTime() - start.getTime()
            const elapsed = now.getTime() - start.getTime()
            progressPercentage = Math.min(90, Math.floor((elapsed / totalDuration) * 100))
          }
        } else {
          progressPercentage = 50 // Default for in-progress
        }
      }

      // Get dependencies
      const taskDependencies = dependencies?.filter((d: any) => 
        d.task_id === task.id.toString()
      ).map((d: any) => d.depends_on_id) || []

      // Calculate dates based on duration_days and project timeline
      let startDate: string
      let endDate: string

      const scheduledTask = schedule.get(task.id.toString())
      if (progress?.planned_start) {
        startDate = progress.planned_start
      } else if (progress?.actual_start) {
        startDate = progress.actual_start
      } else {
        startDate = scheduledTask?.start_date || projectStart.toISOString()
      }

      if (progress?.planned_finish) {
        endDate = progress.planned_finish
      } else if (progress?.actual_finish) {
        endDate = progress.actual_finish
      } else {
        endDate = scheduledTask?.end_date || startDate
      }

      return {
        id: task.id.toString(),
        name: task.name,
        start_date: startDate,
        end_date: endDate,
        duration_days: task.duration_days || 1,
        status: task.status,
        progress: progressPercentage,
        assigned_to: responsibleRaci?.user_id,
        assigned_user_name: (assignedUser as any)?.full_name,
        assigned_user_position: (assignedUser as any)?.position,
        assigned_user_org: (assignedUser as any)?.org_unit,
        dependencies: taskDependencies,
        required_skills: requiredSkills,
        is_overdue: progress?.status_snapshot === "late",
        actual_start: progress?.actual_start,
        actual_finish: progress?.actual_finish,
        planned_start: progress?.planned_start,
        planned_finish: progress?.planned_finish,
        template_id: task.template_id,
        note: task.note
      }
    }) || []

    // Làm sạch dependencies trước khi tính CPM
    const taskIdSet = new Set((processedTasks || []).map(t => String(t.id)))
    const cleanDependencies = (dependencies || [])
      .filter((d: any) =>
        d && d.task_id != null && d.depends_on_id != null &&
        String(d.task_id) !== String(d.depends_on_id) &&
        taskIdSet.has(String(d.task_id)) &&
        taskIdSet.has(String(d.depends_on_id))
      )
      .map((d: any) => ({
        task_id: String(d.task_id),
        depends_on_id: String(d.depends_on_id),
      }))

    // Load CPM prefs from algorithm_settings for current user + project
    let cpmOptions: any = {}
    try {
      const { data: sessionRes } = await supabase.auth.getSession()
      const session = sessionRes?.session
      if (session?.user?.id) {
        const { data: row } = await supabase
          .from('algorithm_settings')
          .select('cpm_prefs')
          .eq('user_id', session.user.id)
          .eq('project_id', projectId)
          .maybeSingle()
        const prefs = (row as any)?.cpm_prefs || {}
        cpmOptions = {
          defaultTaskDurationDays: prefs.default_task_duration_days ?? 1,
          allowStartNextDay: prefs.allow_start_next_day ?? true,
          criticalityThresholdDays: prefs.criticality_threshold_days ?? 0,
        }
      }
    } catch {}

    // Calculate Critical Path (Thuật toán 3 - Multi-Project CPM)
    const criticalPath = calculateCriticalPath(
      processedTasks.map(t => ({
        id: String(t.id),
        project_id: projectId,
        name: t.name,
        status: t.status as any,
        note: t.note,
        duration_days: t.duration_days,
        template_id: t.template_id,
        start_date: t.start_date,
        end_date: t.end_date
      })),
      cleanDependencies,
      undefined, // không truyền deadline vì ta chỉ có start date; tìm end tối ưu
      cpmOptions
    )

    // Calculate project statistics with enhanced metrics
    const stats = {
      total_tasks: processedTasks.length,
      completed_tasks: processedTasks.filter((t) => t.status === "done").length,
      in_progress_tasks: processedTasks.filter((t) => t.status === "in_progress").length,
      overdue_tasks: processedTasks.filter((t) => t.is_overdue).length,
      blocked_tasks: processedTasks.filter((t) => t.status === "blocked").length,
      overall_progress: processedTasks.length > 0
        ? Math.floor(processedTasks.reduce((sum, t) => sum + t.progress, 0) / processedTasks.length)
        : 0,
      critical_path_length: criticalPath.criticalPath.length,
      skills_coverage: taskSkills?.length || 0,
      experience_score: calculateProjectExperienceScore(processedTasks, experienceMatrix)
    }

    // Enhanced project data with algorithm results
    const enhancedProject = {
      ...project,
      stats,
      critical_path: criticalPath,
      experience_matrix_summary: {
        total_users: userIds.length,
        total_skills: skillIds.length,
        coverage_percentage: calculateSkillsCoverage(processedTasks, allSkills || [])
      }
    }

    // Gắn cờ is_critical_path để frontend hiển thị/Export
    const criticalSet = new Set((criticalPath.criticalPath || []).map((x: any) => String(x)))
    const tasksWithCritical = processedTasks.map(t => ({
      ...t,
      is_critical_path: criticalSet.has(String(t.id)),
    }))

    return NextResponse.json({
      project: enhancedProject,
      tasks: tasksWithCritical,
      dependencies: cleanDependencies,
      users: allUsers || [],
      skills: allSkills || [],
      experience_matrix: experienceMatrix,
      algorithms_applied: [
        "Experience Matrix",
        "Multi-Project CPM",
        "Critical Path Analysis"
      ],
      cpm_details: criticalPath
    })

  } catch (error) {
    console.error("Error in gantt API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Helper functions
function calculateProjectExperienceScore(tasks: any[], experienceMatrix: any): number {
  let totalScore = 0
  let taskCount = 0

  tasks.forEach(task => {
    if (task.assigned_to && task.required_skills?.length > 0) {
      const userExperience = task.required_skills.reduce((sum: number, skill: any) => {
        return sum + (experienceMatrix[task.assigned_to]?.[skill.id] || 0)
      }, 0) / task.required_skills.length

      totalScore += userExperience
      taskCount++
    }
  })

  return taskCount > 0 ? totalScore / taskCount : 0
}

function calculateSkillsCoverage(tasks: any[], allSkills: any[]): number {
  const requiredSkillIds = new Set()
  tasks.forEach(task => {
    task.required_skills?.forEach((skill: any) => {
      requiredSkillIds.add(skill.id)
    })
  })

  return allSkills.length > 0 ? (requiredSkillIds.size / allSkills.length) * 100 : 0
}
