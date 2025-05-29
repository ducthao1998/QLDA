"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"

interface Activity {
  id: string
  created_at: string
  action: string
  from_val: string
  to_val: string
  project: {
    id: string
    name: string
  } | null
  tasks: {
    id: string
    name: string
  }[] | null
  users: {
    id: string
    full_name: string
    avatar_url?: string
  }[] | null
}

export function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([])

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await fetch("/api/dashboard/activities")
        if (!response.ok) throw new Error("Failed to fetch activities")
        const data = await response.json()
        setActivities(data.activities || [])
      } catch (error) {
        console.error("Error fetching activities:", error)
        setActivities([])
      }
    }

    fetchActivities()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hoạt Động Gần Đây</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {activities.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Chưa có hoạt động nào gần đây</p>
          ) : (
            activities.map((activity) => {
              const user = activity.users && activity.users.length > 0 ? activity.users[0] : null
              const task = activity.tasks && activity.tasks.length > 0 ? activity.tasks[0] : null
              
              return (
                <div key={activity.id} className="flex items-start">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    {user?.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.full_name}
                        className="h-6 w-6 rounded-full"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-xs text-gray-600">
                          {user?.full_name?.charAt(0) || "?"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.full_name || "Người dùng không xác định"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {activity.action === "created" && "đã tạo"}
                      {activity.action === "updated" && "đã cập nhật"}
                      {activity.action === "deleted" && "đã xóa"}
                      {activity.action === "task_created" && "đã tạo"}
                      {activity.action === "task_updated" && "đã cập nhật"}
                      {activity.action === "task_deleted" && "đã xóa"}{" "}
                      {task?.name || "công việc"} 
                      {activity.project?.name && ` trong dự án ${activity.project.name}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.created_at), {
                        addSuffix: true,
                        locale: vi,
                      })}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
