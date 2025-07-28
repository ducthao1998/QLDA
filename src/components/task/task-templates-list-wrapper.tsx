"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { TaskTemplate } from "@/app/types/table-types"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Edit, Trash2, PlusCircle, Network, ArrowRight, ArrowDown, RefreshCw } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TaskTemplateForm } from "./task-template-form"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

// Sửa lại type để khớp với cấu trúc dữ liệu thực tế
type TaskTemplateWithSkills = TaskTemplate & {
  task_template_skills: { skill_id: number; skills: { name: string } | null }[]
  dependencies?: { depends_on_template_id: number; template_name: string }[]
  dependents?: { template_id: number; template_name: string }[]
}

interface TaskTemplatesListWrapperProps {
  initialData: TaskTemplateWithSkills[]
}

// Component để hiển thị dependency tree
function DependencyTree({ 
  templates, 
  onEdit, 
  onDelete 
}: {
  templates: TaskTemplateWithSkills[]
  onEdit: (template: TaskTemplateWithSkills) => void
  onDelete: (templateId: number) => void
}) {
  const [expandedTemplates, setExpandedTemplates] = useState<Set<number>>(new Set())

  const toggleExpanded = (templateId: number) => {
    const newExpanded = new Set(expandedTemplates)
    if (newExpanded.has(templateId)) {
      newExpanded.delete(templateId)
    } else {
      newExpanded.add(templateId)
    }
    setExpandedTemplates(newExpanded)
  }

  return (
    <div className="space-y-4">
      {templates.map((template) => {
        const hasDependencies = template.dependencies && template.dependencies.length > 0
        const hasDependents = template.dependents && template.dependents.length > 0
        const isExpanded = expandedTemplates.has(template.id)

        return (
          <Card key={template.id} className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(hasDependencies || hasDependents) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpanded(template.id)}
                      className="p-1 h-6 w-6"
                    >
                      <ArrowRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </Button>
                  )}
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    {template.description && (
                      <CardDescription className="mt-1">{template.description}</CardDescription>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {template.applicable_classification.map((cls) => (
                      <Badge key={cls} variant="outline" className="text-xs">
                        Nhóm {cls}
                      </Badge>
                    ))}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(template)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Chỉnh sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => onDelete(template.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Xóa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            
            {isExpanded && (hasDependencies || hasDependents) && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Dependencies (Phụ thuộc vào) */}
                  {hasDependencies && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-orange-600 flex items-center gap-2">
                        <ArrowDown className="h-4 w-4" />
                        Phụ thuộc vào ({template.dependencies!.length})
                      </h4>
                      <div className="space-y-1 pl-6 border-l-2 border-orange-200">
                        {template.dependencies!.map((dep) => (
                          <div key={dep.depends_on_template_id} className="text-sm p-2 bg-orange-50 rounded border">
                            <div className="font-medium text-orange-800">{dep.template_name}</div>
                            <div className="text-xs text-orange-600">Phải hoàn thành trước</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dependents (Được phụ thuộc bởi) */}
                  {hasDependents && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-green-600 flex items-center gap-2">
                        <ArrowDown className="h-4 w-4 rotate-180" />
                        Các công việc phụ thuộc ({template.dependents!.length})
                      </h4>
                      <div className="space-y-1 pl-6 border-l-2 border-green-200">
                        {template.dependents!.map((dep) => (
                          <div key={dep.template_id} className="text-sm p-2 bg-green-50 rounded border">
                            <div className="font-medium text-green-800">{dep.template_name}</div>
                            <div className="text-xs text-green-600">Chờ công việc này hoàn thành</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// Component table con để tái sử dụng với enhanced dependencies column
function TemplateTable({
  templates,
  onEdit,
  onDelete,
}: {
  templates: TaskTemplateWithSkills[]
  onEdit: (template: TaskTemplateWithSkills) => void
  onDelete: (templateId: number) => void
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Tên công việc mẫu</TableHead>
            <TableHead>Kỹ năng yêu cầu</TableHead>
            <TableHead>Quan hệ phụ thuộc</TableHead>
            <TableHead>Phân loại áp dụng</TableHead>
            <TableHead className="text-center">Thời gian (ngày)</TableHead>
            <TableHead className="text-right">Hành động</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.length > 0 ? (
            templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{template.name}</div>
                    {template.description && (
                      <div className="text-sm text-muted-foreground mt-1">{template.description}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {(() => {
                    // Lọc ra các kỹ năng hợp lệ
                    const validSkills = Array.isArray(template.task_template_skills)
                      ? template.task_template_skills.filter((tks) => tks.skills?.name)
                      : []

                    return validSkills.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {validSkills.map((tks) => (
                          <Badge key={tks.skill_id} variant="secondary" className="text-xs">
                            {tks.skills!.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Không yêu cầu kỹ năng cụ thể</span>
                    )
                  })()}
                </TableCell>
                <TableCell>
                  <div className="space-y-2">
                    {/* Dependencies */}
                    {template.dependencies && template.dependencies.length > 0 && (
                      <div>
                        <div className="text-xs text-orange-600 font-medium mb-1 flex items-center gap-1">
                          <ArrowDown className="h-3 w-3" />
                          Phụ thuộc vào:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {template.dependencies.slice(0, 2).map((dep) => (
                            <Badge key={dep.depends_on_template_id} variant="outline" className="text-xs border-orange-300 text-orange-700">
                              {dep.template_name}
                            </Badge>
                          ))}
                          {template.dependencies.length > 2 && (
                            <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                              +{template.dependencies.length - 2} khác
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Dependents */}
                    {template.dependents && template.dependents.length > 0 && (
                      <div>
                        <div className="text-xs text-green-600 font-medium mb-1 flex items-center gap-1">
                          <ArrowDown className="h-3 w-3 rotate-180" />
                          Được phụ thuộc:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {template.dependents.slice(0, 2).map((dep) => (
                            <Badge key={dep.template_id} variant="outline" className="text-xs border-green-300 text-green-700">
                              {dep.template_name}
                            </Badge>
                          ))}
                          {template.dependents.length > 2 && (
                            <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                              +{template.dependents.length - 2} khác
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {(!template.dependencies || template.dependencies.length === 0) && 
                     (!template.dependents || template.dependents.length === 0) && (
                      <span className="text-xs text-muted-foreground italic">Không có quan hệ phụ thuộc</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {template.applicable_classification.map((cls) => (
                      <Badge key={cls} variant="outline" className="text-xs">
                        Nhóm {cls}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {template.default_duration_days ? (
                    <span className="font-medium">{template.default_duration_days}</span>
                  ) : (
                    <span className="text-muted-foreground italic">Chưa định</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Mở menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(template)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Chỉnh sửa
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => onDelete(template.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Xóa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="text-muted-foreground">Không có công việc mẫu nào cho loại dự án này</div>
                  <div className="text-sm text-muted-foreground">Hãy tạo công việc mẫu đầu tiên</div>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export function TaskTemplatesListWrapper({ initialData }: TaskTemplatesListWrapperProps) {
  const router = useRouter()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplateWithSkills | null>(null)
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("A");
  const [view, setView] = useState<"table" | "tree">("table");
  const [page, setPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const ITEMS_PER_PAGE = 10;

  // Refresh data from API
  const refreshData = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch('/api/task-templates')
      if (response.ok) {
        router.refresh()
        toast.success("Dữ liệu đã được cập nhật!")
      } else {
        throw new Error('Failed to refresh')
      }
    } catch (error) {
      console.error('Error refreshing data:', error)
      toast.error("Lỗi khi làm mới dữ liệu")
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleEdit = (template: TaskTemplateWithSkills) => {
    setSelectedTemplate(template)
    setIsEditDialogOpen(true)
  }

  const handleDelete = async (templateId: number) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa công việc mẫu này? Hành động này không thể hoàn tác.")) {
      return
    }

    try {
      const response = await fetch(`/api/task-templates/${templateId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Xóa thất bại")
      }

      toast.success("Xóa công việc mẫu thành công!")
      router.refresh()
    } catch (error: any) {
      toast.error("Lỗi khi xóa: " + error.message)
    }
  }

  const handleCreate = async (templateData: any) => {
    try {
      const response = await fetch('/api/task-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Tạo thất bại")
      }

      toast.success("Tạo công việc mẫu thành công!")
      router.refresh()
    } catch (error: any) {
      toast.error("Lỗi khi tạo: " + error.message)
      throw error
    }
  }

  const handleUpdate = async (templateId: number, templateData: any) => {
    try {
      const response = await fetch(`/api/task-templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Cập nhật thất bại")
      }

      toast.success("Cập nhật công việc mẫu thành công!")
      router.refresh()
    } catch (error: any) {
      toast.error("Lỗi khi cập nhật: " + error.message)
      throw error
    }
  }

  const closeAllDialogs = () => {
    setIsCreateDialogOpen(false)
    setIsEditDialogOpen(false)
    setSelectedTemplate(null)
    // Refresh trang để cập nhật dữ liệu
    router.refresh()
  }

  // Lọc dữ liệu cho từng tab với sắp xếp theo sequence_order
  const filteredTemplates = useMemo(() => {
    return initialData
      .filter((t) => t.applicable_classification.includes(tab))
      .filter((t) =>
        !search || t.name.toLowerCase().includes(search.toLowerCase())
      );
  }, [initialData, tab, search]);

  const totalPages = Math.ceil(filteredTemplates.length / ITEMS_PER_PAGE);
  const paginatedTemplates = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredTemplates.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTemplates, page]);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quản lý Công việc Mẫu (Khung dự án)</h1>
          <p className="text-muted-foreground">Tạo và quản lý các công việc chuẩn để áp dụng cho các dự án mới.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshData} 
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Làm mới
          </Button>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Thêm công việc mẫu
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Tạo công việc mẫu mới</DialogTitle>
                <DialogDescription>Điền đầy đủ các thông tin để tạo một công việc chuẩn.</DialogDescription>
              </DialogHeader>
              <TaskTemplateForm onFormSubmit={closeAllDialogs} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="A" className="space-y-4" value={tab} onValueChange={v => { setTab(v); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="A">
            Dự án nhóm A
            <Badge variant="secondary" className="ml-2">
              {initialData.filter(t => t.applicable_classification.includes("A")).length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="B">
            Dự án nhóm B
            <Badge variant="secondary" className="ml-2">
              {initialData.filter(t => t.applicable_classification.includes("B")).length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="C">
            Dự án nhóm C
            <Badge variant="secondary" className="ml-2">
              {initialData.filter(t => t.applicable_classification.includes("C")).length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Công việc mẫu cho dự án nhóm {tab}</h3>
              <div className="flex items-center gap-2">
                <div className="flex border rounded-lg p-1">
                  <Button
                    variant={view === "table" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setView("table")}
                    className="px-3"
                  >
                    Bảng
                  </Button>
                  <Button
                    variant={view === "tree" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setView("tree")}
                    className="px-3"
                  >
                    <Network className="h-4 w-4 mr-1" />
                    Quan hệ
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{filteredTemplates.length} công việc mẫu</p>
              </div>
            </div>
            
            <input
              type="text"
              placeholder="Tìm kiếm công việc mẫu..."
              className="w-full px-3 py-2 mb-2 border rounded focus:outline-none focus:ring"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            
            {view === "table" ? (
              <>
                <TemplateTable templates={paginatedTemplates} onEdit={handleEdit} onDelete={handleDelete} />
                {/* Pagination controls */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Trước
                    </Button>
                    <span className="px-2 text-sm">Trang {page} / {totalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Sau
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <DependencyTree templates={filteredTemplates} onEdit={handleEdit} onDelete={handleDelete} />
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog for Editing */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa công việc mẫu</DialogTitle>
            <DialogDescription>Cập nhật thông tin cho công việc mẫu "{selectedTemplate?.name}".</DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <TaskTemplateForm
              template={selectedTemplate}
              onFormSubmit={closeAllDialogs}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}