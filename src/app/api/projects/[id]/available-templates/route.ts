import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 })
    }

    const projectId = params.id

    // Get templates already added to this project
    const { data: existingTasks, error: tasksError } = await supabase
      .from("tasks")
      .select("template_id")
      .eq("project_id", projectId)
      .not("template_id", "is", null)

    if (tasksError) {
      return NextResponse.json({ error: tasksError.message }, { status: 500 })
    }

    const usedTemplateIds = (existingTasks || [])
      .map((t: any) => t.template_id)
      .filter((id: any) => id != null)

    // Fetch templates that are not yet used in this project
    let query = supabase
      .from("task_templates")
      .select("id, name, description")

    if (usedTemplateIds.length > 0) {
      query = query.not("id", "in", `(${usedTemplateIds.join(",")})`)
    }

    const { data: templates, error: templatesError } = await query.order("name")

    if (templatesError) {
      return NextResponse.json({ error: templatesError.message }, { status: 500 })
    }

    // Shape to match client expectations
    const result = (templates || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      phase: "",
    }))

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Error in GET /api/projects/[id]/available-templates:", error)
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 })
  }
}


