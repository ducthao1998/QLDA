'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
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

// Cập nhật schema:
// 1. Chuyển start_date và end_date sang kiểu z.date() để làm việc với component Lịch.
// 2. Thêm .refine() để kiểm tra end_date phải lớn hơn start_date.
const formSchema = z
  .object({
    name: z.string().min(1, 'Tên dự án là bắt buộc'),
    description: z.string().optional(),
    start_date: z.date().optional(),
    end_date: z.date().optional(),
    status: z.string().optional(),
    classification: z.string({
      required_error: 'Vui lòng chọn phân loại dự án.',
    }),
    project_field: z.string({
      required_error: 'Vui lòng chọn lĩnh vực dự án.',
    }),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return data.end_date >= data.start_date
      }
      return true
    },
    {
      message: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.',
      path: ['end_date'], // Hiển thị lỗi ở trường end_date
    },
  )

interface ProjectFormProps {
  project?: Project
}

export function ProjectForm({ project }: ProjectFormProps) {
  const router = useRouter()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    // Chuyển đổi giá trị ngày tháng (string) từ project thành đối tượng Date
    defaultValues: {
      name: project?.name || '',
      description: project?.description || '',
      start_date: project?.start_date ? new Date(project.start_date) : undefined,
      end_date: project?.end_date ? new Date(project.end_date) : undefined,
      status: project?.status || 'active',
      classification: project?.classification || undefined,
      project_field: project?.project_field || undefined,
    },
  })

  // Cập nhật hàm onSubmit để định dạng lại ngày tháng trước khi gửi đi
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Định dạng lại ngày thành chuỗi 'yyyy-MM-dd' để API có thể xử lý
    const formattedValues = {
      ...values,
      start_date: values.start_date
        ? format(values.start_date, 'yyyy-MM-dd')
        : undefined,
      end_date: values.end_date
        ? format(values.end_date, 'yyyy-MM-dd')
        : undefined,
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
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mô tả</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Nhập mô tả chi tiết cho dự án..."
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
                <FormLabel>Lĩnh vực Dự án</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn lĩnh vực" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Xây dựng">Xây dựng cơ bản</SelectItem>
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

        {/* ---- GIAO DIỆN CHỌN NGÀY ĐÃ ĐƯỢC CẬP NHẬT ---- */}
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
            name="end_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Ngày kết thúc</FormLabel>
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
                      disabled={(date) =>
                        form.getValues('start_date')
                          ? date < form.getValues('start_date')!
                          : false
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
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