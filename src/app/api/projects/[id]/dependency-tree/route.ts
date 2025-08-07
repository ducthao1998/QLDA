import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  try {
    const projectId = await params.id

    // Lấy tất cả tasks trong project
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        id,
        name,
        status,
        duration_days,
        created_at
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (tasksError) {
      throw tasksError
    }

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({
        tasks: [],
        dependencies: [],
        tree: null
      })
    }

    // Lấy tất cả dependencies trong project
    const taskIds = tasks.map(t => t.id)
    const { data: dependencies, error: depsError } = await supabase
      .from('task_dependencies')
      .select(`
        task_id,
        depends_on_id
      `)
      .in('task_id', taskIds)
      .in('depends_on_id', taskIds)

    if (depsError) {
      throw depsError
    }

    // Tạo adjacency map
    const dependencyMap = new Map<string, string[]>()
    const reverseDependencyMap = new Map<string, string[]>()

    // Initialize maps
    tasks.forEach(task => {
      dependencyMap.set(task.id, [])
      reverseDependencyMap.set(task.id, [])
    })

    // Populate dependency maps
    dependencies?.forEach(dep => {
      // task_id depends on depends_on_id
      dependencyMap.get(dep.task_id)?.push(dep.depends_on_id)
      // depends_on_id is depended by task_id
      reverseDependencyMap.get(dep.depends_on_id)?.push(dep.task_id)
    })

    // Tạo tree structure với levels
    const visited = new Set<string>()
    const levels = new Map<string, number>()
    const tree: any = {
      nodes: [],
      edges: [],
      levels: []
    }

    // Tìm root nodes (không có dependencies)
    const rootNodes = tasks.filter(task => 
      !dependencyMap.get(task.id)?.length
    )

    // BFS để tính levels
    const queue: Array<{ taskId: string, level: number }> = []
    
    rootNodes.forEach(task => {
      queue.push({ taskId: task.id, level: 0 })
      levels.set(task.id, 0)
    })

    while (queue.length > 0) {
      const { taskId, level } = queue.shift()!
      
      if (visited.has(taskId)) continue
      visited.add(taskId)

      // Add children to next level
      const children = reverseDependencyMap.get(taskId) || []
      children.forEach(childId => {
        if (!visited.has(childId)) {
          const newLevel = Math.max(level + 1, levels.get(childId) || 0)
          levels.set(childId, newLevel)
          queue.push({ taskId: childId, level: newLevel })
        }
      })
    }

    // Handle orphaned nodes (circular dependencies or isolated)
    tasks.forEach(task => {
      if (!levels.has(task.id)) {
        levels.set(task.id, 0)
      }
    })

    // Group tasks by level
    const maxLevel = Math.max(...Array.from(levels.values()))
    const levelGroups: string[][] = []
    
    for (let i = 0; i <= maxLevel; i++) {
      levelGroups[i] = []
    }

    tasks.forEach(task => {
      const level = levels.get(task.id) || 0
      levelGroups[level].push(task.id)
    })

    // Create nodes with positions
    const nodes = tasks.map(task => {
      const level = levels.get(task.id) || 0
      const levelTasks = levelGroups[level]
      const indexInLevel = levelTasks.indexOf(task.id)
      
      return {
        id: task.id,
        name: task.name,
        status: task.status,
        duration_days: task.duration_days,
        level: level,
        indexInLevel: indexInLevel,
        totalInLevel: levelTasks.length,
        dependencies: dependencyMap.get(task.id) || [],
        dependents: reverseDependencyMap.get(task.id) || []
      }
    })

    // Create edges
    const edges = dependencies?.map(dep => ({
      from: dep.depends_on_id,
      to: dep.task_id,
      type: 'dependency'
    })) || []

    tree.nodes = nodes
    tree.edges = edges
    tree.levels = levelGroups
    tree.maxLevel = maxLevel

    return NextResponse.json({
      tasks,
      dependencies: dependencies || [],
      tree
    })

  } catch (error: any) {
    console.error('Error fetching dependency tree:', error)
    return NextResponse.json(
      { error: 'Không thể lấy dependency tree' },
      { status: 500 }
    )
  }
}
