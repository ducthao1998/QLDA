import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

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
    const { name, field, description } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Tên kỹ năng không được để trống" }, { status: 400 })
    }

    const { data: skill, error } = await supabase
      .from('skills')
      .update({
        name: name.trim(),
        field: field?.trim() || null,
        description: description?.trim() || null
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating skill:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!skill) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 })
    }

    return NextResponse.json({ data: skill })
  } catch (error) {
    console.error('Error in PUT /api/skills/[id]:', error)
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

    // Check if skill is being used in task_skills
    const { data: taskSkills, error: taskSkillsError } = await supabase
      .from('task_skills')
      .select('id')
      .eq('skill_id', params.id)
      .limit(1)

    if (taskSkillsError) {
      console.error('Error checking task skills:', taskSkillsError)
      return NextResponse.json({ error: taskSkillsError.message }, { status: 500 })
    }

    if (taskSkills && taskSkills.length > 0) {
      return NextResponse.json({ 
        error: "Cannot delete skill that is assigned to tasks" 
      }, { status: 400 })
    }

    // Check if skill is being used in user_skills
    const { data: userSkills, error: userSkillsError } = await supabase
      .from('user_skills')
      .select('id')
      .eq('skill_id', params.id)
      .limit(1)

    if (userSkillsError) {
      console.error('Error checking user skills:', userSkillsError)
      return NextResponse.json({ error: userSkillsError.message }, { status: 500 })
    }

    if (userSkills && userSkills.length > 0) {
      return NextResponse.json({ 
        error: "Cannot delete skill that is assigned to users" 
      }, { status: 400 })
    }

    const { error } = await supabase
      .from('skills')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting skill:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/skills/[id]:', error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
} 