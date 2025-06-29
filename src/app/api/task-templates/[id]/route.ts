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

    const { skill_ids, ...updateData } = validation.data

    // Check if template exists
    const { data: existingTemplate, error: fetchError } = await supabase
      .from("task_templates")
      .select("id")
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
