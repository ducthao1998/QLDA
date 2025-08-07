import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { optimizeSchedule } from "@/algorithm/schedule-optimizer"
import { buildExperienceMatrix } from "@/algorithm/experience-matrix"
import { OptimizationConfig } from "@/algorithm/types"

export async function POST(req: Request, { params }: { params: { id: string } }) {
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

    // Parse request body
    const body = await req.json()
    const { algorithm, objective } = body

    // Validate input
    if (!algorithm || !objective) {
      return NextResponse.json({ error: "Missing algorithm or objective" }, { status: 400 })
    }

    // Get project data
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single()

    if (projectError || !project) {
      console.error("Project error:", projectError)
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Get tasks
    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .eq("project_id", projectId)

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError)
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
    }

    // Get dependencies
    const { data: dependencies, error: depsError } = await supabase
      .from("task_dependencies")
      .select("*")
      .in("task_id", tasks?.map(t => t.id.toString()) || [])

    if (depsError) {
      console.error("Error fetching dependencies:", depsError)
    }

    // Get users
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, full_name, position, org_unit")

    if (usersError) {
      console.error("Error fetching users:", usersError)
    }

    // Get user skills
    const { data: userSkills, error: userSkillsError } = await supabase
      .from("user_skills")
      .select("*")

    if (userSkillsError) {
      console.error("Error fetching user skills:", userSkillsError)
    }

    // Get task skills
    const { data: taskSkills, error: taskSkillsError } = await supabase
      .from("task_skills")
      .select("*")
      .in("task_id", tasks?.map(t => t.id.toString()) || [])

    if (taskSkillsError) {
      console.error("Error fetching task skills:", taskSkillsError)
    }

    // Create schedule run record
    const { data: scheduleRun, error: scheduleRunError } = await supabase
      .from("schedule_runs")
      .insert({
        project_id: projectId,
        algorithm_used: algorithm,
        objective_type: objective.type,
        status: "running",
        created_by: user.id
      })
      .select()
      .single()

    if (scheduleRunError) {
      console.error("Error creating schedule run:", scheduleRunError)
      return NextResponse.json({ error: "Failed to create schedule run" }, { status: 500 })
    }

    // Create schedule details from current task assignments
    const scheduleDetails = tasks?.map(task => {
      // Calculate dates based on duration_days
      const startDate = new Date()
      const endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + (task.duration_days || 1))

      return {
        schedule_run_id: scheduleRun.id,
        task_id: task.id.toString(),
        assigned_user: "", // Will be assigned by optimization
        start_ts: startDate.toISOString(),
        finish_ts: endDate.toISOString(),
        resource_allocation: 1.0
      }
    }) || []

    // Build optimization config
    const config: OptimizationConfig = {
      algorithm: algorithm as any,
      objective: {
        type: objective.type,
        weights: objective.weights
      },
      constraints: {
        respect_dependencies: true,
        respect_skills: true,
        respect_availability: true
      }
    }

    // Run optimization
    const optimizationResult = await optimizeSchedule(
      tasks || [],
      dependencies || [],
      scheduleDetails,
      config,
      project,
      users || [],
      userSkills || [],
      taskSkills || [],
      scheduleRun
    )

    // Update schedule run status
    await supabase
      .from("schedule_runs")
      .update({
        status: "completed",
        makespan_hours: optimizationResult.optimized_makespan,
        resource_utilization: optimizationResult.resource_utilization_after,
        optimization_score: optimizationResult.improvement_percentage
      })
      .eq("id", scheduleRun.id)

    return NextResponse.json(optimizationResult)

  } catch (error) {
    console.error("Error in optimization API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
