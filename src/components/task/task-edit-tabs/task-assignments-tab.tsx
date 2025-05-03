"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { UserIcon, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { User, RaciRole } from "@/app/types/table-types"

interface TaskAssignmentsTabProps {
  users: User[]
  raciUsers: { id: number; user_id: string; role: RaciRole }[]
  onRaciChange: (userId: string, role: RaciRole) => void
}

export function TaskAssignmentsTab({ users, raciUsers, onRaciChange }: TaskAssignmentsTabProps) {
  const [hasR, setHasR] = useState(false)
  const [hasA, setHasA] = useState(false)
  const [showValidationAlert, setShowValidationAlert] = useState(false)

  // Validate RACI roles whenever raciUsers changes
  useEffect(() => {
    const hasResponsible = raciUsers.some((u) => u.role === "R")
    const hasAccountable = raciUsers.some((u) => u.role === "A")

    setHasR(hasResponsible)
    setHasA(hasAccountable)

    // Show validation alert if either R or A is missing
    setShowValidationAlert(!hasResponsible || !hasAccountable)
  }, [raciUsers])

  const handleRaciChange = (userId: string, role: RaciRole) => {
    // Check if user already has this role
    const userHasRole = raciUsers.some((u) => u.user_id === userId && u.role === role)

    // If user is trying to remove their role
    if (userHasRole) {
      // Prevent removing the only R or A role
      if (
        (role === "R" && raciUsers.filter((u) => u.role === "R").length === 1) ||
        (role === "A" && raciUsers.filter((u) => u.role === "A").length === 1)
      ) {
        toast.warning(
          `Không thể xóa vai trò ${role === "R" ? "người thực hiện (R)" : "người chịu trách nhiệm (A)"} vì bắt buộc phải có`,
        )
        return
      }

      // Otherwise, remove the role
      onRaciChange(userId, role)
      return
    }

    // If assigning a new role
    if (role === "R" || role === "A") {
      // Find current user with this role
      const currentUserWithRole = raciUsers.find((u) => u.role === role)

      if (currentUserWithRole) {
        // If there's already a user with this role, confirm before changing
        const currentUserName = users.find((u) => u.id === currentUserWithRole.user_id)?.full_name || ""
        const newUserName = users.find((u) => u.id === userId)?.full_name || ""

        if (
          !confirm(
            `Chỉ có thể có một ${role === "R" ? "người thực hiện (R)" : "người chịu trách nhiệm (A)"}. Bạn có muốn thay đổi từ ${currentUserName} sang ${newUserName}?`,
          )
        ) {
          return
        }

        // Remove role from current user
        onRaciChange(currentUserWithRole.user_id, role)
      }
    }

    // Assign the new role
    onRaciChange(userId, role)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="h-5 w-5" />
          Phân công RACI
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showValidationAlert && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {!hasR && !hasA
                ? "Phải có một người thực hiện (R) và một người chịu trách nhiệm (A)"
                : !hasR
                  ? "Phải có một người thực hiện (R)"
                  : "Phải có một người chịu trách nhiệm (A)"}
            </AlertDescription>
          </Alert>
        )}

        <p className="text-sm text-muted-foreground">
          R: Người thực hiện (chỉ được chọn 1), A: Người chịu trách nhiệm (chỉ được chọn 1), C: Người tư vấn, I: Người
          được thông báo
        </p>

        <div className="space-y-4">
          {users.map((user) => {
            const userRaci = raciUsers.find((u) => u.user_id === user.id)

            return (
              <div key={user.id} className="flex items-center justify-between p-2 border rounded-md">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback>{user.full_name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{user.full_name}</p>
                    <p className="text-xs text-muted-foreground">{user.position}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {(["R", "A", "C", "I"] as RaciRole[]).map((role) => (
                    <Badge
                      key={role}
                      variant={userRaci?.role === role ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => handleRaciChange(user.id, role)}
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-sm text-muted-foreground mt-4">
          <span className="text-red-500">*</span> Bắt buộc phải có đúng 1 người R và 1 người A
        </p>
      </CardContent>
    </Card>
  )
}
