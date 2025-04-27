"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"

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
import { Project } from "@/app/types/table-types"
import { Label as UILabel } from "@/components/ui/label"

const formSchema = z.object({
    name: z.string().min(3, { message: "Tên dự án phải có ít nhất 3 ký tự" }),
    description: z.string().min(10, { message: "Mô tả dự án phải có ít nhất 10 ký tự" }),
    start_date: z.date({ required_error: "Vui lòng chọn ngày bắt đầu" }),
    deadline: z.date({ required_error: "Vui lòng chọn hạn hoàn thành" }),
    priority: z.string().min(1, { message: "Vui lòng chọn mức độ ưu tiên" }),
    status: z.string().min(1, { message: "Vui lòng chọn trạng thái" }),
    complexity: z.string().min(1, { message: "Vui lòng chọn độ phức tạp" }),
    business_value: z.string().min(1, { message: "Vui lòng chọn giá trị kinh doanh" }),
    technical_risk: z.string().min(1, { message: "Vui lòng chọn rủi ro kỹ thuật" }),
    dependencies: z.string().optional(),
    historical_data: z.string().optional(),
  })
  type FormValues = z.infer<typeof formSchema>

export function ProjectForm({ project }: { project?: Project }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [projectState, setProject] = useState<Partial<Project>>({
    name: "",
    description: "",
    start_date: "",
    deadline: "",
    priority: 1,
    status: "planning",
    complexity: 1,
    business_value: 1,
    technical_risk: 1,
    dependencies: "",
    historical_data: ""
  })

  const defaultValues = useMemo<Partial<FormValues>>(() => {
    if (!project) {
      return {
        name: "",
        description: "",
        start_date: undefined,
        deadline: undefined,
        priority: "3",
        status: "planning",
        complexity: "3",
        business_value: "3",
        technical_risk: "3",
        dependencies: "",
        historical_data: "",
      }
    }
    return {
      name: project.name,
      description: project.description ?? "",
      start_date: new Date(project.start_date),
      deadline: new Date(project.deadline),
      priority: project.priority.toString(),
      status: project.status,
      complexity: project.complexity?.toString() ?? "3",
      business_value: project.business_value?.toString() ?? "3",
      technical_risk: project.technical_risk?.toString() ?? "3",
      dependencies: project.dependencies ?? "",
      historical_data: project.historical_data ?? "",
    }
  }, [project])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsSubmitting(true)

      // Format dates for API
      const formattedValues = {
        ...values,
        start_date: format(values.start_date, "yyyy-MM-dd"),
        deadline: format(values.deadline, "yyyy-MM-dd"),
        priority: Number.parseInt(values.priority),
        complexity: Number.parseInt(values.complexity),
        business_value: Number.parseInt(values.business_value),
        technical_risk: Number.parseInt(values.technical_risk),
      }

      const endpoint = project ? `/api/projects/${project.id}` : "/api/projects"
      const method = project ? "PUT" : "POST"

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

      toast( project ? "Cập nhật dự án thành công" : "Tạo dự án thành công",{
        description: project ? "Dự án đã được cập nhật" : "Dự án mới đã được tạo thành công",
      })

      router.push("/dashboard/projects")
      router.refresh()
    } catch (error) {
      console.error("Lỗi:", error)
      toast.error("Lỗi",{
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
            name="deadline"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel className="flex items-center gap-1">
                  Hạn hoàn thành <span className="text-red-500">*</span>
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
                <FormDescription>Hạn hoàn thành cam kết</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  Mức ưu tiên <span className="text-red-500">*</span>
                </FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn mức ưu tiên" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1">1 - Cao nhất</SelectItem>
                    <SelectItem value="2">2 - Cao</SelectItem>
                    <SelectItem value="3">3 - Trung bình</SelectItem>
                    <SelectItem value="4">4 - Thấp</SelectItem>
                    <SelectItem value="5">5 - Thấp nhất</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Mức ưu tiên của dự án (1 là cao nhất)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

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
                    <SelectItem value="cancelled">Đã hủy</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Trạng thái hiện tại của dự án</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="complexity"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  Độ phức tạp <span className="text-red-500">*</span>
                </FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn độ phức tạp" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1">1 - Rất đơn giản</SelectItem>
                    <SelectItem value="2">2 - Đơn giản</SelectItem>
                    <SelectItem value="3">3 - Trung bình</SelectItem>
                    <SelectItem value="4">4 - Phức tạp</SelectItem>
                    <SelectItem value="5">5 - Rất phức tạp</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Độ phức tạp kỹ thuật của dự án (1 là đơn giản nhất)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="business_value"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  Giá trị kinh doanh <span className="text-red-500">*</span>
                </FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn giá trị" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1">1 - Rất thấp</SelectItem>
                    <SelectItem value="2">2 - Thấp</SelectItem>
                    <SelectItem value="3">3 - Trung bình</SelectItem>
                    <SelectItem value="4">4 - Cao</SelectItem>
                    <SelectItem value="5">5 - Rất cao</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Giá trị kinh doanh của dự án (1 là thấp nhất)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="technical_risk"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  Rủi ro kỹ thuật <span className="text-red-500">*</span>
                </FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn rủi ro" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="1">1 - Rất thấp</SelectItem>
                    <SelectItem value="2">2 - Thấp</SelectItem>
                    <SelectItem value="3">3 - Trung bình</SelectItem>
                    <SelectItem value="4">4 - Cao</SelectItem>
                    <SelectItem value="5">5 - Rất cao</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Mức độ rủi ro kỹ thuật của dự án (1 là thấp nhất)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="dependencies"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dự án phụ thuộc</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Nhập ID các dự án phụ thuộc, cách nhau bằng dấu phẩy" 
                  className="min-h-[60px]" 
                  {...field} 
                />
              </FormControl>
              <FormDescription>Danh sách ID các dự án mà dự án này phụ thuộc vào</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="historical_data"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dữ liệu lịch sử</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Nhập thông tin về các dự án tương tự đã thực hiện" 
                  className="min-h-[60px]" 
                  {...field} 
                />
              </FormControl>
              <FormDescription>Thông tin về các dự án tương tự đã thực hiện trước đây</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Hủy
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Đang lưu..." : project ? "Cập nhật" : "Tạo dự án"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
