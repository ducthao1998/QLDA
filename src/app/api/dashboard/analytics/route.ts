import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { startOfMonth, endOfMonth, format, subMonths, startOfWeek, endOfWeek, subDays } from "date-fns"
import { vi } from "date-fns/locale"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const from = searchParams.get("from") || subMonths(new Date(), 1).toISOString()
  const to = searchParams.get("to") || new Date().toISOString()
  const orgUnit = searchParams.get("org_unit") || "all"

  try {
    // Get current user for authorization
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
    }

    // 1. OVERVIEW METRICS
    const overview = await getOverviewMetrics(supabase, from, to, orgUnit)

    // 2. TASK STATISTICS
    const taskStatistics = await getTaskStatistics(supabase, from, to, orgUnit)

    // 3. USER STATISTICS
    const userStatistics = await getUserStatistics(supabase, from, to, orgUnit)

    // 4. TIME STATISTICS
    const timeStatistics = await getTimeStatistics(supabase, from, to, orgUnit)

    // 5. ADVANCED ANALYTICS
    const advancedAnalytics = await getAdvancedAnalytics(supabase, from, to, orgUnit)

    return NextResponse.json({
      overview,
      task_statistics: taskStatistics,
      user_statistics: userStatistics,
      time_statistics: timeStatistics,
      advanced_analytics: advancedAnalytics,
    })
  } catch (error) {
    console.error("Dashboard analytics error:", error)
    return NextResponse.json({ error: "Failed to fetch dashboard analytics" }, { status: 500 })
  }
}

async function getOverviewMetrics(supabase: any, from: string, to: string, orgUnit: string) {
  try {
    // Total projects with proper join
    let projectsQuery = supabase.from("projects").select(`
        id, 
        status,
        users!created_by(org_unit)
      `)

    if (orgUnit !== "all") {
      projectsQuery = projectsQuery.eq("users.org_unit", orgUnit)
    }

    const { data: projects } = await projectsQuery

    const activeProjects = projects?.filter((p) => ["active", "in_progress"].includes(p.status)).length || 0

    // Total tasks with proper join
    let tasksQuery = supabase
      .from("tasks")
      .select(`
        id, 
        status, 
        end_date,
        created_at,
        projects!inner(
          users!created_by(org_unit)
        )
      `)
      .gte("created_at", from)
      .lte("created_at", to)

    if (orgUnit !== "all") {
      tasksQuery = tasksQuery.eq("projects.users.org_unit", orgUnit)
    }

    const { data: tasks } = await tasksQuery

    const completedTasks = tasks?.filter((t) => ["done", "completed"].includes(t.status)).length || 0

    const overdueTasks =
      tasks?.filter((t) => !["done", "completed"].includes(t.status) && t.end_date && new Date(t.end_date) < new Date())
        .length || 0

    // Users count
    let usersQuery = supabase.from("users").select("id, org_unit")
    if (orgUnit !== "all") {
      usersQuery = usersQuery.eq("org_unit", orgUnit)
    }
    const { data: users } = await usersQuery

    const totalTasks = tasks?.length || 0
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
    const onTimeRate = totalTasks > 0 ? ((totalTasks - overdueTasks) / totalTasks) * 100 : 0

    return {
      total_projects: projects?.length || 0,
      active_projects: activeProjects,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      overdue_tasks: overdueTasks,
      users_count: users?.length || 0,
      completion_rate: completionRate,
      on_time_rate: onTimeRate,
    }
  } catch (error) {
    console.error("Error in getOverviewMetrics:", error)
    return {
      total_projects: 0,
      active_projects: 0,
      total_tasks: 0,
      completed_tasks: 0,
      overdue_tasks: 0,
      users_count: 0,
      completion_rate: 0,
      on_time_rate: 0,
    }
  }
}

async function getTaskStatistics(supabase: any, from: string, to: string, orgUnit: string) {
  try {
    // By status
    const statusQuery = supabase.from("tasks").select("status").gte("created_at", from).lte("created_at", to)

    const { data: tasksByStatus } = await statusQuery

    const statusCounts =
      tasksByStatus?.reduce((acc: any, task: any) => {
        acc[task.status] = (acc[task.status] || 0) + 1
        return acc
      }, {}) || {}

    const totalTasks = tasksByStatus?.length || 1
    const byStatus = Object.entries(statusCounts).map(([status, count]: any) => ({
      status,
      count,
      percentage: (count / totalTasks) * 100,
    }))

    // By template
    const { data: tasksByTemplate } = await supabase
      .from("tasks")
      .select(`
        template_id,
        task_templates(name),
        start_date,
        end_date
      `)
      .not("template_id", "is", null)
      .not("start_date", "is", null)
      .not("end_date", "is", null)

    const templateStats = new Map()
    tasksByTemplate?.forEach((task: any) => {
      const templateName = task.task_templates?.name || "Unknown"
      if (!templateStats.has(templateName)) {
        templateStats.set(templateName, { count: 0, totalDuration: 0 })
      }
      const stats = templateStats.get(templateName)
      stats.count++

      if (task.start_date && task.end_date) {
        const duration = Math.ceil(
          (new Date(task.end_date).getTime() - new Date(task.start_date).getTime()) / (1000 * 60 * 60 * 24),
        )
        stats.totalDuration += Math.max(1, duration)
      }
    })

    const byTemplate = Array.from(templateStats.entries()).map(([name, stats]: any) => ({
      template_name: name,
      count: stats.count,
      avg_duration: stats.count > 0 ? Math.round(stats.totalDuration / stats.count) : 0,
    }))

    // By phase
    const { data: tasksByPhase } = await supabase
      .from("tasks")
      .select(`
        phase_id,
        status,
        project_phases(name)
      `)
      .not("phase_id", "is", null)

    const phaseStats = new Map()
    tasksByPhase?.forEach((task: any) => {
      const phaseName = task.project_phases?.name || "Unknown Phase"
      if (!phaseStats.has(phaseName)) {
        phaseStats.set(phaseName, { total: 0, completed: 0 })
      }
      const stats = phaseStats.get(phaseName)
      stats.total++
      if (["done", "completed"].includes(task.status)) stats.completed++
    })

    const byPhase = Array.from(phaseStats.entries()).map(([name, stats]: any) => ({
      phase_name: name,
      count: stats.total,
      completion_rate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
    }))

    // By classification
    const { data: tasksByClassification } = await supabase.from("tasks").select(`
        project_id,
        status,
        projects(classification)
      `)

    const classificationStats = new Map()
    tasksByClassification?.forEach((task: any) => {
      const classification = task.projects?.classification || "Chưa phân loại"
      if (!classificationStats.has(classification)) {
        classificationStats.set(classification, { count: 0, progress: 0 })
      }
      const stats = classificationStats.get(classification)
      stats.count++
      if (["done", "completed"].includes(task.status)) stats.progress++
    })

    const byClassification = Array.from(classificationStats.entries()).map(([classification, stats]: any) => ({
      classification,
      count: stats.count,
      avg_progress: stats.count > 0 ? (stats.progress / stats.count) * 100 : 0,
    }))

    return {
      by_status: byStatus,
      by_template: byTemplate,
      by_phase: byPhase,
      by_classification: byClassification,
    }
  } catch (error) {
    console.error("Error in getTaskStatistics:", error)
    return {
      by_status: [],
      by_template: [],
      by_phase: [],
      by_classification: [],
    }
  }
}

async function getUserStatistics(supabase: any, from: string, to: string, orgUnit: string) {
  try {
    // Get users
    let usersQuery = supabase.from("users").select(`
      id,
      full_name,
      position,
      org_unit
    `)

    if (orgUnit !== "all") {
      usersQuery = usersQuery.eq("org_unit", orgUnit)
    }

    const { data: users } = await usersQuery

    // Get user statistics
    const userStats = await Promise.all(
      users?.map(async (user: any) => {
        // Get tasks assigned to user through RACI
        const { data: userTasks } = await supabase
          .from("task_raci")
          .select(`
          task_id,
          role,
          tasks(
            id,
            status,
            start_date,
            end_date,
            created_at
          )
        `)
          .eq("user_id", user.id)
          .eq("role", "R") // Responsible role
          .gte("tasks.created_at", from)
          .lte("tasks.created_at", to)

        const totalTasks = userTasks?.length || 0
        const completedTasks =
          userTasks?.filter((t: any) => ["done", "completed"].includes(t.tasks?.status)).length || 0
        const inProgressTasks = userTasks?.filter((t: any) => t.tasks?.status === "in_progress").length || 0
        const overdueTasks =
          userTasks?.filter(
            (t: any) =>
              !["done", "completed"].includes(t.tasks?.status) &&
              t.tasks?.end_date &&
              new Date(t.tasks.end_date) < new Date(),
          ).length || 0

        // Calculate average task duration for completed tasks
        let totalDuration = 0
        let completedCount = 0

        userTasks?.forEach((t: any) => {
          if (["done", "completed"].includes(t.tasks?.status) && t.tasks?.start_date && t.tasks?.end_date) {
            const duration = Math.ceil(
              (new Date(t.tasks.end_date).getTime() - new Date(t.tasks.start_date).getTime()) / (1000 * 60 * 60 * 24),
            )
            totalDuration += Math.max(1, duration)
            completedCount++
          }
        })

        const avgTaskDuration = completedCount > 0 ? Math.round(totalDuration / completedCount) : 0
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
        const workloadScore = Math.min(100, (inProgressTasks / 5) * 100) // 5 tasks = 100% workload

        return {
          user_id: user.id,
          full_name: user.full_name,
          position: user.position,
          org_unit: user.org_unit,
          total_tasks: totalTasks,
          completed_tasks: completedTasks,
          in_progress_tasks: inProgressTasks,
          overdue_tasks: overdueTasks,
          completion_rate: completionRate,
          avg_task_duration: avgTaskDuration,
          workload_score: workloadScore,
        }
      }) || [],
    )

    // Skills utilization
    const { data: skillsData } = await supabase.from("user_skill_matrix").select("*")

    const skillsUtilization =
      skillsData?.reduce((acc: any[], skill: any) => {
        const existingSkill = acc.find((s) => s.skill_name === skill.skill_name)
        if (existingSkill) {
          existingSkill.users_count++
          existingSkill.tasks_count += skill.completed_tasks_count || 0
        } else {
          acc.push({
            skill_name: skill.skill_name,
            skill_field: skill.skill_field,
            users_count: 1,
            tasks_count: skill.completed_tasks_count || 0,
            utilization_rate: 0,
          })
        }
        return acc
      }, []) || []

    // Calculate utilization rate
    skillsUtilization.forEach((skill: any) => {
      skill.utilization_rate = Math.min(100, (skill.tasks_count / Math.max(1, skill.users_count * 10)) * 100)
    })

    // Workload distribution by org unit
    const workloadByUnit = userStats.reduce((acc: any[], user: any) => {
      const unit = acc.find((u) => u.org_unit === user.org_unit)
      if (unit) {
        unit.total_users++
        unit.total_tasks += user.total_tasks
        unit.completion_sum += user.completion_rate
      } else {
        acc.push({
          org_unit: user.org_unit,
          total_users: 1,
          total_tasks: user.total_tasks,
          completion_sum: user.completion_rate,
          avg_workload: 0,
          completion_rate: 0,
        })
      }
      return acc
    }, [])

    workloadByUnit.forEach((unit: any) => {
      unit.avg_workload = unit.total_users > 0 ? Math.round(unit.total_tasks / unit.total_users) : 0
      unit.completion_rate = unit.total_users > 0 ? unit.completion_sum / unit.total_users : 0
      delete unit.completion_sum
    })

    return {
      by_user: userStats,
      skills_utilization: skillsUtilization,
      workload_distribution: workloadByUnit,
    }
  } catch (error) {
    console.error("Error in getUserStatistics:", error)
    return {
      by_user: [],
      skills_utilization: [],
      workload_distribution: [],
    }
  }
}

async function getTimeStatistics(supabase: any, from: string, to: string, orgUnit: string) {
  try {
    // Monthly trends
    const monthlyTrends = []
    for (let i = 11; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i))
      const monthEnd = endOfMonth(monthStart)

      const { data: monthTasks } = await supabase
        .from("tasks")
        .select("id, status, created_at, end_date, updated_at")
        .gte("created_at", monthStart.toISOString())
        .lte("created_at", monthEnd.toISOString())

      const completedCount = monthTasks?.filter((t: any) => ["done", "completed"].includes(t.status)).length || 0
      const createdCount = monthTasks?.length || 0
      const overdueCount =
        monthTasks?.filter(
          (t: any) => !["done", "completed"].includes(t.status) && t.end_date && new Date(t.end_date) < monthEnd,
        ).length || 0

      monthlyTrends.push({
        month: format(monthStart, "MM/yyyy", { locale: vi }),
        completed_tasks: completedCount,
        created_tasks: createdCount,
        overdue_tasks: overdueCount,
        completion_rate: createdCount > 0 ? (completedCount / createdCount) * 100 : 0,
      })
    }

    // Weekly productivity (last 8 weeks)
    const weeklyProductivity = []
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subDays(new Date(), i * 7), { locale: vi })
      const weekEnd = endOfWeek(weekStart, { locale: vi })

      const { data: weekTasks } = await supabase
        .from("tasks")
        .select("id, status, start_date, end_date, updated_at")
        .gte("updated_at", weekStart.toISOString())
        .lte("updated_at", weekEnd.toISOString())
        .in("status", ["done", "completed"])

      const tasksCompleted = weekTasks?.length || 0
      let totalCompletionTime = 0

      weekTasks?.forEach((task: any) => {
        if (task.start_date && task.end_date) {
          const duration = Math.ceil(
            (new Date(task.end_date).getTime() - new Date(task.start_date).getTime()) / (1000 * 60 * 60 * 24),
          )
          totalCompletionTime += Math.max(1, duration)
        }
      })

      const avgCompletionTime = tasksCompleted > 0 ? Math.round(totalCompletionTime / tasksCompleted) : 0
      const productivityScore = Math.min(100, (tasksCompleted / 10) * 100) // 10 tasks/week = 100%

      weeklyProductivity.push({
        week: `Tuần ${format(weekStart, "dd/MM", { locale: vi })}`,
        productivity_score: productivityScore,
        tasks_completed: tasksCompleted,
        avg_completion_time: avgCompletionTime,
      })
    }

    // Deadline performance
    const { data: completedTasks } = await supabase
      .from("tasks")
      .select("id, status, end_date, updated_at")
      .in("status", ["done", "completed"])
      .gte("updated_at", from)
      .lte("updated_at", to)
      .not("end_date", "is", null)

    const currentPeriod = {
      on_time: 0,
      late: 0,
      early: 0,
    }

    completedTasks?.forEach((task: any) => {
      const deadline = new Date(task.end_date)
      const completed = new Date(task.updated_at)
      const diffDays = Math.ceil((completed.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24))

      if (diffDays > 1) currentPeriod.late++
      else if (diffDays < -1) currentPeriod.early++
      else currentPeriod.on_time++
    })

    const totalCompleted = currentPeriod.on_time + currentPeriod.late + currentPeriod.early
    const onTimeRate = totalCompleted > 0 ? (currentPeriod.on_time / totalCompleted) * 100 : 0

    return {
      monthly_trends: monthlyTrends,
      weekly_productivity: weeklyProductivity,
      deadline_performance: [
        {
          period: "Kỳ hiện tại",
          on_time: currentPeriod.on_time,
          late: currentPeriod.late,
          early: currentPeriod.early,
          on_time_rate: onTimeRate,
        },
      ],
    }
  } catch (error) {
    console.error("Error in getTimeStatistics:", error)
    return {
      monthly_trends: [],
      weekly_productivity: [],
      deadline_performance: [],
    }
  }
}

async function getAdvancedAnalytics(supabase: any, from: string, to: string, orgUnit: string) {
  try {
    const bottlenecks: any[] = []

    // 1. Check for overloaded users
    const { data: userWorkload } = await supabase
      .from("task_raci")
      .select(`
        user_id,
        users(full_name),
        tasks(status)
      `)
      .eq("role", "R")
      .eq("tasks.status", "in_progress")

    const userTaskCounts = new Map()
    userWorkload?.forEach((item: any) => {
      const userId = item.user_id
      const current = userTaskCounts.get(userId) || { count: 0, name: item.users?.full_name || "Unknown" }
      current.count++
      userTaskCounts.set(userId, current)
    })

    userTaskCounts.forEach((data, userId) => {
      if (data.count > 5) {
        bottlenecks.push({
          type: "Quá tải nhân sự",
          description: `${data.name} đang thực hiện ${data.count} công việc cùng lúc`,
          impact_score: Math.min(100, (data.count / 5) * 50),
          affected_tasks: data.count,
          recommendations: [
            "Phân công lại một số công việc cho nhân viên khác",
            "Ưu tiên các công việc quan trọng",
            "Xem xét tuyển thêm nhân sự",
          ],
        })
      }
    })

    // 2. Check for skill gaps
    const { data: requiredSkills } = await supabase
      .from("task_skills")
      .select(`
        skill_id,
        skills(name),
        tasks(status)
      `)
      .eq("tasks.status", "todo")

    const { data: availableSkills } = await supabase.from("user_skill_matrix").select("skill_id, user_id")

    const skillAvailability = new Map()
    availableSkills?.forEach((item: any) => {
      const count = skillAvailability.get(item.skill_id) || 0
      skillAvailability.set(item.skill_id, count + 1)
    })

    const skillDemand = new Map()
    requiredSkills?.forEach((item: any) => {
      const skillId = item.skill_id
      const current = skillDemand.get(skillId) || { name: item.skills?.name || "Unknown", count: 0 }
      current.count++
      skillDemand.set(skillId, current)
    })

    skillDemand.forEach((demand, skillId) => {
      const available = skillAvailability.get(skillId) || 0
      if (demand.count > available * 2) {
        bottlenecks.push({
          type: "Thiếu kỹ năng",
          description: `Thiếu nhân sự có kỹ năng "${demand.name}"`,
          impact_score: Math.min(100, ((demand.count - available) / Math.max(1, demand.count)) * 100),
          affected_tasks: demand.count,
          recommendations: [
            "Đào tạo thêm nhân viên về kỹ năng này",
            "Tuyển dụng chuyên gia bên ngoài",
            "Điều chỉnh kế hoạch dự án",
          ],
        })
      }
    })

    // Predictions
    const { data: projects } = await supabase
      .from("projects")
      .select(`
        id,
        name,
        start_date,
        end_date,
        tasks(status)
      `)
      .eq("status", "active")
      .limit(5)

    const projectCompletionForecast =
      projects?.map((project: any) => {
        const totalTasks = project.tasks?.length || 0
        const completedTasks = project.tasks?.filter((t: any) => ["done", "completed"].includes(t.status)).length || 0
        const progressRate = totalTasks > 0 ? completedTasks / totalTasks : 0

        const daysElapsed = Math.ceil(
          (new Date().getTime() - new Date(project.start_date).getTime()) / (1000 * 60 * 60 * 24),
        )
        const totalDays = Math.ceil(
          (new Date(project.end_date).getTime() - new Date(project.start_date).getTime()) / (1000 * 60 * 60 * 24),
        )

        const estimatedDaysToComplete = progressRate > 0 ? daysElapsed / progressRate : totalDays * 2
        const predictedCompletion = new Date()
        predictedCompletion.setDate(predictedCompletion.getDate() + (estimatedDaysToComplete - daysElapsed))

        const confidence = Math.max(20, Math.min(95, progressRate * 100))
        const riskFactors = []

        if (predictedCompletion > new Date(project.end_date)) {
          riskFactors.push("Có nguy cơ trễ deadline")
        }
        if (progressRate < 0.3 && daysElapsed > totalDays * 0.5) {
          riskFactors.push("Tiến độ chậm")
        }

        return {
          project_name: project.name,
          predicted_completion: predictedCompletion.toISOString(),
          confidence,
          risk_factors: riskFactors,
        }
      }) || []

    // Resource needs prediction
    const resourceNeeds = Array.from(skillDemand.entries())
      .map(([skillId, demand]: any) => {
        const currentCapacity = skillAvailability.get(skillId) || 0
        const gap = Math.max(0, demand.count - currentCapacity)

        return {
          skill_name: demand.name,
          current_capacity: currentCapacity,
          predicted_demand: demand.count,
          gap,
        }
      })
      .filter((need) => need.gap > 0)

    // Calculate KPIs
    const { data: allTasksForKPI } = await supabase.from("tasks").select("status, start_date, end_date, updated_at")

    const totalTasksKPI = allTasksForKPI?.length || 1
    const completedTasksKPI = allTasksForKPI?.filter((t: any) => ["done", "completed"].includes(t.status)).length || 0
    const onTimeTasksKPI =
      allTasksForKPI?.filter(
        (t: any) =>
          ["done", "completed"].includes(t.status) &&
          t.end_date &&
          t.updated_at &&
          new Date(t.updated_at) <= new Date(t.end_date),
      ).length || 0

    // Calculate resource utilization
    const activeUsers = userTaskCounts.size || 1
    const avgTasksPerUser =
      Array.from(userTaskCounts.values()).reduce((sum: number, user: any) => sum + user.count, 0) / activeUsers

    const kpis = {
      efficiency_score: (completedTasksKPI / totalTasksKPI) * 100,
      quality_score: completedTasksKPI > 0 ? (onTimeTasksKPI / completedTasksKPI) * 100 : 0,
      resource_utilization: Math.min(95, (avgTasksPerUser / 5) * 100),
      customer_satisfaction: 85, // This would come from external surveys
      innovation_index: 75, // This would be calculated based on project types and outcomes
    }

    return {
      bottlenecks,
      predictions: {
        project_completion_forecast: projectCompletionForecast,
        resource_needs: resourceNeeds,
      },
      kpis,
    }
  } catch (error) {
    console.error("Error in getAdvancedAnalytics:", error)
    return {
      bottlenecks: [],
      predictions: {
        project_completion_forecast: [],
        resource_needs: [],
      },
      kpis: {
        efficiency_score: 0,
        quality_score: 0,
        resource_utilization: 0,
        customer_satisfaction: 0,
        innovation_index: 0,
      },
    }
  }
}
