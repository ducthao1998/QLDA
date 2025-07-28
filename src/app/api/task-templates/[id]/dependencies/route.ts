import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Lấy danh sách dependencies của task template
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const templateId = await params

  try {
    const { data: dependencies, error } = await supabase
      .from('task_template_dependencies')
      .select(`
        *,
        depends_on_template:depends_on_template_id (
          id,
          name,
          sequence_order,
          applicable_classification
        )
      `)
      .eq('template_id', templateId.id)

    if (error) {
      console.error('Error fetching template dependencies:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ dependencies })
  } catch (error: any) {
    console.error('Error in GET /api/task-templates/[id]/dependencies:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Thêm dependency mới
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const templateId = await params

  try {
    const body = await req.json()
    const { depends_on_template_id } = body

    if (!depends_on_template_id) {
      return NextResponse.json(
        { error: 'depends_on_template_id is required' },
        { status: 400 }
      )
    }

    // Kiểm tra xem dependency đã tồn tại chưa
    const { data: existing } = await supabase
      .from('task_template_dependencies')
      .select('id')
      .eq('template_id', templateId.id)
      .eq('depends_on_template_id', depends_on_template_id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Dependency already exists' },
        { status: 400 }
      )
    }

    // Thêm dependency mới
    const { data: dependency, error } = await supabase
      .from('task_template_dependencies')
      .insert({
        template_id: parseInt(templateId.id),
        depends_on_template_id: depends_on_template_id
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating template dependency:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ dependency })
  } catch (error: any) {
    console.error('Error in POST /api/task-templates/[id]/dependencies:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Xóa tất cả dependencies của template
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const templateId = await params

  try {
    const { error } = await supabase
      .from('task_template_dependencies')
      .delete()
      .eq('template_id', templateId.id)

    if (error) {
      console.error('Error deleting template dependencies:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Dependencies deleted successfully' })
  } catch (error: any) {
    console.error('Error in DELETE /api/task-templates/[id]/dependencies:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
