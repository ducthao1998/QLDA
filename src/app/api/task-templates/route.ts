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

    const { data, error } = await supabase
      .from("task_templates")
      .select(`
        *,
        task_template_skills(
          skill_id,
          skills(name)
        )
      `)
      .order("sequence_order", { ascending: true })

    if (error) {
      console.error("Error fetching task templates:", error)
      return NextResponse.json({ error: "Failed to fetch task templates" }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
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

    const { name, sequence_order, skill_ids, ...restData } = validation.data

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

    return NextResponse.json(template, { status: 201 })
  } catch (error: any) {
    console.error("Error in POST /api/task-templates:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
