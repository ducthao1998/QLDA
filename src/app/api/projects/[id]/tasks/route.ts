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

    // Get current user's org_unit
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("org_unit")
      .eq("id", user.id)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json({ error: "Không thể lấy thông tin người dùng" }, { status: 500 })
    }

    // Check if project belongs to user's org_unit
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(`
        *,
        users!created_by (
          org_unit
        )
      `)
      .eq("id", projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 })
    }

    if (project.users.org_unit !== currentUser.org_unit) {
      return NextResponse.json({ error: "Bạn không có quyền truy cập dự án này" }, { status: 403 })
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
        ),
        task_skills!inner (
          skills (
            id,
            name
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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current user's org_unit
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("org_unit")
      .eq("id", user.id)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json({ error: "Không thể lấy thông tin người dùng" }, { status: 500 })
    }

    // Check if project belongs to user's org_unit
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(`
        *,
        users!created_by (
          org_unit
        )
      `)
      .eq("id", projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 })
    }

    if (project.users.org_unit !== currentUser.org_unit) {
      return NextResponse.json({ error: "Bạn không có quyền tạo công việc cho dự án này" }, { status: 403 })
    }

    const body = await request.json()
    const { dependencies, ...taskData } = body
    
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        ...taskData,
        project_id: projectId
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating task:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Tạo task dependencies nếu có
    if (dependencies && Array.isArray(dependencies) && dependencies.length > 0) {
      const taskDependencies = dependencies.map((depends_on_id: string) => ({
        task_id: task.id,
        depends_on_id,
      }))

      const { error: depError } = await supabase
        .from("task_dependencies")
        .insert(taskDependencies)

      if (depError) {
        console.error("Error creating task dependencies:", depError)
        // Không fail toàn bộ request, chỉ log error
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

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id: projectId } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current user's org_unit
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("org_unit")
      .eq("id", user.id)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json({ error: "Không thể lấy thông tin người dùng" }, { status: 500 })
    }

    // Check if project belongs to user's org_unit
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(`
        *,
        users!created_by (
          org_unit
        )
      `)
      .eq("id", projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 })
    }

    if (project.users.org_unit !== currentUser.org_unit) {
      return NextResponse.json({ error: "Bạn không có quyền chỉnh sửa công việc của dự án này" }, { status: 403 })
    }

    const body = await request.json()
    const { data: task, error } = await supabase
      .from("tasks")
      .update(body)
      .eq("id", body.id)
      .select()
      .single()

    if (error) {
      console.error("Error updating task:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ task })
  } catch (error) {
    console.error("Error in PUT /api/projects/[id]/tasks:", error)
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id: projectId } = await params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current user's org_unit
    const { data: currentUser, error: userError } = await supabase
      .from("users")
      .select("org_unit")
      .eq("id", user.id)
      .single()

    if (userError || !currentUser) {
      return NextResponse.json({ error: "Không thể lấy thông tin người dùng" }, { status: 500 })
    }

    // Check if project belongs to user's org_unit
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(`
        *,
        users!created_by (
          org_unit
        )
      `)
      .eq("id", projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 })
    }

    if (project.users.org_unit !== currentUser.org_unit) {
      return NextResponse.json({ error: "Bạn không có quyền xóa công việc của dự án này" }, { status: 403 })
    }

    const url = new URL(request.url)
    const taskId = url.searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)

    if (error) {
      console.error("Error deleting task:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/projects/[id]/tasks:", error)
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
