import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  try {
    const { id } = await params

    // Lấy dependencies với thông tin chi tiết của task phụ thuộc
    const { data, error } = await supabase
      .from("task_dependencies")
      .select(`
        id,
        task_id,
        depends_on_id,
        created_at,
        updated_at,
        dependency_task:tasks!task_dependencies_depends_on_id_fkey (
          id,
          name,
          status,
          start_date,
          end_date
        )
      `)
      .eq("task_id", id)

    if (error) {
      throw error
    }

    // Tính toán progress percentage cho mỗi dependency
    const dependenciesWithProgress = await Promise.all(
      (data || []).map(async (dep: any) => {
        let progressPercentage = 0
        
        if (dep.dependency_task) {
          // dependency_task có thể là array, lấy phần tử đầu tiên
          const depTask = Array.isArray(dep.dependency_task) ? dep.dependency_task[0] : dep.dependency_task
          
          if (depTask) {
            // Tính progress dựa trên status
            switch (depTask.status) {
              case "done":
                progressPercentage = 100
                break
              case "in_progress":
                // Có thể tính toán dựa trên thời gian hoặc worklogs
                // Tạm thời set 50% cho in_progress
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
          ...dep,
          dependency_task: dep.dependency_task ? {
            ...(Array.isArray(dep.dependency_task) ? dep.dependency_task[0] : dep.dependency_task),
            progress_percentage: progressPercentage
          } : null
        }
      })
    )

    return NextResponse.json({ dependencies: dependenciesWithProgress })
  } catch (error) {
    console.error("Error fetching task dependencies:", error)
    return NextResponse.json({ error: "Không thể lấy danh sách phụ thuộc" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  try {
    // Support both formats: { dependencies: [...] } and { task_id, depends_on_id }
    let taskDependencies: { task_id: string; depends_on_id: string }[] = []

    if (body.dependencies && Array.isArray(body.dependencies)) {
      // Format from bulk operations: { dependencies: [...] }
      if (body.dependencies.length === 0) {
        return NextResponse.json({ error: "Danh sách dependencies không hợp lệ" }, { status: 400 })
      }

      taskDependencies = body.dependencies.map((depends_on_id: string) => ({
        task_id: id,
        depends_on_id,
      }))
    } else if (body.task_id && body.depends_on_id) {
      // Format from individual operations: { task_id, depends_on_id }
      taskDependencies = [{
        task_id: body.task_id,
        depends_on_id: body.depends_on_id,
      }]
    } else {
      return NextResponse.json({ error: "Dữ liệu dependency không hợp lệ" }, { status: 400 })
    }

    // Check for circular dependencies
    for (const dep of taskDependencies) {
      if (dep.task_id === dep.depends_on_id) {
        return NextResponse.json({ error: "Không thể tạo phụ thuộc vòng tròn" }, { status: 400 })
      }

      // Check if the dependency would create a cycle
      const { data: existingDeps } = await supabase
        .from("task_dependencies")
        .select("task_id")
        .eq("depends_on_id", dep.task_id)

      if (existingDeps?.some(existing => existing.task_id === dep.depends_on_id)) {
        return NextResponse.json({ error: "Phụ thuộc này sẽ tạo ra vòng tròn" }, { status: 400 })
      }
    }

    // Insert task dependencies
    const { error } = await supabase.from("task_dependencies").insert(taskDependencies)

    if (error) {
      throw error
    }

    // Record in task history
    await supabase.from("task_history").insert({
      task_id: id,
      action: "dependency_added",
      from_val: null,
      to_val: JSON.stringify(taskDependencies.map(dep => dep.depends_on_id)),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error adding task dependencies:", error)
    return NextResponse.json({ error: "Không thể thêm phụ thuộc cho công việc" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await  params

  try {
    // Get current dependencies for history
    const { data: currentDeps } = await supabase.from("task_dependencies").select("depends_on_id").eq("task_id", id)

    // Delete dependencies
    const { error } = await supabase.from("task_dependencies").delete().eq("task_id", id)

    if (error) {
      throw error
    }

    // Record in task history
    if (currentDeps && currentDeps.length > 0) {
      await supabase.from("task_history").insert({
        task_id: id,
        action: "dependency_removed",
        from_val: JSON.stringify(currentDeps.map((d) => d.depends_on_id)),
        to_val: null,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting task dependencies:", error)
    return NextResponse.json({ error: "Không thể xóa phụ thuộc của công việc" }, { status: 500 })
  }
}
