"use client"

import { useEffect, useState } from "react"
import { RaciMatrix } from "./raci-matrix"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircleIcon } from "lucide-react"
import type { Project } from "@/app/types/table-types"
import { RaciFilters } from "./raci-filters"
import { RaciExport } from "./raci-export"

interface RaciFilters {
  projectId: string | null
  searchTerm: string
  roleFilter: string | null
  phaseFilter: string | null
}

export function RaciMatrixContainer() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<RaciFilters>({
    projectId: null,
    searchTerm: "",
    roleFilter: null,
    phaseFilter: null,
  })

  // Fetch all projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoadingProjects(true)
        setError(null)

        const response = await fetch("/api/projects?limit=1000")
        if (!response.ok) throw new Error("Không thể tải danh sách dự án")

        const result = await response.json()
        const projectsData = result.data || result.projects || []
        setProjects(projectsData)

        // Auto-select first project if available
        if (projectsData.length > 0 && !filters.projectId) {
          setFilters((prev) => ({ ...prev, projectId: projectsData[0].id }))
        }
      } catch (err: any) {
        setError(err.message)
        console.error("Error fetching projects:", err)
      } finally {
        setLoadingProjects(false)
      }
    }

    fetchProjects()
  }, [])

  const handleFiltersChange = (newFilters: Partial<RaciFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
  }

  if (loadingProjects) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters and Export */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <RaciFilters projects={projects} filters={filters} onFiltersChange={handleFiltersChange} />
        <RaciExport projectId={filters.projectId} />
      </div>

      {/* RACI Matrix */}
      <RaciMatrix
        projectId={filters.projectId}
        searchTerm={filters.searchTerm}
        roleFilter={filters.roleFilter}
        phaseFilter={filters.phaseFilter}
      />
    </div>
  )
}
