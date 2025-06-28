import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, color } = body

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const { data: field, error } = await supabase
      .from('skill_fields')
      .update({
        name,
        description,
        color: color || 'blue',
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating skill field:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!field) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 })
    }

    return NextResponse.json({ data: field })
  } catch (error) {
    console.error('Error in PUT /api/skills/fields/[id]:', error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if field has any skills before deleting
    const { data: skills, error: skillsError } = await supabase
      .from('skills')
      .select('id')
      .eq('field_id', params.id)
      .limit(1)

    if (skillsError) {
      console.error('Error checking field skills:', skillsError)
      return NextResponse.json({ error: skillsError.message }, { status: 500 })
    }

    if (skills && skills.length > 0) {
      return NextResponse.json({ 
        error: "Cannot delete field that has skills" 
      }, { status: 400 })
    }

    const { error } = await supabase
      .from('skill_fields')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting skill field:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/skills/fields/[id]:', error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
} 