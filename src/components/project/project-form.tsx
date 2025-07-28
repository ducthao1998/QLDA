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
import { Project } from '@/app/types/table-types'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const formSchema = z.object({
  name: z.string().min(1, 'Tên dự án là bắt buộc'),
  project_goal: z.string().optional(),
  start_date: z.date().optional(),
  status: z.string().optional(),
  classification: z.string({
    required_error: 'Vui lòng chọn phân loại dự án.',
  }),
  implementation_location: z.string().optional(),
  total_investment: z.string().optional(),
})

interface ProjectFormProps {
  project?: Project
}

export function ProjectForm({ project }: ProjectFormProps) {
  const router = useRouter()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: project?.name || '',
      project_goal: project?.description || '',
      start_date: project?.start_date
        ? new Date(project.start_date)
        : undefined,
      status: project?.status || 'active',
      classification: project?.classification || undefined,
      implementation_location: project?.project_field || '',
      total_investment: '',
    },
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const formattedValues = {
      name: values.name,
      description: values.project_goal || '',
      start_date: values.start_date
        ? format(values.start_date, 'yyyy-MM-dd')
        : undefined,
      status: values.status || 'active',
      classification: values.classification,
      project_field: values.implementation_location || '',
      total_investment: values.total_investment || '',
    }

    try {
      const url = project ? `/api/projects/${project.id}` : '/api/projects'
      const method = project ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedValues),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Đã có lỗi xảy ra')
      }

      toast.success(
        project ? 'Cập nhật dự án thành công!' : 'Tạo dự án thành công!',
      )
      router.push('/dashboard/projects')
      router.refresh()
    } catch (error: any) {
      toast.error('Đã xảy ra lỗi: ' + error.message)
    }
  }

  const { isSubmitting } = form.formState

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tên dự án</FormLabel>
              <FormControl>
                <Input placeholder="Nhập tên dự án..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="project_goal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mục tiêu dự án</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Nhập mục tiêu chi tiết cho dự án..."
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
            name="implementation_location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Địa điểm thực hiện</FormLabel>
                <FormControl>
                  <Input placeholder="Ví dụ: Hà Nội, TP.HCM..." {...field} />
                </FormControl>
                <FormDescription>
                  Nhập địa điểm thực hiện dự án.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="total_investment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tổng mức đầu tư</FormLabel>
                <FormControl>
                  <Input placeholder="Ví dụ: 10 tỷ VND..." {...field} />
                </FormControl>
                <FormDescription>
                  Nhập tổng mức đầu tư của dự án.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Ngày bắt đầu</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full pl-3 text-left font-normal',
                          !field.value && 'text-muted-foreground',
                        )}
                      >
                        {field.value ? (
                          format(field.value, 'dd/MM/yyyy')
                        ) : (
                          <span>Chọn ngày</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="classification"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phân loại Dự án</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn phân loại" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="A">Nhóm A</SelectItem>
                    <SelectItem value="B">Nhóm B</SelectItem>
                    <SelectItem value="C">Nhóm C</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Hủy
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? project
                ? 'Đang lưu...'
                : 'Đang tạo...'
              : project
              ? 'Lưu thay đổi'
              : 'Tạo dự án'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
