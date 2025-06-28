"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { SearchIcon, FilterIcon, XIcon } from "lucide-react"
import type { Project } from "@/app/types/table-types"

interface RaciFiltersProps {
  projects: Project[]
  filters: {
    projectId: string | null
    searchTerm: string
    roleFilter: string | null
    phaseFilter: string | null
  }
  onFiltersChange: (filters: any) => void
}

export function RaciFilters({ projects, filters, onFiltersChange }: RaciFiltersProps) {
  const clearFilters = () => {
    onFiltersChange({
      searchTerm: "",
      roleFilter: null,
      phaseFilter: null,
    })
  }

  const hasActiveFilters = filters.searchTerm || filters.roleFilter || filters.phaseFilter

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      {/* Project Selector */}
      <div className="w-full sm:w-64">
        <Select value={filters.projectId || ""} onValueChange={(value) => onFiltersChange({ projectId: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Chọn dự án" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-64">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm kiếm công việc..."
          value={filters.searchTerm}
          onChange={(e) => onFiltersChange({ searchTerm: e.target.value })}
          className="pl-10"
        />
      </div>

      {/* Role Filter */}
      <Select
        value={filters.roleFilter || "all"}
        onValueChange={(value) => onFiltersChange({ roleFilter: value === "all" ? null : value })}
      >
        <SelectTrigger className="w-full sm:w-40">
          <FilterIcon className="h-4 w-4 mr-2" />
          <SelectValue placeholder="Vai trò" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả vai trò</SelectItem>
          <SelectItem value="R">Responsible (R)</SelectItem>
          <SelectItem value="A">Accountable (A)</SelectItem>
          <SelectItem value="C">Consulted (C)</SelectItem>
          <SelectItem value="I">Informed (I)</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="outline" size="sm" onClick={clearFilters}>
          <XIcon className="h-4 w-4 mr-2" />
          Xóa bộ lọc
        </Button>
      )}
    </div>
  )
}
