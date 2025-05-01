import { ProjectPhase } from '@/app/types/table-types'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const { data: phases, error } = await supabase
      .from('project_phases')
      .select('*')
      .eq('project_id', id)
      .order('order_no', { ascending: true })

    if (error) {
      console.error('Error fetching phases:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ phases: phases as ProjectPhase[] })
  } catch (error) {
    console.error('Unexpected error in GET phases:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    const body = await request.json()
    if (!body.name || !body.description || typeof body.order_no !== 'number') {
      return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 })
    }

    // Check if order_no already exists
    const { data: existingPhase } = await supabase
      .from('project_phases')
      .select('id')
      .eq('project_id', id)
      .eq('order_no', body.order_no)
      .single()

    if (existingPhase) {
      return NextResponse.json({ error: 'Số thứ tự đã tồn tại' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('project_phases')
      .insert({
        project_id: id,
        name: body.name,
        description: body.description,
        order_no: body.order_no,
      })
      .select()

    if (error) {
      console.error('Error creating phase:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ phase: data[0] as ProjectPhase }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error in POST phase:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}