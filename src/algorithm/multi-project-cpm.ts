import { Task, TaskDependency, Project } from "@/app/types/table-types"

interface TaskNode {
  id: string;
  name: string;
  project_id: string;
  duration: number;
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  slack: number;
  dependencies: string[];
  successors: string[];
  isCritical: boolean;
}

interface ProjectCPMResult {
  project_id: string;
  critical_path: string[];
  total_duration: number;
  earliest_completion: Date;
  latest_completion: Date;
  float_time: number;
}

interface MultiProjectCPMResult {
  global_critical_path: string[];
  project_results: ProjectCPMResult[];
  global_makespan: number;
  resource_conflicts: Array<{
    task_ids: string[];
    conflict_type: 'time_overlap' | 'resource_constraint';
    severity: 'low' | 'medium' | 'high';
  }>;
  inter_project_dependencies: Array<{
    from_project: string;
    to_project: string;
    dependency_count: number;
    critical_dependencies: string[];
  }>;
}

/**
 * Thuật toán Multi-Project CPM
 * 
 * Input: Tất cả projects, dependencies từ bảng task_dependencies
 * Output: Critical paths, earliest/latest times
 * Xử lý: Dependencies giữa tasks của các dự án khác nhau
 */
export function multiProjectCPM(
  projects: Project[],
  allTasks: Task[],
  allDependencies: TaskDependency[],
  globalResources?: any[]
): MultiProjectCPMResult {
  // 1. Build global task graph
  const taskGraph = new Map<string, TaskNode>();
  
  // Initialize all task nodes
  allTasks.forEach(task => {
    const duration = task.duration_days || 1; // Convert days to duration units
    
    taskGraph.set(String(task.id), {
      id: String(task.id),
      name: task.name,
      project_id: String(task.project_id),
      duration,
      earliestStart: 0,
      earliestFinish: 0,
      latestStart: 0,
      latestFinish: 0,
      slack: 0,
      dependencies: [],
      successors: [],
      isCritical: false
    });
  });

  // Add dependencies and build successor relationships
  allDependencies.forEach(dep => {
    const task = taskGraph.get(String(dep.task_id));
    const predecessor = taskGraph.get(String(dep.depends_on_id));
    
    if (task && predecessor) {
      task.dependencies.push(String(dep.depends_on_id));
      predecessor.successors.push(String(dep.task_id));
    }
  });

  // 2. Forward pass - Calculate earliest start and finish times
  const visited = new Set<string>();
  
  function forwardPass(taskId: string): void {
    if (visited.has(taskId)) return;
    visited.add(taskId);

    const task = taskGraph.get(taskId);
    if (!task) return;

    // Process all dependencies first
    task.dependencies.forEach(depId => {
      forwardPass(depId);
    });

    // Calculate earliest start based on dependencies
    if (task.dependencies.length > 0) {
      task.earliestStart = Math.max(
        ...task.dependencies.map(depId => {
          const depTask = taskGraph.get(depId);
          return depTask ? depTask.earliestFinish : 0;
        })
      );
    } else {
      task.earliestStart = 0; // Start tasks begin at time 0
    }

    task.earliestFinish = task.earliestStart + task.duration;
  }

  // Process all tasks
  allTasks.forEach(task => forwardPass(String(task.id)));

  // 3. Calculate project completion times
  const projectResults: ProjectCPMResult[] = projects.map(project => {
    const projectTasks = Array.from(taskGraph.values())
      .filter(task => task.project_id === String(project.id));
    
    const projectMakespan = Math.max(
      ...projectTasks.map(task => task.earliestFinish)
    );

    // Find project critical path
    const projectCriticalPath = findProjectCriticalPath(projectTasks, taskGraph);
    
    return {
      project_id: String(project.id),
      critical_path: projectCriticalPath,
      total_duration: projectMakespan,
      earliest_completion: new Date(Date.now() + projectMakespan * 24 * 60 * 60 * 1000),
      latest_completion: new Date(Date.now() + projectMakespan * 24 * 60 * 60 * 1000),
      float_time: 0 // Will be calculated in backward pass
    };
  });

  // 4. Backward pass - Calculate latest start and finish times
  const globalMakespan = Math.max(
    ...Array.from(taskGraph.values()).map(task => task.earliestFinish)
  );

  // Initialize latest times for end tasks
  taskGraph.forEach(task => {
    if (task.successors.length === 0) {
      task.latestFinish = task.earliestFinish;
    } else {
      task.latestFinish = globalMakespan;
    }
    task.latestStart = task.latestFinish - task.duration;
  });

  // Backward pass
  const backwardVisited = new Set<string>();
  
  function backwardPass(taskId: string): void {
    if (backwardVisited.has(taskId)) return;
    backwardVisited.add(taskId);

    const task = taskGraph.get(taskId);
    if (!task) return;

    // Process all successors first
    task.successors.forEach(succId => {
      backwardPass(succId);
    });

    // Calculate latest finish based on successors
    if (task.successors.length > 0) {
      task.latestFinish = Math.min(
        ...task.successors.map(succId => {
          const succTask = taskGraph.get(succId);
          return succTask ? succTask.latestStart : globalMakespan;
        })
      );
      task.latestStart = task.latestFinish - task.duration;
    }

    // Calculate slack
    task.slack = task.latestStart - task.earliestStart;
    task.isCritical = task.slack === 0;
  }

  // Process all tasks in reverse topological order
  const reverseTasks = [...allTasks].reverse();
  reverseTasks.forEach(task => backwardPass(String(task.id)));

  // 5. Find global critical path
  const globalCriticalPath = findGlobalCriticalPath(taskGraph);

  // 6. Detect resource conflicts
  const resourceConflicts = detectResourceConflicts(taskGraph, globalResources);

  // 7. Analyze inter-project dependencies
  const interProjectDependencies = analyzeInterProjectDependencies(
    projects,
    allDependencies,
    taskGraph
  );

  // 8. Update project results with float times
  projectResults.forEach(result => {
    const projectTasks = Array.from(taskGraph.values())
      .filter(task => task.project_id === result.project_id);
    
    const minSlack = Math.min(...projectTasks.map(task => task.slack));
    result.float_time = minSlack;
    
    // Update latest completion if there's float
    if (minSlack > 0) {
      result.latest_completion = new Date(
        result.earliest_completion.getTime() + minSlack * 24 * 60 * 60 * 1000
      );
    }
  });

  return {
    global_critical_path: globalCriticalPath,
    project_results: projectResults,
    global_makespan: globalMakespan,
    resource_conflicts: resourceConflicts,
    inter_project_dependencies: interProjectDependencies
  };
}

function findProjectCriticalPath(
  projectTasks: TaskNode[],
  taskGraph: Map<string, TaskNode>
): string[] {
  const criticalTasks = projectTasks.filter(task => task.isCritical);
  
  if (criticalTasks.length === 0) return [];

  // Build critical path by following dependencies
  const path: string[] = [];
  const visited = new Set<string>();

  // Start from tasks with no critical predecessors
  const startTasks = criticalTasks.filter(task => 
    task.dependencies.every(depId => {
      const depTask = taskGraph.get(depId);
      return !depTask || !depTask.isCritical;
    })
  );

  function buildPath(taskId: string) {
    if (visited.has(taskId)) return;
    visited.add(taskId);

    const task = taskGraph.get(taskId);
    if (!task || !task.isCritical) return;

    path.push(taskId);

    // Follow critical successors
    task.successors.forEach(succId => {
      const succTask = taskGraph.get(succId);
      if (succTask && succTask.isCritical && succTask.project_id === task.project_id) {
        buildPath(succId);
      }
    });
  }

  startTasks.forEach(task => buildPath(task.id));

  return path;
}

function findGlobalCriticalPath(taskGraph: Map<string, TaskNode>): string[] {
  const criticalTasks = Array.from(taskGraph.values()).filter(task => task.isCritical);
  
  if (criticalTasks.length === 0) return [];

  // Sort by earliest start time to get the sequence
  criticalTasks.sort((a, b) => a.earliestStart - b.earliestStart);
  
  return criticalTasks.map(task => task.id);
}

function detectResourceConflicts(
  taskGraph: Map<string, TaskNode>,
  globalResources?: any[]
): Array<{
  task_ids: string[];
  conflict_type: 'time_overlap' | 'resource_constraint';
  severity: 'low' | 'medium' | 'high';
}> {
  const conflicts: Array<{
    task_ids: string[];
    conflict_type: 'time_overlap' | 'resource_constraint';
    severity: 'low' | 'medium' | 'high';
  }> = [];

  const tasks = Array.from(taskGraph.values());

  // Check for time overlaps between tasks that might need same resources
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const task1 = tasks[i];
      const task2 = tasks[j];

      // Check if tasks overlap in time
      const overlap = !(
        task1.earliestFinish <= task2.earliestStart ||
        task2.earliestFinish <= task1.earliestStart
      );

      if (overlap && task1.project_id !== task2.project_id) {
        // Determine severity based on critical path involvement
        let severity: 'low' | 'medium' | 'high' = 'low';
        if (task1.isCritical && task2.isCritical) {
          severity = 'high';
        } else if (task1.isCritical || task2.isCritical) {
          severity = 'medium';
        }

        conflicts.push({
          task_ids: [task1.id, task2.id],
          conflict_type: 'time_overlap',
          severity
        });
      }
    }
  }

  return conflicts;
}

function analyzeInterProjectDependencies(
  projects: Project[],
  allDependencies: TaskDependency[],
  taskGraph: Map<string, TaskNode>
): Array<{
  from_project: string;
  to_project: string;
  dependency_count: number;
  critical_dependencies: string[];
}> {
  const interProjectDeps: Array<{
    from_project: string;
    to_project: string;
    dependency_count: number;
    critical_dependencies: string[];
  }> = [];

  const projectPairs = new Map<string, {
    from_project: string;
    to_project: string;
    dependencies: string[];
    critical_dependencies: string[];
  }>();

  // Analyze each dependency
  allDependencies.forEach(dep => {
    const task = taskGraph.get(String(dep.task_id));
    const predecessor = taskGraph.get(String(dep.depends_on_id));

    if (task && predecessor && task.project_id !== predecessor.project_id) {
      const key = `${predecessor.project_id}->${task.project_id}`;
      
      if (!projectPairs.has(key)) {
        projectPairs.set(key, {
          from_project: predecessor.project_id,
          to_project: task.project_id,
          dependencies: [],
          critical_dependencies: []
        });
      }

      const pair = projectPairs.get(key)!;
      pair.dependencies.push(String(dep.task_id));

      if (task.isCritical && predecessor.isCritical) {
        pair.critical_dependencies.push(String(dep.task_id));
      }
    }
  });

  // Convert to result format
  projectPairs.forEach(pair => {
    interProjectDeps.push({
      from_project: pair.from_project,
      to_project: pair.to_project,
      dependency_count: pair.dependencies.length,
      critical_dependencies: pair.critical_dependencies
    });
  });

  return interProjectDeps;
}

/**
 * Simplified CPM for single project (backward compatibility)
 */
export function calculateCriticalPath(tasks: Task[], dependencies: TaskDependency[]): string[] {
  if (!tasks.length) return [];

  // Create a dummy project for single project CPM
  const dummyProject: Project = {
    id: "1",
    name: "Single Project",
    description: "",
    status: "active", 
      start_date: new Date().toISOString(),

    classification: "A",
    project_field: "",
    total_investment: "1000",
   
  };

  const result = multiProjectCPM([dummyProject], tasks, dependencies);
  return result.global_critical_path;
}
