import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildExperienceMatrix } from '@/algorithm/experience-matrix'
import { constrainedHungarianAssignment } from '@/algorithm/hungarian-assignment'

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; taskId: string } }
) {
  try {
    const supabase = await createClient()
    
    // Get task details
    const { data: task } = await supabase
      .from('tasks')
      .select('id, name, duration_days, task_skills(skill_id)')
      .eq('id', params.taskId)
      .single()

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Get all users
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('is_active', true)

    if (!users || users.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Get all skills
    const { data: skills } = await supabase
      .from('skills')
      .select('id, name')

    if (!skills || skills.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Get task skills
    const taskSkills = task.task_skills?.map((ts: any) => ts.skill_id) || []
    
    if (taskSkills.length === 0) {
      return NextResponse.json({ data: [] })
    }

    // Get user skills data
    const { data: userSkillsData } = await supabase
      .from('user_skill_matrix')
      .select('*')

    // Build experience matrix
    const experienceMatrix = await buildExperienceMatrix(
      users.map(u => u.id),
      taskSkills,
      params.taskId
    )

    // Create task for algorithm
    const taskForAlgorithm = {
      id: task.id.toString(),
      name: task.name,
      required_skills: taskSkills,
      duration_days: task.duration_days || 1,
      priority: 2, // medium priority
      estimated_hours: (task.duration_days || 1) * 8
    }

    // Create users for algorithm
    const algorithmUsers = users.map(user => ({
      id: user.id,
      name: user.full_name,
      current_workload: 0,
      max_concurrent_tasks: 2
    }))

    // Run Hungarian algorithm
    const assignments = constrainedHungarianAssignment(
      [taskForAlgorithm],
      algorithmUsers,
      experienceMatrix,
      2
    )

    // Get current workload
    const { data: workloadData } = await supabase
      .from('user_workload')
      .select('user_id, current_workload')

    const workloadMap = new Map(
      (workloadData || []).map((w: any) => [w.user_id, w.current_workload || 0])
    )

    // Format recommendations
    const recommendations = assignments
      .filter(assignment => assignment.task_id.toString() === params.taskId)
      .map(assignment => {
        const user = users.find(u => u.id === assignment.user_id)
        if (!user) return null

        return {
          user_id: assignment.user_id,
          full_name: user.full_name,
          completed_tasks_count: Math.round(assignment.confidence_score || 0),
          workload: workloadMap.get(assignment.user_id) || 0
        }
      })
      .filter((rec): rec is any => rec !== null)
      .slice(0, 5)

    return NextResponse.json({ data: recommendations })
  } catch (error) {
    console.error('Error in recommended-users API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 