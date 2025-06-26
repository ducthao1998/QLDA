import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import * as z from 'zod'

const taskTemplateSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  applicable_classification: z.array(z.string()).min(1),
  sequence_order: z.number().int().positive(),
  default_duration_days: z.number().int().min(0).optional().nullable(),
  required_skill_id: z.string().optional().nullable(),
})

// Các hàm GET và POST đã được cập nhật
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('task_templates')
      .select('*, skills(name)')
      .order('sequence_order', { ascending: true })

    if (error) {
      console.error('Error fetching task templates:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in GET /api/task-templates:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validation = taskTemplateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 },
      )
    }

    const { name, sequence_order } = validation.data

    // --- LOGIC VALIDATION CHỐNG TRÙNG LẶP ---
    // 1. Kiểm tra tên công việc có bị trùng trong cùng lĩnh vực và giai đoạn không
    const { data: existingName, error: nameError } = await supabase
      .from('task_templates')
      .select('id')
      .eq('name', name)
      .maybeSingle()

    if (nameError) throw nameError
    if (existingName) {
      return NextResponse.json(
        {
          error: `Tên công việc "${name}" đã tồn tại trong giai đoạn này.`,
        },
        { status: 409 }, // 409 Conflict là mã lỗi phù hợp
      )
    }
    
    // 2. Kiểm tra thứ tự có bị trùng trong cùng lĩnh vực và giai đoạn không
    const { data: existingSequence, error: sequenceError } = await supabase
      .from('task_templates')
      .select('id')
      .eq('sequence_order', sequence_order)
      .maybeSingle()
      
    if (sequenceError) throw sequenceError
    if (existingSequence) {
        return NextResponse.json(
            {
                error: `Thứ tự "${sequence_order}" đã được sử dụng trong giai đoạn này.`,
            },
            { status: 409 },
        )
    }
    // --- KẾT THÚC LOGIC VALIDATION ---
    console
    const dataToInsert = {
      ...validation.data,
      required_skill_id: validation.data.required_skill_id
        ? parseInt(validation.data.required_skill_id, 10)
        : null,
    }

    const { data, error: insertError } = await supabase
      .from('task_templates')
      .insert(dataToInsert)
      .select()
      .single()

    if (insertError) {
      console.error('Error creating task template:', insertError)
      // Lỗi này có thể xảy ra nếu có race condition (2 người tạo cùng lúc)
      // và constraint ở DB đã ngăn chặn.
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/task-templates:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}
