import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  // First, verify the user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch data from the user_skill_matrix view
  const { data, error } = await supabase
    .from('user_skill_matrix')
    .select('*')
    .order('full_name', { ascending: true })
    .order('skill_field', { ascending: true })

  if (error) {
    console.error('Error fetching skill matrix data:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Process the data to group skills by user for easier rendering
  const processedData = data.reduce((acc: any[], curr) => {
    const { user_id, full_name, ...skillData } = curr

    let existingUser = acc.find(u => u.user_id === user_id)

    if (existingUser) {
      existingUser.skills.push(skillData)
    } else {
      acc.push({
        user_id,
        full_name,
        skills: [skillData],
      })
    }

    return acc
  }, [])

  return NextResponse.json(processedData)
}
