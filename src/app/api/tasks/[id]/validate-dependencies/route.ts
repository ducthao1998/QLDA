import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

interface DependencyValidationResult {
  isValid: boolean
  circularPath?: string[]
  error?: string
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
  }

  const { id: taskId } = await params

  try {
    const body = await request.json()
    const { dependencies } = body

    if (!dependencies || !Array.isArray(dependencies)) {
      return NextResponse.json({
        isValid: true,
      })
    }

    // Get all existing dependencies in the project
    const { data: task, error: taskError } = await supabase.from("tasks").select("project_id").eq("id", taskId).single()

    if (taskError || !task) {
      return NextResponse.json(
        {
          isValid: false,
          error: "Không tìm thấy công việc",
        },
        { status: 404 },
      )
    }

    // Get all dependencies in the project
    const { data: allDependencies, error: depsError } = await supabase
      .from("task_dependencies")
      .select("task_id, depends_on_id")
      .in("task_id", await getProjectTaskIds(supabase, task.project_id))

    if (depsError) {
      console.error("Error fetching dependencies:", depsError)
      return NextResponse.json(
        {
          isValid: false,
          error: "Không thể kiểm tra phụ thuộc",
        },
        { status: 500 },
      )
    }

    // Create a map of current dependencies (excluding the task being edited)
    const dependencyMap = new Map<string, string[]>()

    allDependencies?.forEach((dep) => {
      if (dep.task_id.toString() !== taskId) {
        const taskIdStr = dep.task_id.toString()
        if (!dependencyMap.has(taskIdStr)) {
          dependencyMap.set(taskIdStr, [])
        }
        dependencyMap.get(taskIdStr)!.push(dep.depends_on_id.toString())
      }
    })

    // Add the new dependencies for the current task
    dependencyMap.set(
      taskId,
      dependencies.map((d) => d.toString()),
    )

    // Check for circular dependencies
    const result = detectCircularDependency(dependencyMap, taskId)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error validating dependencies:", error)
    return NextResponse.json(
      {
        isValid: false,
        error: "Lỗi khi kiểm tra phụ thuộc",
      },
      { status: 500 },
    )
  }
}

// Helper function to get all task IDs in a project
async function getProjectTaskIds(supabase: any, projectId: string): Promise<string[]> {
  const { data: tasks, error } = await supabase.from("tasks").select("id").eq("project_id", projectId)

  if (error) {
    console.error("Error fetching project tasks:", error)
    return []
  }

  return tasks?.map((t: { id: string }) => t.id.toString()) || []
}

// Detect circular dependency using DFS
function detectCircularDependency(
  dependencyMap: Map<string, string[]>,
  startTaskId: string,
): DependencyValidationResult {
  const visited = new Set<string>()
  const recursionStack = new Set<string>()
  const path: string[] = []

  function dfs(taskId: string): boolean {
    if (recursionStack.has(taskId)) {
      // Found a cycle, capture the circular path
      const cycleStart = path.indexOf(taskId)
      const circularPath = path.slice(cycleStart).concat([taskId])
      return true
    }

    if (visited.has(taskId)) {
      return false
    }

    visited.add(taskId)
    recursionStack.add(taskId)
    path.push(taskId)

    const dependencies = dependencyMap.get(taskId) || []

    for (const depId of dependencies) {
      if (dfs(depId)) {
        return true
      }
    }

    recursionStack.delete(taskId)
    path.pop()
    return false
  }

  // Check if adding these dependencies creates a cycle
  if (dfs(startTaskId)) {
    // Extract the circular path from the current path
    const cycleStart = path.findIndex((id) => recursionStack.has(id))
    const circularPath = cycleStart >= 0 ? path.slice(cycleStart) : path

    return {
      isValid: false,
      circularPath,
      error: `Phụ thuộc này sẽ tạo ra vòng lặp: ${circularPath.join(" → ")}`,
    }
  }

  return { isValid: true }
}
