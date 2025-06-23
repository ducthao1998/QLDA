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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Project, RaciRole } from '@/app/types/table-types'

// Define types for the data structure we expect from the RACI API
interface RaciTask {
  id: string
  name: string
}

interface RaciUser {
  id: string
  full_name: string
}

interface RaciAssignment {
  task_id: string
  user_id: string
  role: RaciRole
}

interface RaciData {
  tasks: RaciTask[]
  users: RaciUser[]
  assignments: RaciAssignment[]
}

export function RaciMatrix() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [raciData, setRaciData] = useState<RaciData | null>(null)
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingRaci, setLoadingRaci] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch all projects for the selector
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoadingProjects(true)
        // Assuming the projects API can return a simple list without pagination
        const response = await fetch('/api/projects?limit=1000') 
        if (!response.ok) throw new Error('Không thể tải danh sách dự án')
        const result = await response.json()
        setProjects(result.data || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoadingProjects(false)
      }
    }
    fetchProjects()
  }, [])

  // Fetch RACI data when a project is selected
  useEffect(() => {
    if (!selectedProjectId) {
      setRaciData(null)
      return
    }

    const fetchRaciData = async () => {
      try {
        setLoadingRaci(true)
        setError(null)
        const response = await fetch(`/api/projects/${selectedProjectId}/raci`)
        if (!response.ok) throw new Error('Không thể tải dữ liệu RACI cho dự án này')
        const data = await response.json()
        setRaciData(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoadingRaci(false)
      }
    }
    fetchRaciData()
  }, [selectedProjectId])

  const findRole = (taskId: string, userId: string): RaciRole | undefined => {
    return raciData?.assignments.find(
      a => a.task_id === taskId && a.user_id === userId,
    )?.role
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Ma trận Phân quyền (RACI)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Hiển thị vai trò và trách nhiệm trong các công việc của dự án.
          </p>
        </div>
        <div className="w-1/3">
          {loadingProjects ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn một dự án" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {loadingRaci ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !selectedProjectId ? (
            <div className="text-center py-10 text-muted-foreground">
              <p>Vui lòng chọn một dự án để xem ma trận RACI.</p>
            </div>
          ) : error ? (
            <div className="text-center py-10 text-destructive">
              <p>{error}</p>
            </div>
          ) : raciData && raciData.tasks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[250px]">
                    Công việc
                  </TableHead>
                  {raciData.users.map(user => (
                    <TableHead key={user.id} className="text-center">
                      {user.full_name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {raciData.tasks.map(task => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium sticky left-0 bg-background z-10">
                      {task.name}
                    </TableCell>
                    {raciData.users.map(user => (
                      <TableCell key={user.id} className="text-center font-bold">
                        {findRole(task.id, user.id) || '-'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
             <div className="text-center py-10 text-muted-foreground">
              <p>Không có dữ liệu RACI cho dự án này.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
