"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useState } from "react"
import { format } from "date-fns"
import { vi } from "date-fns/locale"

interface Deadline {
  id: string
  name: string
  end_date: string
  project: {
    id: string
    name: string
  }
}

export function UpcomingDeadlines() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])

  useEffect(() => {
    const fetchDeadlines = async () => {
      try {
        const response = await fetch("/api/dashboard/deadlines")
        if (!response.ok) throw new Error("Failed to fetch deadlines")
        const data = await response.json()
        setDeadlines(data.deadlines)
      } catch (error) {
        console.error("Error fetching deadlines:", error)
      }
    }

    fetchDeadlines()
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hạn Chót Sắp Tới</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {deadlines.map((deadline) => (
            <div key={deadline.id} className="flex items-center">
              <div className="ml-4 space-y-1">
                <p className="text-sm font-medium leading-none">{deadline.name}</p>
                <p className="text-sm text-muted-foreground">
                  {deadline.project.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(deadline.end_date), "EEEE, d MMMM yyyy", {
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
