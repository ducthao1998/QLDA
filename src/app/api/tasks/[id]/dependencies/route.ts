import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()

  try {
    const { id } = await params

    const { data, error } = await supabase
      .from("task_dependencies")
      .select("id, task_id, depends_on_id")
      .eq("task_id", id)

    if (error) {
      throw error
    }

    return NextResponse.json({ dependencies: data })
  } catch (error) {
    console.error("Error fetching task dependencies:", error)
    return NextResponse.json({ error: "Không thể lấy danh sách phụ thuộc" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await params
  const { dependencies } = await request.json()

  try {
    // Validate input
    if (!Array.isArray(dependencies) || dependencies.length === 0) {
      return NextResponse.json({ error: "Danh sách dependencies không hợp lệ" }, { status: 400 })
    }

    // Insert task dependencies
    const taskDependencies = dependencies.map((depends_on_id) => ({
      task_id: id,
      depends_on_id,
    }))

    const { error } = await supabase.from("task_dependencies").insert(taskDependencies)

    if (error) {
      throw error
    }

    // Record in task history
    await supabase.from("task_history").insert({
      task_id: id,
      action: "dependency_added",
      from_val: null,
      to_val: JSON.stringify(dependencies),
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
