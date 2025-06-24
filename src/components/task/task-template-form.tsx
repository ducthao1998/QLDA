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
import { TaskTemplate } from '@/app/types/table-types'

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
  project_field: z.string({ required_error: 'Vui lòng chọn lĩnh vực dự án.' }),
  phase: z.string({ required_error: 'Vui lòng chọn giai đoạn chuẩn.' }),
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
  required_skill_id: z.string().optional().nullable(),
})

interface TaskTemplateFormProps {
  template?: TaskTemplate
  onFormSubmit: () => void
}

interface Skill {
  id: number
  name: string
}

export function TaskTemplateForm({ template, onFormSubmit }: TaskTemplateFormProps) {
  const router = useRouter()
  const [skills, setSkills] = useState<Skill[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const response = await fetch('/api/skills')
        if (!response.ok) {
          throw new Error('Failed to fetch skills')
        }
        const data = await response.json()

        // SỬA LỖI: Lấy mảng 'skills' từ đối tượng data trả về
        if (data && Array.isArray(data.skills)) {
          setSkills(data.skills)
        } else {
          // Nếu không phải mảng, log lỗi và đặt state là một mảng rỗng để tránh crash
          console.error(
            'API /api/skills did not return the expected { skills: [...] } format:',
            data,
          )
          setSkills([])
        }
      } catch (error) {
        console.error('Lỗi lấy danh sách kỹ năng:', error)
        toast.error('Không thể tải danh sách kỹ năng.')
        setSkills([]) // Đảm bảo skills luôn là mảng ngay cả khi fetch lỗi
      }
    }
    fetchSkills()
  }, [])

  const form = useForm<z.infer<typeof taskTemplateSchema>>({
    resolver: zodResolver(taskTemplateSchema),
    defaultValues: {
      name: template?.name || '',
      description: template?.description || '',
      project_field: template?.project_field || undefined,
      phase: template?.phase || undefined,
      applicable_classification: template?.applicable_classification || [],
      sequence_order: template?.sequence_order || 1,
      default_duration_days: template?.default_duration_days || undefined,
      required_skill_id: template?.required_skill_id?.toString() || 'none',
    },
  })

  const onSubmit = async (values: z.infer<typeof taskTemplateSchema>) => {
    setIsSubmitting(true)
    try {
      const url = template
        ? `/api/task-templates/${template.id}`
        : '/api/task-templates'
      const method = template ? 'PUT' : 'POST'

      const dataToSend = {
        ...values,
        required_skill_id:
          values.required_skill_id === 'none'
            ? null
            : values.required_skill_id,
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
                <Input placeholder="Ví dụ: Xin giấy phép xây dựng..." {...field} />
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
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="project_field"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lĩnh vực dự án</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn lĩnh vực áp dụng" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Xây dựng">Xây dựng</SelectItem>
                    <SelectItem value="CNTT">Công nghệ thông tin</SelectItem>
                    <SelectItem value="Cải cách TTHC">
                      Cải cách TTHC
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phase"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Thuộc giai đoạn</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn giai đoạn của công việc" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PROJECT_PHASES.map((phase) => (
                      <SelectItem key={phase} value={phase}>
                        {phase}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="applicable_classification"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Áp dụng cho phân loại dự án</FormLabel>
              <FormDescription>
                Chọn các loại dự án mà công việc mẫu này sẽ được áp dụng.
              </FormDescription>
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

        <FormField
          control={form.control}
          name="required_skill_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kỹ năng yêu cầu</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value ?? undefined}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn kỹ năng (không bắt buộc)" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">Không yêu cầu</SelectItem>
                  {skills.map((skill) => (
                    <SelectItem key={skill.id} value={skill.id.toString()}>
                      {skill.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            {isSubmitting
              ? 'Đang xử lý...'
              : template
              ? 'Lưu thay đổi'
              : 'Tạo công việc mẫu'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
