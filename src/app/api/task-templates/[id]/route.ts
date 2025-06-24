import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import * as z from 'zod'

// Schema cho việc cập nhật, tất cả các trường đều là optional
const updateTaskTemplateSchema = z.object({
  name: z.string().min(3).optional(),
  description: z.string().optional(),
  project_field: z.string().optional(),
  phase: z.string().optional(),
  applicable_classification: z.array(z.string()).min(1).optional(),
  sequence_order: z.number().int().positive().optional(),
  default_duration_days: z.number().int().min(0).optional().nullable(),
  required_skill_id: z.string().optional().nullable(),
})

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // TODO: Thêm logic kiểm tra vai trò người dùng (chỉ admin/manager được sửa)
    
    const id = params.id
    const body = await request.json()
    const validation = updateTaskTemplateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 },
      )
    }

    // Chuyển đổi required_skill_id từ string rỗng thành null nếu cần
    const dataToUpdate = {
      ...validation.data,
      required_skill_id: validation.data.required_skill_id ? parseInt(validation.data.required_skill_id, 10) : null,
    };


    const { data, error } = await supabase
      .from('task_templates')
      .update(dataToUpdate)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating task template:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
     const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // TODO: Thêm logic kiểm tra vai trò người dùng (chỉ admin/manager được xóa)
    
    const id = params.id

    const { error } = await supabase.from('task_templates').delete().eq('id', id)

    if (error) {
      console.error('Error deleting task template:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Template deleted successfully' }, { status: 200 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}
