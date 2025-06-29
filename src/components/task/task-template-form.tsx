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
import { TaskTemplate, Skill } from '@/app/types/table-types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart2Icon, Loader2 } from 'lucide-react'

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
  sequence_order: z.coerce
    .number()
    .int()
    .positive('Thứ tự phải là số nguyên dương.'),
  default_duration_days: z.coerce.number().int().min(0).optional().nullable(),
  skill_ids: z.array(z.number()).optional(),
})

interface TaskTemplateFormProps {
  template?: TaskTemplate & { task_template_skills: { skill_id: number }[] };
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
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const response = await fetch('/api/skills')
        if (!response.ok) throw new Error('Failed to fetch skills')
        const data = await response.json()
        setSkills(data.skills || [])
      } catch (error) {
        toast.error('Không thể tải danh sách kỹ năng.')
      }
    }
    fetchSkills()
  }, [])

  const form = useForm<z.infer<typeof taskTemplateSchema>>({
    resolver: zodResolver(taskTemplateSchema),
    defaultValues: {
      name: template?.name || '',
      description: template?.description || '',
      applicable_classification: template?.applicable_classification || [],
      sequence_order: template?.sequence_order || 1,
      default_duration_days: template?.default_duration_days || undefined,
      skill_ids: template?.task_template_skills
        ? template.task_template_skills.map(s => s.skill_id)
        : [],
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="sequence_order"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Thứ tự thực hiện</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Ví dụ: 1, 2, 3..."
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Thứ tự của công việc trong cùng một giai đoạn.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
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
        </div>

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
