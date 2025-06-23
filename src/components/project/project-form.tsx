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
import { createClient } from '@/lib/supabase/client'

// Cập nhật schema để bao gồm cả 'classification' và 'project_field'
const formSchema = z.object({
  name: z.string().min(1, 'Tên dự án là bắt buộc'),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: z.string().optional(),
  classification: z.string({
    required_error: 'Vui lòng chọn phân loại dự án.',
  }),
  project_field: z.string({
    required_error: 'Vui lòng chọn lĩnh vực dự án.',
  }),
})

interface ProjectFormProps {
  project?: Project
}

export function ProjectForm({ project }: ProjectFormProps) {
  const router = useRouter()
  const supabase = createClient()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: project?.name || '',
      description: project?.description || '',
      start_date: project?.start_date || '',
      end_date: project?.end_date || '',
      status: project?.status || 'active',
      classification: project?.classification || undefined,
      project_field: project?.project_field || undefined,
    },
  })

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      let error = null
      if (project) {
        // Chế độ chỉnh sửa
        const { error: updateError } = await supabase
          .from('projects')
          .update(values)
          .eq('id', project.id)
        error = updateError
      } else {
        // Chế độ tạo mới
        const { error: insertError } = await supabase
          .from('projects')
          .insert(values)
        error = insertError
      }

      if (error) {
        throw error
      }

      toast.success(
        project ? 'Cập nhật dự án thành công!' : 'Tạo dự án thành công!',
      )
      router.push('/dashboard/projects')
      router.refresh() // Làm mới trang để cập nhật danh sách
    } catch (error: any) {
      toast.error('Đã xảy ra lỗi: ' + error.message)
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
          {/* ---- TRƯỜNG MỚI: Lĩnh vực Dự án ---- */}
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

          {/* ---- TRƯỜNG MỚI: Phân loại Dự án ---- */}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ngày bắt đầu</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ngày kết thúc</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
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
          >
            Hủy
          </Button>
          <Button type="submit">{project ? 'Lưu thay đổi' : 'Tạo dự án'}</Button>
        </div>
      </form>
    </Form>
  )
}
