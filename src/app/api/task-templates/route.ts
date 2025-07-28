import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import * as z from "zod"

const taskTemplateSchema = z.object({
  name: z.string().min(3, "Tên công việc phải có ít nhất 3 ký tự"),
  description: z.string().optional(),
  applicable_classification: z.array(z.string()).min(1, "Phải chọn ít nhất một phân loại"),
  sequence_order: z.number().int().positive("Thứ tự phải là số nguyên dương"),
  default_duration_days: z.number().int().min(0).optional().nullable(),
  skill_ids: z.array(z.number()).optional(),
  dependency_template_ids: z.array(z.number()).optional(),
})

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get all task templates first
    const { data: templates, error: templatesError } = await supabase
      .from("task_templates")
      .select(`
        *,
        task_template_skills(
          skill_id,
          skills(name)
        )
      `)
      .order("sequence_order", { ascending: true })

    if (templatesError) {
      console.error("Error fetching task templates:", templatesError)
      return NextResponse.json({ error: "Failed to fetch task templates" }, { status: 500 })
    }

    if (!templates || templates.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Get all dependencies in one query
    const { data: dependencies, error: depsError } = await supabase
      .from("task_template_dependencies")
      .select(`
        template_id,
        depends_on_template_id,
        depends_on_template:task_templates!task_template_dependencies_depends_on_template_id_fkey(
          id,
          name,
          sequence_order
        )
      `)

    if (depsError) {
      console.error("Error fetching dependencies:", depsError)
      return NextResponse.json({ error: "Failed to fetch dependencies" }, { status: 500 })
    }

    // Create lookup maps for efficient processing
    const dependenciesMap = new Map<number, any[]>()
    const dependentsMap = new Map<number, any[]>()

    // Process dependencies
    dependencies?.forEach((dep: any) => {
      // Dependencies (what this template depends on)
      if (!dependenciesMap.has(dep.template_id)) {
        dependenciesMap.set(dep.template_id, [])
      }
      dependenciesMap.get(dep.template_id)!.push({
        depends_on_template_id: dep.depends_on_template_id,
        template_name: Array.isArray(dep.depends_on_template)
          ? (dep.depends_on_template[0]?.name || 'Unknown Template')
          : (dep.depends_on_template?.name || 'Unknown Template')
      })

      // Dependents (what depends on this template)
      if (!dependentsMap.has(dep.depends_on_template_id)) {
        dependentsMap.set(dep.depends_on_template_id, [])
      }
      dependentsMap.get(dep.depends_on_template_id)!.push({
        template_id: dep.template_id,
        template_name: templates.find(t => t.id === dep.template_id)?.name || 'Unknown Template'
      })
    })

    // Combine templates with their dependencies and dependents
    const enhancedTemplates = templates.map(template => ({
      ...template,
      dependencies: dependenciesMap.get(template.id) || [],
      dependents: dependentsMap.get(template.id) || []
    }))

    return NextResponse.json({ data: enhancedTemplates })
  } catch (error: any) {
    console.error("Error in GET /api/task-templates:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validation = taskTemplateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Dữ liệu không hợp lệ",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      )
    }

    const { name, sequence_order, skill_ids, dependency_template_ids, ...restData } = validation.data

    // Check for duplicate name
    const { data: existingName, error: nameError } = await supabase
      .from("task_templates")
      .select("id")
      .eq("name", name)
      .maybeSingle()

    if (nameError) {
      console.error("Error checking name:", nameError)
      throw nameError
    }

    if (existingName) {
      return NextResponse.json({ error: `Tên công việc "${name}" đã tồn tại.` }, { status: 409 })
    }

    // Check for duplicate sequence order
    const { data: existingSequence, error: sequenceError } = await supabase
      .from("task_templates")
      .select("id")
      .eq("sequence_order", sequence_order)
      .maybeSingle()

    if (sequenceError) {
      console.error("Error checking sequence:", sequenceError)
      throw sequenceError
    }

    if (existingSequence) {
      return NextResponse.json({ error: `Thứ tự "${sequence_order}" đã được sử dụng.` }, { status: 409 })
    }

    // Kiểm tra circular dependencies nếu có dependency_template_ids
    if (dependency_template_ids && dependency_template_ids.length > 0) {
      const circularCheck = await checkCircularDependencies(supabase, null, dependency_template_ids)
      if (circularCheck.hasCircular) {
        return NextResponse.json({ 
          error: `Phát hiện phụ thuộc vòng tròn với: ${circularCheck.conflictingTemplates.join(', ')}` 
        }, { status: 400 })
      }
    }

    // Insert task template
    const { data: template, error: insertError } = await supabase
      .from("task_templates")
      .insert({
        name,
        sequence_order,
        ...restData,
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error inserting template:", insertError)
      return NextResponse.json({ error: "Lỗi khi tạo công việc mẫu: " + insertError.message }, { status: 500 })
    }

    // Insert skills if provided
    if (skill_ids && skill_ids.length > 0) {
      const skillsToInsert = skill_ids.map((skill_id) => ({
        template_id: template.id,
        skill_id,
      }))

      const { error: skillInsertError } = await supabase.from("task_template_skills").insert(skillsToInsert)

      if (skillInsertError) {
        console.error("Error inserting skills:", skillInsertError)
        // Rollback template creation if skills insertion fails
        await supabase.from("task_templates").delete().eq("id", template.id)
        return NextResponse.json({ error: "Lỗi khi thêm kỹ năng: " + skillInsertError.message }, { status: 500 })
      }
    }

    // Insert dependencies if provided
    if (dependency_template_ids && dependency_template_ids.length > 0) {
      const dependenciesToInsert = dependency_template_ids.map((depends_on_template_id) => ({
        template_id: template.id,
        depends_on_template_id,
      }))

      const { error: dependencyInsertError } = await supabase.from("task_template_dependencies").insert(dependenciesToInsert)

      if (dependencyInsertError) {
        console.error("Error inserting dependencies:", dependencyInsertError)
        // Rollback template creation if dependencies insertion fails
        await supabase.from("task_templates").delete().eq("id", template.id)
        return NextResponse.json({ error: "Lỗi khi thêm phụ thuộc: " + dependencyInsertError.message }, { status: 500 })
      }
    }

    return NextResponse.json(template, { status: 201 })
  } catch (error: any) {
    console.error("Error in POST /api/task-templates:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Helper function để kiểm tra circular dependencies
async function checkCircularDependencies(
  supabase: any, 
  templateId: number | null, 
  dependencyIds: number[]
): Promise<{ hasCircular: boolean; conflictingTemplates: string[] }> {
  
  // Lấy tất cả dependencies hiện tại
  const { data: allDependencies, error } = await supabase
    .from('task_template_dependencies')
    .select(`
      template_id,
      depends_on_template_id,
      template:task_templates!task_template_dependencies_template_id_fkey(name),
      depends_on_template:task_templates!task_template_dependencies_depends_on_template_id_fkey(name)
    `)

  if (error) {
    console.error('Error fetching dependencies for circular check:', error)
    return { hasCircular: false, conflictingTemplates: [] }
  }

  // Tạo adjacency list
  const dependencyGraph: Record<number, number[]> = {}
  const templateNames: Record<number, string> = {}

  // Build current graph
  allDependencies?.forEach((dep: any) => {
    if (!dependencyGraph[dep.template_id]) {
      dependencyGraph[dep.template_id] = []
    }
    dependencyGraph[dep.template_id].push(dep.depends_on_template_id)
    templateNames[dep.template_id] = dep.template?.name || 'Unknown'
    templateNames[dep.depends_on_template_id] = dep.depends_on_template?.name || 'Unknown'
  })

  // Add new dependencies to check
  if (templateId) {
    if (!dependencyGraph[templateId]) {
      dependencyGraph[templateId] = []
    }
    dependencyGraph[templateId] = [...dependencyGraph[templateId], ...dependencyIds]
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

  // Check for cycles starting from any node
  for (const nodeId in dependencyGraph) {
    const node = parseInt(nodeId)
    if (!visited.has(node)) {
      if (dfs(node, [])) {
        return { hasCircular: true, conflictingTemplates: [...new Set(conflictingTemplates)] }
      }
    }
  }

  return { hasCircular: false, conflictingTemplates: [] }
}