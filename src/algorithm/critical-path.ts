import { Task, TaskDependency } from "@/app/types/table-types"

interface TaskNode {
  id: string;
  duration: number;
  earliestStart: number;
  earliestFinish: number;
  latestStart: number;
  latestFinish: number;
  slack: number;
  dependencies: string[];
}

export function calculateCriticalPath(tasks: Task[], dependencies: TaskDependency[]): string[] {
  // 1. Build task graph
  const taskGraph = new Map<string, TaskNode>();
  
  // Initialize nodes
  tasks.forEach(task => {
    const startDate = new Date(task.start_date).getTime();
    const endDate = new Date(task.end_date).getTime();
    const duration = (endDate - startDate) / (1000 * 60 * 60); // Convert to hours

    taskGraph.set(String(task.id), {
      id: String(task.id),
      duration,
      earliestStart: 0,
      earliestFinish: 0,
      latestStart: 0,
      latestFinish: 0,
      slack: 0,
      dependencies: []
    });
  });

  // Add dependencies
  dependencies.forEach(dep => {
    const task = taskGraph.get(String(dep.task_id));
    if (task) {
      task.dependencies.push(String(dep.depends_on_id));
    }
  });

  // 2. Forward pass - Calculate earliest start and finish times
  const visited = new Set<string>();
  
  function forwardPass(taskId: string) {
    if (visited.has(taskId)) return;
    visited.add(taskId);

    const task = taskGraph.get(taskId);
    if (!task) return;

    // Calculate earliest start based on dependencies
    if (task.dependencies.length > 0) {
      task.earliestStart = Math.max(
        ...task.dependencies.map(depId => {
          const depTask = taskGraph.get(depId);
          return depTask ? depTask.earliestFinish : 0;
        })
      );
    }

    task.earliestFinish = task.earliestStart + task.duration;
  }

  // Process all tasks
  tasks.forEach(task => forwardPass(String(task.id)));

  // 3. Backward pass - Calculate latest start and finish times
  const reverseDependencies = new Map<string, string[]>();
  dependencies.forEach(dep => {
    if (!reverseDependencies.has(String(dep.depends_on_id))) {
      reverseDependencies.set(String(dep.depends_on_id), []);
    }
    reverseDependencies.get(String(dep.depends_on_id))?.push(String(dep.task_id));
  });

  // Find project end time
  const projectEndTime = Math.max(
    ...Array.from(taskGraph.values()).map(task => task.earliestFinish)
  );

  // Initialize latest times
  taskGraph.forEach(task => {
    task.latestFinish = projectEndTime;
    task.latestStart = task.latestFinish - task.duration;
  });

  // Backward pass
  function backwardPass(taskId: string) {
    const task = taskGraph.get(taskId);
    if (!task) return;

    const dependents = reverseDependencies.get(taskId) || [];
    if (dependents.length > 0) {
      task.latestFinish = Math.min(
        ...dependents.map(depId => {
          const depTask = taskGraph.get(depId);
          return depTask ? depTask.latestStart : projectEndTime;
        })
      );
      task.latestStart = task.latestFinish - task.duration;
    }

    // Calculate slack
    task.slack = task.latestStart - task.earliestStart;
  }

  // Process all tasks in reverse order
  tasks.slice().reverse().forEach(task => backwardPass(String(task.id)));

  // 4. Identify critical path
  const criticalPath: string[] = [];
  let currentTask = Array.from(taskGraph.values()).find(task => task.slack === 0);
  
  while (currentTask) {
    criticalPath.push(currentTask.id);
    
    // Find next task in critical path
    const nextTask = currentTask.dependencies
      .map(depId => taskGraph.get(depId))
      .find(task => task && task.slack === 0);
      
    if (!nextTask) break;
    currentTask = nextTask;
  }

  return criticalPath;
}
