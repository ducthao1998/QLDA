export type UserPosition = "quản lý" | "chỉ huy" | "cán bộ"

export interface UserPermissions {
  canViewGantt: boolean
  canViewTasks: boolean
  canViewTeam: boolean
  canEditProject: boolean
  canDeleteProject: boolean
  canManagePhases: boolean
  canAssignTasks: boolean
  viewMode: "admin" | "board" // admin cho quản lý, board cho cán bộ/chỉ huy
}

export function getUserPermissions(position: string): UserPermissions {
  const normalizedPosition = position?.toLowerCase()?.trim() || ""

  console.log("getUserPermissions - Input position:", position)
  console.log("getUserPermissions - Normalized position:", normalizedPosition)

  switch (normalizedPosition) {
    case "quản lý":
      return {
        canViewGantt: true,
        canViewTasks: true,
        canViewTeam: true,
        canEditProject: true,
        canDeleteProject: true,
        canManagePhases: true,
        canAssignTasks: true,
        viewMode: "admin",
      }

    case "chỉ huy":
    case "cán bộ":
      return {
        canViewGantt: false,
        canViewTasks: false,
        canViewTeam: false,
        canEditProject: false,
        canDeleteProject: false,
        canManagePhases: false,
        canAssignTasks: true,
        viewMode: "board",
      }

    default:
      console.warn("getUserPermissions - Unknown position, using default permissions:", position)
      // Default permissions for unknown positions
      return {
        canViewGantt: false,
        canViewTasks: false,
        canViewTeam: false,
        canEditProject: false,
        canDeleteProject: false,
        canManagePhases: false,
        canAssignTasks: true,
        viewMode: "board", // Default to board view instead of blocking
      }
  }
}

export function checkPermission(userPosition: string, requiredPermission: keyof UserPermissions): boolean {
  const permissions = getUserPermissions(userPosition)
  return permissions[requiredPermission] as boolean
}
