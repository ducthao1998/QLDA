'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { TaskTemplate, Skill, TaskTemplateDependency } from '@/app/types/table-types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BarChart2Icon, Loader2, Link, AlertTriangle, Info } from 'lucide-react'

const PROJECT_PHASES = [
  'Khởi tạo & Lập kế hoạch',
  'Thực thi & Giám sát',
  'Nghiệm thu & Đóng dự án',
  'Bảo hành & Hỗ trợ',
]

const PROJECT_CLASSIFICATIONS = [
  { id: 'A', label: 'Nhóm A' },
  { id: 'B', label: 'Nhóm B' },
  { id: 'C', label: 'Nhóm C' },
]

const taskTemplateSchema = z.object({
  name: z.string().min(3, 'Tên công việc mẫu phải có ít nhất 3 ký tự.'),
  description: z.string().optional(),
  applicable_classification: z
    .array(z.string())
    .refine((value) => value.some((item) => item), {
      message: 'Bạn phải chọn ít nhất một phân loại áp dụng.',
    }),
  default_duration_days: z.coerce.number().int().min(0).optional().nullable(),
  skill_ids: z.array(z.number()).optional(),
  dependency_ids: z.array(z.number()).optional(),
})

interface TaskTemplateFormProps {
  template?: TaskTemplate & { 
    task_template_skills: { skill_id: number }[]
    dependencies?: { depends_on_template_id: number; template_name: string }[]
    dependents?: { template_id: number; template_name: string }[]
  };
  onFormSubmit: () => void
}

export function TaskTemplateForm({
  template,
  onFormSubmit,
}: TaskTemplateFormProps) {
  const router = useRouter()
  const [skills, setSkills] = useState<Skill[]>([])
  const [selectedSkills, setSelectedSkills] = useState<number[]>(
    template?.task_template_skills
      ? template.task_template_skills.map(s => s.skill_id)
      : []
  )
  const [availableTemplates, setAvailableTemplates] = useState<TaskTemplate[]>([])
  const [allTemplates, setAllTemplates] = useState<any[]>([]) // Store all templates with dependencies info
  const [selectedDependencies, setSelectedDependencies] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [templateSearch, setTemplateSearch] = useState("")
  const [excludedTemplates, setExcludedTemplates] = useState<{ids: number[], reasons: string[]}>({ids: [], reasons: []})

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch skills
        const skillsResponse = await fetch('/api/skills')
        if (!skillsResponse.ok) throw new Error('Failed to fetch skills')
        const skillsData = await skillsResponse.json()
        setSkills(skillsData.skills || [])

        // Fetch all templates with dependencies info
        const templatesResponse = await fetch('/api/task-templates')
        if (!templatesResponse.ok) throw new Error('Failed to fetch templates')
        const templatesData = await templatesResponse.json()
        const templates = templatesData.data || []
        setAllTemplates(templates)
        
        // Calculate excluded templates and reasons
        const excludedInfo = calculateExcludedTemplates(templates, template)
        setExcludedTemplates(excludedInfo)
        
        // Filter available templates
        const filteredTemplates = templates.filter((t: any) => !excludedInfo.ids.includes(t.id))
        setAvailableTemplates(filteredTemplates)

        // Load existing dependencies if editing
        if (template) {
          const depsResponse = await fetch(`/api/task-templates/${template.id}/dependencies`)
          if (depsResponse.ok) {
            const depsData = await depsResponse.json()
            const depIds = (depsData.dependencies || []).map((dep: any) => dep.depends_on_template_id)
            setSelectedDependencies(depIds)
          }
        }
      } catch (error) {
        toast.error('Không thể tải dữ liệu.')
      }
    }
    fetchData()
  }, [template])

  // Calculate which templates should be excluded and why
  const calculateExcludedTemplates = (templates: any[], currentTemplate?: any) => {
    const excludedIds: number[] = []
    const reasons: string[] = []
    
    if (!currentTemplate) {
      return { ids: excludedIds, reasons }
    }
    
    // 1. Exclude current template itself
    excludedIds.push(currentTemplate.id)
    reasons.push(`"${currentTemplate.name}" (chính công việc này)`)
    
    // 2. Find templates that depend on current template (to avoid circular dependencies)
    const dependentTemplates = templates.filter((t: any) => 
      t.dependencies && t.dependencies.some((dep: any) => dep.depends_on_template_id === currentTemplate.id)
    )
    
    if (dependentTemplates.length > 0) {
      dependentTemplates.forEach((t: any) => {
        excludedIds.push(t.id)
        reasons.push(`"${t.name}" (đang phụ thuộc vào công việc này)`)
      })
    }
    
    // 3. Recursively find indirect dependents to prevent complex circular dependencies
    const findIndirectDependents = (templateId: number, visited: Set<number> = new Set()): number[] => {
      if (visited.has(templateId)) return []
      visited.add(templateId)
      
      const directDependents = templates.filter((t: any) => 
        t.dependencies && t.dependencies.some((dep: any) => dep.depends_on_template_id === templateId)
      )
      
      const allDependents: number[] = []
      directDependents.forEach((dep: any) => {
        allDependents.push(dep.id)
        allDependents.push(...findIndirectDependents(dep.id, visited))
      })
      
      return allDependents
    }
    
    const indirectDependents = findIndirectDependents(currentTemplate.id)
    indirectDependents.forEach(id => {
      if (!excludedIds.includes(id)) {
        const template = templates.find((t: any) => t.id === id)
        if (template) {
          excludedIds.push(id)
          reasons.push(`"${template.name}" (phụ thuộc gián tiếp)`)
        }
      }
    })
    
    return { ids: excludedIds, reasons }
  }

  const form = useForm<z.infer<typeof taskTemplateSchema>>({
    resolver: zodResolver(taskTemplateSchema),
    defaultValues: {
      name: template?.name || '',
      description: template?.description || '',
      applicable_classification: template?.applicable_classification || [],
      default_duration_days: template?.default_duration_days || undefined,
      skill_ids: template?.task_template_skills
        ? template.task_template_skills.map(s => s.skill_id)
        : [],
      dependency_ids: [],
    },
  })

  useEffect(() => {
    form.setValue('skill_ids', selectedSkills)
  }, [selectedSkills, form])

  const onSubmit = async (values: z.infer<typeof taskTemplateSchema>) => {
    setIsSubmitting(true)
    try {
      const url = template
        ? `/api/task-templates/${template.id}`
        : '/api/task-templates'
      const method = template ? 'PUT' : 'POST'

      const dataToSend = {
        ...values,
        skill_ids: selectedSkills,
        dependency_template_ids: selectedDependencies,
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Thao tác thất bại')
      }

      toast.success(
        template
          ? 'Cập nhật công việc mẫu thành công!'
          : 'Tạo công việc mẫu thành công!',
      )
      onFormSubmit()
      router.refresh()
    } catch (error: any) {
      toast.error('Đã xảy ra lỗi: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkillChange = (skillId: number) => {
    setSelectedSkills(prev =>
      prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    )
  }

  // Filter templates based on search
  const filteredAvailableTemplates = availableTemplates.filter(t =>
    !templateSearch ||
    t.name.toLowerCase().includes(templateSearch.toLowerCase())
  )

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tên công việc mẫu</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ví dụ: Xin giấy phép xây dựng..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mô tả chi tiết</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Mô tả mục tiêu, yêu cầu đầu ra của công việc..."
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="applicable_classification"
          render={() => (
            <FormItem>
              <FormLabel>Áp dụng cho phân loại dự án</FormLabel>
              <div className="flex items-center space-x-4 pt-2">
                {PROJECT_CLASSIFICATIONS.map((item) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name="applicable_classification"
                    render={({ field }) => (
                      <FormItem
                        key={item.id}
                        className="flex flex-row items-start space-x-2 space-y-0"
                      >
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(item.id)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([
                                    ...(field.value || []),
                                    item.id,
                                  ])
                                : field.onChange(
                                    field.value?.filter(
                                      (value) => value !== item.id,
                                    ),
                                  )
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {item.label}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Card>
          <CardHeader>
            <CardTitle>Kỹ năng yêu cầu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {skills.length > 0 ? skills.map((skill) => (
                <Badge
                  key={skill.id}
                  variant={selectedSkills.includes(skill.id) ? "default" : "outline"}
                  className="cursor-pointer text-base py-1 px-3"
                  onClick={() => handleSkillChange(skill.id)}
                >
                  {skill.name}
                </Badge>
              )) : <p className="text-sm text-muted-foreground">Đang tải danh sách kỹ năng...</p>}
            </div>
            <FormDescription className="pt-3">
              Chọn các kỹ năng cần thiết để thực hiện công việc này.
            </FormDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Công việc phụ thuộc
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Alert about excluded templates */}
              {excludedTemplates.ids.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">
                        {template ? 
                          "Một số công việc mẫu không hiển thị để tránh phụ thuộc vòng tròn:" :
                          "Bạn có thể chọn các công việc mà công việc mới này sẽ phụ thuộc vào."
                        }
                      </p>
                      {template && excludedTemplates.reasons.length > 0 && (
                        <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                          {excludedTemplates.reasons.slice(0, 5).map((reason, index) => (
                            <li key={index}>{reason}</li>
                          ))}
                          {excludedTemplates.reasons.length > 5 && (
                            <li>... và {excludedTemplates.reasons.length - 5} công việc khác</li>
                          )}
                        </ul>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Current dependencies display (for editing) */}
              {template && selectedDependencies.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-2">
                    <Info className="h-4 w-4 inline mr-1" />
                    Đang phụ thuộc vào {selectedDependencies.length} công việc:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selectedDependencies.map(depId => {
                      const depTemplate = allTemplates.find(t => t.id === depId)
                      return depTemplate ? (
                        <Badge key={depId} variant="secondary" className="text-xs">
                          {depTemplate.name}
                        </Badge>
                      ) : null
                    })}
                  </div>
                </div>
              )}

              {/* Search input for filtering templates */}
              <input
                type="text"
                placeholder="Tìm kiếm công việc mẫu..."
                className="w-full px-3 py-2 border rounded focus:outline-none focus:ring"
                value={templateSearch || ''}
                onChange={e => setTemplateSearch(e.target.value)}
              />
              
              {/* Available templates list */}
              {filteredAvailableTemplates.length > 0 ? (
                <div style={{ maxHeight: 300, overflowY: 'auto' }} className="border rounded-lg">
                  {filteredAvailableTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-muted/50"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{template.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Áp dụng: {template.applicable_classification.join(', ')}
                          {template.default_duration_days && (
                            <span className="ml-2">• {template.default_duration_days} ngày</span>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={selectedDependencies.includes(template.id) ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          setSelectedDependencies(prev =>
                            prev.includes(template.id)
                              ? prev.filter(id => id !== template.id)
                              : [...prev, template.id]
                          )
                        }}
                      >
                        {selectedDependencies.includes(template.id) ? "✓ Đã chọn" : "Chọn"}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 border rounded-lg bg-muted/20">
                  <p className="text-sm text-muted-foreground">
                    {templateSearch ? 
                      "Không tìm thấy công việc mẫu nào phù hợp với từ khóa tìm kiếm" : 
                      availableTemplates.length === 0 ?
                        "Chưa có công việc mẫu nào khác để tạo phụ thuộc" :
                        "Nhập từ khóa để tìm kiếm công việc mẫu"
                    }
                  </p>
                </div>
              )}
            </div>
            <FormDescription className="pt-3">
              Chọn các công việc mà công việc này phụ thuộc vào. Công việc này chỉ có thể bắt đầu khi các công việc phụ thuộc hoàn thành.
            </FormDescription>
          </CardContent>
        </Card>

        <FormField
          control={form.control}
          name="default_duration_days"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Thời gian hoàn thành (ngày)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="Số ngày dự kiến"
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormDescription>
                Thời gian mặc định để hoàn thành công việc này.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onFormSubmit}
            disabled={isSubmitting}
          >
            Hủy
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang xử lý...
              </>
            ) : template ? 'Lưu thay đổi' : 'Tạo công việc mẫu'}
          </Button>
        </div>
      </form>
    </Form>
  )
}