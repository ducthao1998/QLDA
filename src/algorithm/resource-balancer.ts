import { OptimizationInput } from './types'

interface Task {
    id: number | string
    earlyStart: number
    earlyFinish: number
    lateStart: number
    lateFinish: number
    slack: number
    isCritical: boolean
    assigned_to?: string
    optimized_start: string
    optimized_end: string
    [key: string]: any
  }
  
  interface User {
    id: string
    capacity_hrs: number
    [key: string]: any
  }
  
  interface ResourceBalanceResult {
    tasks: Task[]
    criticalPath: (number | string)[]
    makespan: number
    resourceUtilization: number
    workloadBalance: number
  }
  
  interface ResourceUtilization {
    userId: string;
    totalHours: number;
    availableHours: number;
    utilization: number;
    tasks: {
      taskId: string;
      hours: number;
      startDate: Date;
      endDate: Date;
    }[];
  }
  
  export function calculateResourceUtilization(input: OptimizationInput): number {
    const { users, scheduleDetails } = input;
    
    if (!users.length || !scheduleDetails.length) {
      return 0.5; // Default value if no data
    }
    
    // 1. Calculate resource utilization for each user
    const userUtilizations = new Map<string, ResourceUtilization>();
    
    // Initialize user data
    users.forEach(user => {
      userUtilizations.set(user.id, {
        userId: user.id,
        totalHours: 0,
        availableHours: 0,
        utilization: 0,
        tasks: []
      });
    });

    // 2. Process schedule details
    scheduleDetails.forEach(detail => {
      const userUtil = userUtilizations.get(detail.assigned_user);
      if (!userUtil) return;

      const startDate = new Date(detail.start_ts);
      const endDate = new Date(detail.finish_ts);
      const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) * 8; // Convert to hours (8 hours per day)

      userUtil.tasks.push({
        taskId: detail.task_id,
        hours,
        startDate,
        endDate
      });

      userUtil.totalHours += hours;
    });

    // 3. Calculate available hours for each user
    const projectStart = new Date(Math.min(...scheduleDetails.map(d => new Date(d.start_ts).getTime())));
    const projectEnd = new Date(Math.max(...scheduleDetails.map(d => new Date(d.finish_ts).getTime())));
    const projectDuration = (projectEnd.getTime() - projectStart.getTime()) / (1000 * 60 * 60 * 24); // Convert to days

    userUtilizations.forEach(userUtil => {
      // Assume 8 working hours per day, 5 days per week
      const workingHoursPerDay = 8;
      const workingDaysPerWeek = 5;
      
      // Calculate total working days in project
      const totalWorkingDays = Math.floor(projectDuration * (workingDaysPerWeek / 7));
      
      userUtil.availableHours = totalWorkingDays * workingHoursPerDay;
      userUtil.utilization = userUtil.availableHours > 0 ? userUtil.totalHours / userUtil.availableHours : 0;
    });

    // 4. Calculate overall resource utilization (only for assigned users)
    const assignedUsers = Array.from(userUtilizations.values()).filter(userUtil => userUtil.totalHours > 0);
    
    if (assignedUsers.length === 0) {
      return 0.3; // Default utilization when no users assigned (30%)
    }
    
    const totalUtilization = assignedUsers.reduce((sum, userUtil) => sum + userUtil.utilization, 0);
    const averageUtilization = totalUtilization / assignedUsers.length;
    
    // Ensure the result is a valid number between 0 and 1
    return Math.max(0, Math.min(1, averageUtilization || 0.3));
  }
  
  export function balanceResources(input: OptimizationInput): OptimizationInput {
    const { users, tasks, scheduleDetails } = input;
    
    // 1. Calculate current utilization
    const currentUtilization = calculateResourceUtilization(input);
    
    // 2. Identify overloaded and underloaded users
    const userUtilizations = new Map<string, ResourceUtilization>();
    const overloadedUsers: string[] = [];
    const underloadedUsers: string[] = [];
    
    // Calculate utilization for each user
    users.forEach(user => {
      const userTasks = scheduleDetails.filter(detail => detail.assigned_user === user.id);
      const totalHours = userTasks.reduce((sum, task) => {
        const start = new Date(task.start_ts);
        const end = new Date(task.finish_ts);
        return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }, 0);
      
      const utilization = totalHours / (8 * 5 * 4); // 8 hours/day * 5 days/week * 4 weeks
      userUtilizations.set(user.id, { utilization, totalHours, availableHours: 0, userId: user.id, tasks: [] });
      
      if (utilization > 1.2) overloadedUsers.push(user.id);
      if (utilization < 0.6) underloadedUsers.push(user.id);
    });
    
    // 3. Redistribute tasks
    const optimizedSchedule = [...scheduleDetails];
    
    overloadedUsers.forEach(userId => {
      const userTasks = optimizedSchedule.filter(detail => detail.assigned_user === userId);
      
      // Sort tasks by duration
      userTasks.sort((a, b) => {
        const durationA = new Date(a.finish_ts).getTime() - new Date(a.start_ts).getTime();
        const durationB = new Date(b.finish_ts).getTime() - new Date(b.start_ts).getTime();
        return durationB - durationA;
      });
      
      // Try to redistribute longest tasks
      for (const task of userTasks) {
        if (userUtilizations.get(userId)!.utilization <= 1) break;
        
        // Find suitable underloaded user
        const suitableUser = underloadedUsers.find(underloadedId => {
          const underloadedUtil = userUtilizations.get(underloadedId)!;
          return underloadedUtil.utilization < 0.8;
        });
        
        if (suitableUser) {
          // Reassign task
          const taskIndex = optimizedSchedule.findIndex(detail => 
            detail.task_id === task.task_id && detail.assigned_user === userId
          );
          
          if (taskIndex !== -1) {
            optimizedSchedule[taskIndex] = {
              ...optimizedSchedule[taskIndex],
              assigned_user: suitableUser
            };
            
            // Update utilizations
            const taskHours = (new Date(task.finish_ts).getTime() - new Date(task.start_ts).getTime()) / (1000 * 60 * 60);
            userUtilizations.get(userId)!.totalHours -= taskHours;
            userUtilizations.get(suitableUser)!.totalHours += taskHours;
            
            // Recalculate utilizations
            userUtilizations.get(userId)!.utilization = userUtilizations.get(userId)!.totalHours / (8 * 5 * 4);
            userUtilizations.get(suitableUser)!.utilization = userUtilizations.get(suitableUser)!.totalHours / (8 * 5 * 4);
          }
        }
      }
    });
  
    return {
      ...input,
      scheduleDetails: optimizedSchedule
    };
  }
  