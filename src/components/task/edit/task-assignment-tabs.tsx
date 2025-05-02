"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { UserIcon } from "lucide-react"

import type { User, RaciRole } from "@/app/types/table-types"

interface TaskAssignmentsTabProps {
  users: User[]
  raciUsers: { id: number; user_id: string; role: RaciRole }[]
  onRaciChange: (userId: string, role: RaciRole) => void
}

export function TaskAssignmentsTab({ users, raciUsers, onRaciChange }: TaskAssignmentsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserIcon className="h-5 w-5" />
          Phân công RACI
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          R: Người thực hiện, A: Người chịu trách nhiệm, C: Người tư vấn, I: Người được thông báo
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
                      onClick={() => onRaciChange(user.id, role)}
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
