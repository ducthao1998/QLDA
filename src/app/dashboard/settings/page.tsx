"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { SlidersHorizontal } from "lucide-react"

const SettingsSchema = z.object({
  algorithm: z.literal("multi_project_cpm").default("multi_project_cpm"),
  objective_type: z.enum(["time", "resource"]).default("time"),
  respect_dependencies: z.boolean().default(true),
  respect_skills: z.boolean().default(true),
  respect_availability: z.boolean().default(true),
})

type SettingsInput = z.input<typeof SettingsSchema>
type SettingsOutput = z.output<typeof SettingsSchema>

export default function AlgorithmSettingsPage() {
  const [loading, setLoading] = useState(true)

  const form = useForm<SettingsInput, any, SettingsOutput>({
    resolver: zodResolver(SettingsSchema),
    defaultValues: {
      algorithm: "multi_project_cpm",
      objective_type: "time",
      respect_dependencies: true,
      respect_skills: true,
      respect_availability: true,
    },
  })

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/settings/algorithm")
        if (res.ok) {
          const json = await res.json()
          const s = json.settings
          if (s) {
            form.reset({
              algorithm: s.algorithm || "multi_project_cpm",
              objective_type: s.objective_type === "resource" ? "resource" : "time",
              respect_dependencies: s.constraints?.respect_dependencies ?? true,
              respect_skills: s.constraints?.respect_skills ?? true,
              respect_availability: s.constraints?.respect_availability ?? true,
            })
          }
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const onSubmit = async (values: SettingsOutput) => {
    try {
      const res = await fetch("/api/settings/algorithm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algorithm: values.algorithm,
          objective: { type: values.objective_type },
          constraints: {
            respect_dependencies: values.respect_dependencies,
            respect_skills: values.respect_skills,
            respect_availability: values.respect_availability,
          },
        }),
      })
      if (!res.ok) throw new Error("Không thể lưu cấu hình")
      toast.success("Đã lưu cấu hình thuật toán")
    } catch (e: any) {
      toast.error(e.message || "Lỗi khi lưu cấu hình")
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 p-6 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 flex items-start gap-4">
          <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center">
            <SlidersHorizontal className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Cấu hình Thuật toán</h1>
            <p className="text-blue-100 mt-1">
              Tùy chỉnh mục tiêu tối ưu, trọng số và ràng buộc. Cấu hình này sẽ được áp dụng làm mặc định khi tối ưu lịch.
            </p>
          </div>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Tham số thuật toán</CardTitle>
          <CardDescription>Điều chỉnh các tham số ảnh hưởng đến kết quả tối ưu</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="algorithm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Thuật toán</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn thuật toán" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="multi_project_cpm">Multi-Project CPM</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Hiện hỗ trợ Multi-Project Critical Path Method.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="objective_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mục tiêu tối ưu</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Chọn mục tiêu" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="time">Thời gian (Makespan)</SelectItem>
                          <SelectItem value="resource">Tài nguyên</SelectItem>
                          <SelectItem value="cost">Chi phí</SelectItem>
                          <SelectItem value="multi">Đa mục tiêu (trọng số)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Chọn tiêu chí chính để tối ưu hoặc dùng đa mục tiêu.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Simplified: remove weight/cost inputs */}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="respect_dependencies"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-1">
                        <FormLabel>Tôn trọng phụ thuộc</FormLabel>
                        <FormDescription>Không vi phạm quan hệ phụ thuộc giữa các task.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="respect_skills"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-1">
                        <FormLabel>Tôn trọng kỹ năng</FormLabel>
                        <FormDescription>Chỉ phân công người có kỹ năng phù hợp.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="respect_availability"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-1">
                        <FormLabel>Tôn trọng lịch bận</FormLabel>
                        <FormDescription>Xem xét độ sẵn sàng của nhân sự.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Simplified: remove advanced numeric constraints */}

              <div className="flex justify-end">
                <Button type="submit" disabled={loading}>Lưu cấu hình</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Giải trình</CardTitle>
          <CardDescription>Ý nghĩa các tham số ảnh hưởng đến thuật toán</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Mục tiêu tối ưu</span> quyết định hàm mục tiêu: giảm thời gian hoàn thành (makespan),
            cân bằng tải tài nguyên, hoặc tối thiểu hóa chi phí. Chế độ đa mục tiêu dùng trọng số để tổng hợp.
          </p>
          <p>
            <span className="font-medium text-foreground">Trọng số</span> là các hệ số trong hàm mục tiêu đa mục tiêu. Giá trị từ 0 đến 1; tổng không bắt buộc bằng 1
            nhưng nên được chuẩn hóa để trực quan.
          </p>
          <p>
            <span className="font-medium text-foreground">Ràng buộc</span> đảm bảo lịch hợp lệ: phụ thuộc, kỹ năng, và độ sẵn sàng.
            Các ngưỡng như giới hạn thời gian/chi phí hoặc tối thiểu sử dụng tài nguyên giúp phù hợp bối cảnh dự án.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}


