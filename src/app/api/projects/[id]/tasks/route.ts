import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { Task } from "@/app/types/table-types"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id: projectId } = await params
    const url = new URL(request.url)
    const skill_id = url.searchParams.get("skill_id")

    // If skill_id is provided, return recommended users
    if (skill_id) {
      const recommendedUsers = await getRecommendedUsers(supabase, {
        skill_id: parseInt(skill_id),
        project_id: projectId
      })
      return NextResponse.json({ users: recommendedUsers })
    }

    // Otherwise return project tasks
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(`
        *,
        users:assigned_to (
          full_name,
          position,
          org_unit
        ),
        projects (
          name
        ),
        task_raci (
          user_id,
          role,
          users (
            full_name
          )
        )
      `)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError)
      return NextResponse.json({ error: tasksError.message }, { status: 500 })
    }

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error("Error in GET /api/projects/[id]/tasks:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id: projectId } = await params

    const body = await request.json()
    const { skill_ids, ...taskData } = body
    
    // Validate dates if provided
    if (taskData.start_date && taskData.end_date) {
      const startDate = new Date(taskData.start_date)
      const endDate = new Date(taskData.end_date)
      if (endDate < startDate) {
        return NextResponse.json({ error: "Ngày kết thúc phải sau ngày bắt đầu" }, { status: 400 })
      }
    }

    // Tạo task mới
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        ...taskData,
        project_id: projectId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (taskError) {
      console.error("Error creating task:", taskError)
      return NextResponse.json({ error: taskError.message }, { status: 500 })
    }

    // Nếu có skill_ids, tạo các record trong task_skills
    if (skill_ids && skill_ids.length > 0) {
      const taskSkills = skill_ids.map((skill_id: number) => ({
        task_id: task.id,
        skill_id: skill_id
      }))

      const { error: taskSkillError } = await supabase
        .from("task_skills")
        .insert(taskSkills)

      if (taskSkillError) {
        console.error("Error creating task_skills:", taskSkillError)
        return NextResponse.json({ error: taskSkillError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error("Error in POST /api/projects/[id]/tasks:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

export interface RecommendedUserInput {
  skill_id: number;
  project_id: string;
}

export interface RecommendedUser {
  user_id: string;
  full_name: string;
  position: string;
  skill_level: number;
  avg_quality: number;
  pct_on_time: number;
  match_score: number;
}

export async function getRecommendedUsers(
  supabase: any,
  { skill_id, project_id }: RecommendedUserInput
): Promise<RecommendedUser[]> {
  // Fetch users with the required skill
  const { data: skilledUsers } = await supabase
    .from("user_skills")
    .select("user_id, level")
    .eq("skill_id", skill_id);

  if (!skilledUsers || skilledUsers.length === 0) {
    // If no users with the skill, return all users as potential assignees
    const { data: allUsers } = await supabase
      .from("users")
      .select("id, full_name, position");

    return allUsers.map((user: any) => ({
      user_id: user.id,
      full_name: user.full_name,
      position: user.position,
      skill_level: 1,
      avg_quality: 0,
      pct_on_time: 0,
      match_score: 0
    }));
  }

  const userIds = skilledUsers.map((u: any) => u.user_id);

  // Fetch user information
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, position")
    .in("id", userIds);

  // Return basic information without performance metrics
  return users.map((user: any) => {
    const skill = skilledUsers.find((u: any) => u.user_id === user.id);
    return {
      user_id: user.id,
      full_name: user.full_name,
      position: user.position,
      skill_level: skill?.level || 1,
      avg_quality: 0,
      pct_on_time: 0,
      match_score: 0
    };
  });
}
