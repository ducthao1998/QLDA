'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// Define a type for the processed data we expect from the API
interface SkillInfo {
  skill_id: number
  skill_name: string
  skill_field: string | null
  completed_tasks_count: number
  total_experience_days: number | null
}

interface UserSkillData {
  user_id: string
  full_name: string
  skills: SkillInfo[]
}

export function SkillMatrix() {
  const [matrixData, setMatrixData] = useState<UserSkillData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/team/skill-matrix')
        if (!response.ok) {
          throw new Error('Không thể tải dữ liệu ma trận kỹ năng')
        }
        const data = await response.json()
        setMatrixData(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Get a unique list of all skill fields to use as table columns
  const allSkillFields = useMemo(() => {
    const fields = new Set<string>()
    matrixData.forEach(user => {
      user.skills.forEach(skill => {
        if (skill.skill_field) {
          fields.add(skill.skill_field)
        }
      })
    })
    return Array.from(fields).sort()
  }, [matrixData])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ma trận Kỹ năng Đội ngũ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Đã xảy ra lỗi</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ma trận Kỹ năng Đội ngũ</CardTitle>
        <p className="text-sm text-muted-foreground">
          Tổng hợp kinh nghiệm dựa trên các công việc đã hoàn thành.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10 w-1/4">
                  Nhân sự
                </TableHead>
                {allSkillFields.map(field => (
                  <TableHead key={field} className="text-center">
                    {field}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrixData.map(user => (
                <TableRow key={user.user_id}>
                  <TableCell className="font-medium sticky left-0 bg-background z-10">
                    {user.full_name}
                  </TableCell>
                  {allSkillFields.map(field => {
                    const userSkillsInField = user.skills.filter(
                      s => s.skill_field === field,
                    )
                    return (
                      <TableCell key={`${user.user_id}-${field}`} className="text-center">
                        {userSkillsInField.length > 0 ? (
                          <div className="flex flex-col items-center justify-center space-y-2">
                            {userSkillsInField.map(skill => (
                              <Badge
                                variant="secondary"
                                key={skill.skill_id}
                                className="whitespace-normal"
                              >
                                {skill.skill_name}: {skill.completed_tasks_count}{' '}
                                việc
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
