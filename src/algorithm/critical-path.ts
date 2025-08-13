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

export interface CriticalPathResult {
  criticalPath: string[];
  totalDuration: number;
  criticalPathDuration: number;
  explanation: string;
  taskDetails: Array<{
    taskId: string;
    taskName: string;
    duration: number;
    slack: number;
    isCritical: boolean;
    reason: string;
  }>;
}

export function calculateCriticalPath(tasks: Task[], dependencies: TaskDependency[]): CriticalPathResult {
  // 1. Build task graph
  const taskGraph = new Map<string, TaskNode>();
  
  // Initialize nodes
  tasks.forEach(task => {
    // Use duration_days instead of start_date/end_date
    const duration = (task.duration_days || 1) * 24; // Convert days to hours

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

  // 4. Identify critical path and calculate details
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

  // Calculate durations
  const totalDuration = Math.max(...Array.from(taskGraph.values()).map(task => task.earliestFinish)) / 24; // Convert back to days
  const criticalPathDuration = criticalPath.reduce((sum, taskId) => {
    const task = taskGraph.get(taskId);
    return sum + (task ? task.duration / 24 : 0); // Convert back to days
  }, 0);

  // Generate task details with explanations
  const taskDetails = tasks.map(task => {
    const taskNode = taskGraph.get(String(task.id));
    const isCritical = criticalPath.includes(String(task.id));
    
    let reason = "";
    if (isCritical) {
      if (taskNode?.slack === 0) {
        reason = "Không có thời gian dự trữ (slack = 0) - bất kỳ sự chậm trễ nào sẽ làm chậm toàn bộ dự án";
      } else {
        reason = "Thuộc đường găng - thời gian thực hiện quyết định thời gian hoàn thành dự án";
      }
    } else {
      if (taskNode?.slack && taskNode.slack > 0) {
        reason = `Có ${Math.round(taskNode.slack / 24)} ngày dự trữ - có thể trì hoãn mà không ảnh hưởng dự án`;
      } else {
        reason = "Có thể thực hiện song song với các công việc khác";
      }
    }

    return {
      taskId: String(task.id),
      taskName: task.name,
      duration: taskNode ? taskNode.duration / 24 : 0, // Convert to days
      slack: taskNode ? taskNode.slack / 24 : 0, // Convert to days
      isCritical,
      reason
    };
  });

  // Generate explanation
  const explanation = `Đường găng bao gồm ${criticalPath.length} công việc với tổng thời gian ${criticalPathDuration.toFixed(1)} ngày. ` +
    `Đây là chuỗi công việc dài nhất quyết định thời gian hoàn thành dự án (${totalDuration.toFixed(1)} ngày). ` +
    `Các công việc này không có thời gian dự trữ và bất kỳ sự chậm trễ nào sẽ làm chậm toàn bộ dự án.`;

  return {
    criticalPath,
    totalDuration,
    criticalPathDuration,
    explanation,
    taskDetails
  };
}
