import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import * as z from "zod"

const updateTaskTemplateSchema = z.object({
  name: z.string().min(3, "Tên công việc phải có ít nhất 3 ký tự").optional(),
  description: z.string().optional(),
  applicable_classification: z.array(z.string()).min(1, "Phải chọn ít nhất một phân loại").optional(),
  sequence_order: z.number().int().positive("Thứ tự phải là số nguyên dương").optional(),
  default_duration_days: z.number().int().min(0).optional().nullable(),
  skill_ids: z.array(z.number()).optional(),
  dependency_template_ids: z.array(z.number()).optional(),
})

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const templateId = Number.parseInt(params.id)
    if (isNaN(templateId)) {
      return NextResponse.json({ error: "Invalid template ID" }, { status: 400 })
    }

    const body = await request.json()
    const validation = updateTaskTemplateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Dữ liệu không hợp lệ",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      )
    }

    const { skill_ids, dependency_template_ids, ...updateData } = validation.data

    // Check if template exists
    const { data: existingTemplate, error: fetchError } = await supabase
      .from("task_templates")
      .select("id, name")
      .eq("id", templateId)
      .single()

    if (fetchError || !existingTemplate) {
      return NextResponse.json({ error: "Không tìm thấy công việc mẫu" }, { status: 404 })
    }

    // Check for duplicate name (excluding current template)
    if (updateData.name) {
      const { data: existingName, error: nameError } = await supabase
        .from("task_templates")
        .select("id")
        .eq("name", updateData.name)
        .neq("id", templateId)
        .maybeSingle()

      if (nameError) throw nameError

      if (existingName) {
        return NextResponse.json({ error: `Tên công việc "${updateData.name}" đã tồn tại.` }, { status: 409 })
      }
    }

    // Check for duplicate sequence order (excluding current template)
    if (updateData.sequence_order) {
      const { data: existingSequence, error: sequenceError } = await supabase
        .from("task_templates")
        .select("id")
        .eq("sequence_order", updateData.sequence_order)
        .neq("id", templateId)
        .maybeSingle()

      if (sequenceError) throw sequenceError

      if (existingSequence) {
        return NextResponse.json({ error: `Thứ tự "${updateData.sequence_order}" đã được sử dụng.` }, { status: 409 })
      }
    }

    // Kiểm tra circular dependencies nếu có dependency_template_ids
    if (dependency_template_ids !== undefined && dependency_template_ids.length > 0) {
      const circularCheck = await checkCircularDependencies(supabase, templateId, dependency_template_ids)
      if (circularCheck.hasCircular) {
        return NextResponse.json({ 
          error: `Phát hiện phụ thuộc vòng tròn với: ${circularCheck.conflictingTemplates.join(', ')}` 
        }, { status: 400 })
      }
    }

    // Update template
    const { data: updatedTemplate, error: updateError } = await supabase
      .from("task_templates")
      .update(updateData)
      .eq("id", templateId)
      .select()
      .single()

    if (updateError) {
      console.error("Error updating template:", updateError)
      return NextResponse.json({ error: "Lỗi khi cập nhật: " + updateError.message }, { status: 500 })
    }

    // Update skills if provided
    if (skill_ids !== undefined) {
      // Delete existing skills
      const { error: deleteSkillsError } = await supabase
        .from("task_template_skills")
        .delete()
        .eq("template_id", templateId)

      if (deleteSkillsError) {
        console.error("Error deleting skills:", deleteSkillsError)
        return NextResponse.json({ error: "Lỗi khi cập nhật kỹ năng" }, { status: 500 })
      }

      // Insert new skills
      if (skill_ids.length > 0) {
        const skillsToInsert = skill_ids.map((skill_id) => ({
          template_id: templateId,
          skill_id,
        }))

        const { error: insertSkillsError } = await supabase.from("task_template_skills").insert(skillsToInsert)

        if (insertSkillsError) {
          console.error("Error inserting skills:", insertSkillsError)
          return NextResponse.json({ error: "Lỗi khi cập nhật kỹ năng" }, { status: 500 })
        }
      }
    }

    // Update dependencies if provided
    if (dependency_template_ids !== undefined) {
      // Delete existing dependencies
      const { error: deleteDependenciesError } = await supabase
        .from("task_template_dependencies")
        .delete()
        .eq("template_id", templateId)

      if (deleteDependenciesError) {
        console.error("Error deleting dependencies:", deleteDependenciesError)
        return NextResponse.json({ error: "Lỗi khi cập nhật phụ thuộc" }, { status: 500 })
      }

      // Insert new dependencies
      if (dependency_template_ids.length > 0) {
        const dependenciesToInsert = dependency_template_ids.map((depends_on_template_id) => ({
          template_id: templateId,
          depends_on_template_id,
        }))

        const { error: insertDependenciesError } = await supabase.from("task_template_dependencies").insert(dependenciesToInsert)

        if (insertDependenciesError) {
          console.error("Error inserting dependencies:", insertDependenciesError)
          return NextResponse.json({ error: "Lỗi khi cập nhật phụ thuộc" }, { status: 500 })
        }
      }
    }

    return NextResponse.json(updatedTemplate)
  } catch (error: any) {
    console.error("Error in PUT /api/task-templates/[id]:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const templateId = Number.parseInt(params.id)
    if (isNaN(templateId)) {
      return NextResponse.json({ error: "Invalid template ID" }, { status: 400 })
    }

    // Kiểm tra xem có template nào phụ thuộc vào template này không
    const { data: dependentTemplates, error: dependentError } = await supabase
      .from("task_template_dependencies")
      .select(`
        template_id,
        template:task_templates!task_template_dependencies_template_id_fkey(name)
      `)
      .eq("depends_on_template_id", templateId)

    if (dependentError) {
      console.error("Error checking dependent templates:", dependentError)
      return NextResponse.json({ error: "Lỗi khi kiểm tra phụ thuộc" }, { status: 500 })
    }

    if (dependentTemplates && dependentTemplates.length > 0) {
      const dependentNames = dependentTemplates.map(dep => dep.template?.name).filter(name => name).join(', ')
      return NextResponse.json({ 
        error: `Không thể xóa công việc mẫu này vì các công việc sau đang phụ thuộc vào nó: ${dependentNames}. Vui lòng xóa các phụ thuộc trước.` 
      }, { status: 400 })
    }

    // Delete template (cascade will handle related records)
    const { error: deleteError } = await supabase.from("task_templates").delete().eq("id", templateId)

    if (deleteError) {
      console.error("Error deleting template:", deleteError)
      return NextResponse.json({ error: "Lỗi khi xóa: " + deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error in DELETE /api/task-templates/[id]:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Helper function để kiểm tra circular dependencies
async function checkCircularDependencies(
  supabase: any, 
  templateId: number, 
  newDependencyIds: number[]
): Promise<{ hasCircular: boolean; conflictingTemplates: string[] }> {
  
  // Lấy tất cả dependencies hiện tại (trừ template đang update)
  const { data: allDependencies, error } = await supabase
    .from('task_template_dependencies')
    .select(`
      template_id,
      depends_on_template_id,
      template:task_templates!task_template_dependencies_template_id_fkey(name),
      depends_on_template:task_templates!task_template_dependencies_depends_on_template_id_fkey(name)
    `)
    .neq('template_id', templateId) // Loại trừ template hiện tại

  if (error) {
    console.error('Error fetching dependencies for circular check:', error)
    return { hasCircular: false, conflictingTemplates: [] }
  }

  // Tạo adjacency list
  const dependencyGraph: Record<number, number[]> = {}
  const templateNames: Record<number, string> = {}

  // Build current graph (excluding current template)
  allDependencies?.forEach(dep => {
    if (!dependencyGraph[dep.template_id]) {
      dependencyGraph[dep.template_id] = []
    }
    dependencyGraph[dep.template_id].push(dep.depends_on_template_id)
    templateNames[dep.template_id] = dep.template?.name || 'Unknown'
    templateNames[dep.depends_on_template_id] = dep.depends_on_template?.name || 'Unknown'
  })

  // Add new dependencies for the template being updated
  dependencyGraph[templateId] = newDependencyIds

  // Get template name for current template
  const { data: currentTemplate } = await supabase
    .from('task_templates')
    .select('name')
    .eq('id', templateId)
    .single()
  
  if (currentTemplate) {
    templateNames[templateId] = currentTemplate.name
  }

  // DFS to detect cycles
  const visited = new Set<number>()
  const recursionStack = new Set<number>()
  const conflictingTemplates: string[] = []

  function dfs(node: number, path: number[]): boolean {
    if (recursionStack.has(node)) {
      // Found cycle - collect template names in cycle
      const cycleStart = path.indexOf(node)
      const cycle = path.slice(cycleStart).concat([node])
      cycle.forEach(id => {
        if (templateNames[id]) {
          conflictingTemplates.push(templateNames[id])
        }
      })
      return true
    }

    if (visited.has(node)) {
      return false
    }

    visited.add(node)
    recursionStack.add(node)
    path.push(node)

    const dependencies = dependencyGraph[node] || []
    for (const dep of dependencies) {
      if (dfs(dep, [...path])) {
        return true
      }
    }

    recursionStack.delete(node)
    return false
  }

  // Check for cycles starting from the updated template
  if (dfs(templateId, [])) {
    return { hasCircular: true, conflictingTemplates: [...new Set(conflictingTemplates)] }
  }

  return { hasCircular: false, conflictingTemplates: [] }
}