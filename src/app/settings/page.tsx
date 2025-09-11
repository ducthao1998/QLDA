"use client"

import { useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
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
import Link from "next/link"
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
      } catch {}
      finally {
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
              Chọn mục tiêu và ràng buộc. Hệ thống sẽ dùng cấu hình này khi tối ưu lịch và phân tích.
            </p>
          </div>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Thiết lập nhanh</CardTitle>
          <CardDescription>Đơn giản, phù hợp người dùng không chuyên thuật toán</CardDescription>
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
                          <SelectItem value="multi_project_cpm">Multi‑Project CPM</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Thuật toán tối ưu đường găng đa dự án</FormDescription>
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
                          <SelectItem value="time">Kết thúc sớm nhất (ưu tiên thời gian)</SelectItem>
                          <SelectItem value="resource">Cân bằng tài nguyên (đều người)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Thời gian: đẩy nhanh hoàn thành. Tài nguyên: giảm dồn việc vào 1 người.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="respect_dependencies"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-1">
                        <FormLabel>Tôn trọng phụ thuộc</FormLabel>
                        <FormDescription>Không phá chuỗi phụ thuộc giữa các task</FormDescription>
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
                        <FormLabel>Đúng kỹ năng</FormLabel>
                        <FormDescription>Chỉ phân công người có kỹ năng phù hợp</FormDescription>
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
                        <FormLabel>Không trùng lịch bận</FormLabel>
                        <FormDescription>Tính đến người đang bận việc khác</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button type="submit" disabled={loading}>Lưu cấu hình</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Giải thích ngắn gọn</CardTitle>
          <CardDescription>Hiểu nhanh: chọn gì thì được gì</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li><span className="text-foreground font-medium">Ưu tiên thời gian</span>: dự án hoàn thành sớm hơn, task đường găng được đẩy lên.</li>
            <li><span className="text-foreground font-medium">Cân bằng tài nguyên</span>: giảm dồn việc, công bằng giữa thành viên.</li>
            <li><span className="text-foreground font-medium">Tôn trọng phụ thuộc/kỹ năng/lịch bận</span>: lịch hợp lệ, đúng người, đúng lúc.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tự động gán RACI (Hungarian)</CardTitle>
          <CardDescription>Phân công người thực hiện tối ưu theo kỹ năng & tải</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Hệ thống tính điểm phù hợp dựa trên kinh nghiệm kỹ năng và độ bận, rồi chọn người “R” tối ưu cho mỗi task. Các vai trò A/C/I được đề xuất theo kinh nghiệm và sự sẵn sàng.
          </p>
          <p>
            Thao tác: vào trang <Link href="/dashboard/raci" className="text-blue-600 hover:underline">RACI</Link> hoặc <Link href="/dashboard/tasks" className="text-blue-600 hover:underline">Tasks</Link> để chạy “Tự động gán RACI”.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}


