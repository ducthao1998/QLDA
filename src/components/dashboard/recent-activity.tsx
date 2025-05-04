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
  }[]
  users: {
    id: string
    full_name: string
    avatar_url: string
  }[]
}

export function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([])

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await fetch("/api/dashboard/activities")
        if (!response.ok) throw new Error("Failed to fetch activities")
        const data = await response.json()
        setActivities(data.activities)
      } catch (error) {
        console.error("Error fetching activities:", error)
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
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <img
                  src={activity.users[0]?.avatar_url}
                  alt={activity.users[0]?.full_name}
                  className="h-6 w-6 rounded-full"
                />
              </div>
              <div className="ml-4 space-y-1">
                <p className="text-sm font-medium leading-none">
                  {activity.users[0]?.full_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activity.action === "created" && "đã tạo"}
                  {activity.action === "updated" && "đã cập nhật"}
                  {activity.action === "deleted" && "đã xóa"}{" "}
                  {activity.tasks[0]?.name} trong dự án {activity.project?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(activity.created_at), {
                    addSuffix: true,
                    locale: vi,
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
