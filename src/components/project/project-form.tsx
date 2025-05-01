"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { useMemo, useState, Suspense, useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { Project } from "@/app/types/table-types"
import { LoadingSpinner } from "@/components/ui/loading"

const formSchema = z.object({
  name: z.string().min(3, { message: "Tên dự án phải có ít nhất 3 ký tự" }),
  description: z.string().min(10, { message: "Mô tả dự án phải có ít nhất 10 ký tự" }),
  start_date: z.date({ required_error: "Vui lòng chọn ngày bắt đầu" }),
  end_date: z.date({ required_error: "Vui lòng chọn ngày kết thúc" }),
  status: z.string().min(1, { message: "Vui lòng chọn trạng thái" }),
})
type FormValues = z.infer<typeof formSchema>

interface ProjectFormProps {
  projectId?: string
  initialData?: {
    name: string
    description?: string
    start_date: string
    end_date: string
    status: "planning" | "in_progress" | "completed" | "on_hold" | "cancelled"
  }
}

export function ProjectForm({ projectId, initialData }: ProjectFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <ProjectFormContent projectId={projectId} initialData={initialData} />
    </Suspense>
  )
}

function ProjectFormContent({
  projectId,
  initialData,
}: { projectId?: string; initialData?: ProjectFormProps["initialData"] }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [projectState, setProject] = useState<Partial<Project>>({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    status: "planning",
  })

  const defaultValues = useMemo<Partial<FormValues>>(() => {
    if (!projectId) {
      return {
        name: "",
        description: "",
        start_date: undefined,
        end_date: undefined,
        status: "planning",
      }
    }
    return {
      name: projectState.name,
      description: projectState.description ?? "",
      start_date: projectState.start_date ? new Date(projectState.start_date) : undefined,
      end_date: projectState.end_date ? new Date(projectState.end_date) : undefined,
      status: projectState.status,
    }
  }, [projectId, projectState])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  // Initialize project state with initialData if available
  useEffect(() => {
    if (initialData) {
      setProject({
        name: initialData.name,
        description: initialData.description || "",
        start_date: initialData.start_date,
        end_date: initialData.end_date,
        status: initialData.status,
      })

      // Reset form with initialData
      form.reset({
        name: initialData.name,
        description: initialData.description || "",
        start_date: initialData.start_date ? new Date(initialData.start_date) : undefined,
        end_date: initialData.end_date ? new Date(initialData.end_date) : undefined,
        status: initialData.status,
      })
    }
  }, [initialData, form])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsSubmitting(true)

      // Format dates for API
      const formattedValues = {
        ...values,
        start_date: format(values.start_date, "yyyy-MM-dd"),
        end_date: format(values.end_date, "yyyy-MM-dd"),
      }

      const endpoint = projectId ? `/api/projects/${projectId}` : "/api/projects"
      const method = projectId ? "PUT" : "POST"

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formattedValues),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Có lỗi xảy ra")
      }

      const { project } = await response.json()

      toast(projectId ? "Cập nhật dự án thành công" : "Tạo dự án thành công", {
        description: projectId ? "Dự án đã được cập nhật" : "Dự án mới đã được tạo thành công",
      })

      router.push("/dashboard/projects")
      router.refresh()
    } catch (error) {
      console.error("Lỗi:", error)
      toast.error("Lỗi", {
        description: error instanceof Error ? error.message : "Có lỗi xảy ra",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                Tên dự án <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="Nhập tên dự án" {...field} />
              </FormControl>
              <FormDescription>Tên dự án nên ngắn gọn và mô tả được mục tiêu</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                Mô tả dự án <span className="text-red-500">*</span>
              </FormLabel>
              <FormControl>
                <Textarea placeholder="Mô tả chi tiết phạm vi dự án" className="min-h-[120px]" {...field} />
              </FormControl>
              <FormDescription>Mô tả chi tiết phạm vi, mục tiêu và các yêu cầu chính của dự án</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="flex items-center gap-1">
                  Ngày bắt đầu <span className="text-red-500">*</span>
                </FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                      >
                        {field.value ? format(field.value, "dd/MM/yyyy") : <span>Chọn ngày</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormDescription>Ngày dự kiến khởi động dự án</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="flex items-center gap-1">
                  Ngày kết thúc <span className="text-red-500">*</span>
                </FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                      >
                        {field.value ? format(field.value, "dd/MM/yyyy") : <span>Chọn ngày</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => {
                        const startDate = form.getValues("start_date")
                        return startDate && date < startDate
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormDescription>Ngày dự kiến kết thúc dự án</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  Trạng thái <span className="text-red-500">*</span>
                </FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn trạng thái" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="planning">Lập kế hoạch</SelectItem>
                    <SelectItem value="in_progress">Đang thực hiện</SelectItem>
                    <SelectItem value="completed">Hoàn thành</SelectItem>
                    <SelectItem value="on_hold">Tạm dừng</SelectItem>
                    <SelectItem value="archived">Lưu trữ</SelectItem>
                    <SelectItem value="cancelled">Đã hủy</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Trạng thái hiện tại của dự án</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Hủy
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Đang lưu..." : projectId ? "Cập nhật" : "Tạo dự án"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
