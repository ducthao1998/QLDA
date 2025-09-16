"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { SlidersHorizontal } from "lucide-react"

// ======== Schemas =========
const AssignSchema = z.object({
  enabled: z.boolean().default(true),
  priority_mode: z.enum(["lexi", "weighted"]).default("weighted"),
  default_max_concurrent_tasks: z.coerce.number().int().min(1).max(10).default(2),
  respect_user_caps: z.boolean().default(true),
  min_confidence_R: z.coerce.number().min(0).max(1).default(0.35),
  unassigned_cost: z.coerce.number().min(0).max(1).default(0.5),
  allow_same_RA: z.boolean().default(false),
  min_accountable_score: z.coerce.number().min(0).max(1).default(0.6),
  min_accountable_skill_fit: z.coerce.number().min(0).max(1).default(0.3),
})

const CpmSchema = z.object({
  criticality_threshold_days: z.coerce.number().min(-30).max(30).default(0),
  default_task_duration_days: z.coerce.number().int().min(1).max(90).default(1),
  allow_start_next_day: z.boolean().default(true),
  free_float_warn_ratio: z.coerce.number().min(0).max(1).default(0.25),
  at_risk_ratio: z.coerce.number().min(0).max(1).default(0.7),
  delayed_ratio: z.coerce.number().min(0).max(1).default(0.5),
  buffer_days_default: z.coerce.number().int().min(0).max(60).default(0),
  objective_weights: z.object({
    time_weight: z.coerce.number().min(0).max(1).default(1),
    resource_weight: z.coerce.number().min(0).max(1).default(0),
    cost_weight: z.coerce.number().min(0).max(1).default(0),
  }).default({ time_weight: 1, resource_weight: 0, cost_weight: 0 })
})

const SettingsSchema = z.object({
  algorithm: z.literal("multi_project_cpm").default("multi_project_cpm"),
  objective_type: z.enum(["time", "resource", "cost", "multi"]).default("time"),
  respect_dependencies: z.boolean().default(true),
  respect_skills: z.boolean().default(true),
  respect_availability: z.boolean().default(true),
  assignment_prefs: AssignSchema.default({}),
  cpm_prefs: CpmSchema.default({})
})

type SettingsInput = z.input<typeof SettingsSchema>
type SettingsOutput = z.output<typeof SettingsSchema>

// ======== Small helpers =========
function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="font-medium">{title}</div>
      {children}
    </div>
  )
}

export default function AlgorithmSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAdvRaci, setShowAdvRaci] = useState(false)
  const [showAdvCpm, setShowAdvCpm] = useState(false)
  // Preset CPM: đơn giản hóa việc chọn số ngày
  const cpmPresets = [
    { key: 'chat_che', label: 'Chặt chẽ', values: { criticality_threshold_days: 0, buffer_days_default: 0, default_task_duration_days: 1 } },
    { key: 'can_bang', label: 'Cân bằng', values: { criticality_threshold_days: 1, buffer_days_default: 3, default_task_duration_days: 3 } },
    { key: 'linh_hoat', label: 'Linh hoạt', values: { criticality_threshold_days: 2, buffer_days_default: 7, default_task_duration_days: 5 } },
  ] as const
  type CpmPresetKey = typeof cpmPresets[number]['key']
  const [cpmPreset, setCpmPreset] = useState<CpmPresetKey>('can_bang')
  useEffect(() => {
    const p = cpmPresets.find(x => x.key === cpmPreset)!
    // Không đụng allow_start_next_day ở preset; để người dùng tự chọn bật/tắt
    form.setValue('cpm_prefs.criticality_threshold_days', p.values.criticality_threshold_days, { shouldDirty: true })
    form.setValue('cpm_prefs.buffer_days_default', p.values.buffer_days_default, { shouldDirty: true })
    form.setValue('cpm_prefs.default_task_duration_days', p.values.default_task_duration_days, { shouldDirty: true })
  }, [cpmPreset])

  const form = useForm<SettingsInput, any, SettingsOutput>({
    resolver: zodResolver(SettingsSchema),
    defaultValues: {
      algorithm: "multi_project_cpm",
      objective_type: "time",
      respect_dependencies: true,
      respect_skills: true,
      respect_availability: true,
      assignment_prefs: {
        enabled: true,
        priority_mode: "weighted",
        default_max_concurrent_tasks: 2,
        respect_user_caps: true,
        min_confidence_R: 0.35,
        unassigned_cost: 0.5,
        allow_same_RA: false,
        min_accountable_score: 0.6,
        min_accountable_skill_fit: 0.3,
      },
      cpm_prefs: {
        criticality_threshold_days: 0,
        default_task_duration_days: 1,
        allow_start_next_day: true,
        free_float_warn_ratio: 0.25,
        at_risk_ratio: 0.7,
        delayed_ratio: 0.5,
        buffer_days_default: 0,
        objective_weights: { time_weight: 1, resource_weight: 0, cost_weight: 0 },
      },
    },
  })

  // Load existing
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/settings/algorithm")
        if (res.ok) {
          const { settings } = await res.json()
          if (settings) {
            form.reset({
              algorithm: settings.algorithm || "multi_project_cpm",
              objective_type: ["time","resource","cost","multi"].includes(settings.objective_type) ? settings.objective_type : "time",
              respect_dependencies: settings.constraints?.respect_dependencies ?? true,
              respect_skills: settings.constraints?.respect_skills ?? true,
              respect_availability: settings.constraints?.respect_availability ?? true,
              assignment_prefs: settings.assignment_prefs ?? {},
              cpm_prefs: settings.cpm_prefs ?? {}
            })
          }
        }
      } catch {}
      setLoading(false)
    })()
  }, [])

  // Watch all to render “impact”
  const w = form.watch()

  // Presets: người dùng chỉ chọn mức chất lượng, hệ thống tự map các ngưỡng
  const presets = [
    { key: 'nhanh', label: 'Nhanh', values: { min_confidence_R: 0.25, unassigned_cost: 0.3, min_accountable_score: 0.5, min_accountable_skill_fit: 0.2 } },
    { key: 'can_bang', label: 'Cân bằng', values: { min_confidence_R: 0.35, unassigned_cost: 0.5, min_accountable_score: 0.6, min_accountable_skill_fit: 0.3 } },
    { key: 'chat_luong', label: 'Chất lượng', values: { min_confidence_R: 0.5, unassigned_cost: 0.7, min_accountable_score: 0.7, min_accountable_skill_fit: 0.5 } },
  ] as const
  type PresetKey = typeof presets[number]['key']
  const [preset, setPreset] = useState<PresetKey>('can_bang')
  useEffect(() => {
    const found = presets.find(p => p.key === preset)!
    form.setValue('assignment_prefs.min_confidence_R', found.values.min_confidence_R, { shouldDirty: true })
    form.setValue('assignment_prefs.unassigned_cost', found.values.unassigned_cost, { shouldDirty: true })
    form.setValue('assignment_prefs.min_accountable_score', found.values.min_accountable_score, { shouldDirty: true })
    form.setValue('assignment_prefs.min_accountable_skill_fit', found.values.min_accountable_skill_fit, { shouldDirty: true })
  }, [preset])

  const onSubmit = async (values: SettingsOutput) => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings/algorithm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algorithm: values.algorithm,
          objective: { type: values.objective_type, weights: values.cpm_prefs?.objective_weights },
          constraints: {
            respect_dependencies: values.respect_dependencies,
            respect_skills: values.respect_skills,
            respect_availability: values.respect_availability,
          },
          assignment_prefs: values.assignment_prefs,
          cpm_prefs: values.cpm_prefs,
        }),
      })
      if (!res.ok) throw new Error("Không thể lưu cấu hình")
      toast.success("Đã lưu cấu hình thuật toán")
    } catch (e: any) {
      toast.error(e.message || "Lỗi khi lưu cấu hình")
    } finally {
      setSaving(false)
    }
  }

  const resetDefaults = () => {
    form.reset({
      algorithm: "multi_project_cpm",
      objective_type: "time",
      respect_dependencies: true,
      respect_skills: true,
      respect_availability: true,
      assignment_prefs: {
        enabled: true,
        priority_mode: "weighted",
        default_max_concurrent_tasks: 2,
        respect_user_caps: true,
        min_confidence_R: 0.35,
        unassigned_cost: 0.5,
        allow_same_RA: false,
        min_accountable_score: 0.6,
        min_accountable_skill_fit: 0.3,
      },
      cpm_prefs: {
        criticality_threshold_days: 0,
        default_task_duration_days: 1,
        allow_start_next_day: true,
        free_float_warn_ratio: 0.25,
        at_risk_ratio: 0.7,
        delayed_ratio: 0.5,
        buffer_days_default: 0,
        objective_weights: { time_weight: 1, resource_weight: 0, cost_weight: 0 },
      },
    })
    toast.success("Đã khôi phục mặc định. Nhấn Lưu để áp dụng.")
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 p-6 text-white">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 flex items-start gap-4">
          <div className="h-12 w-12 bg-white/20 rounded-lg flex items-center justify-center">
            <SlidersHorizontal className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Cấu hình Thuật toán</h1>
            <p className="text-blue-100 mt-1">
              Mỗi tham số đều có <strong>“Tác động”</strong> để anh thấy ngay nó ảnh hưởng tới việc phân công & lịch.
            </p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Left: settings */}
          <div className="space-y-6">
            {/* Global */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Phân công (RACI) — Cài đặt chung</CardTitle>
                <CardDescription>Tối giản để dễ dùng</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Row title="Mức cài đặt nhanh (chọn 1 trong 3)">
                  <div className="grid md:grid-cols-3 gap-3">
                    <Button type="button" variant={preset==='nhanh'?'default':'secondary'} onClick={()=>setPreset('nhanh')}>Ưu tiên tốc độ</Button>
                    <Button type="button" variant={preset==='can_bang'?'default':'secondary'} onClick={()=>setPreset('can_bang')}>Cân bằng</Button>
                    <Button type="button" variant={preset==='chat_luong'?'default':'secondary'} onClick={()=>setPreset('chat_luong')}>Ưu tiên chất lượng</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Ưu tiên tốc độ: dễ gán hơn · Cân bằng: tiêu chuẩn vừa · Ưu tiên chất lượng: siết chặt tiêu chuẩn để chọn người phù hợp hơn.</p>
                </Row>

                <Row title="Ràng buộc lịch">
                  <div className="grid md:grid-cols-3 gap-3">
                    <FormField control={form.control} name="respect_dependencies" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Giữ đúng phụ thuộc</FormLabel>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="respect_skills" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Đúng kỹ năng</FormLabel>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="respect_availability" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Tính đến lịch bận</FormLabel>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                </Row>
              </CardContent>
            </Card>

            {/* Assignment (RACI) */}
            <Card>
              <CardHeader>
                <CardTitle>Phân công (RACI) — Tự động</CardTitle>
                <CardDescription>Đơn giản hóa để dễ dùng</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAdvRaci(v => !v)}>
                    {showAdvRaci ? 'Ẩn cài đặt nâng cao' : 'Tùy chỉnh chi tiết'}
                  </Button>
                </div>
                <Row title="Bật tự động & cách xếp hạng người phù hợp">
                  <div className="grid md:grid-cols-2 gap-3">
                    <FormField control={form.control} name="assignment_prefs.enabled" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Bật tự động</FormLabel>
                        <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="assignment_prefs.priority_mode" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chế độ xếp hạng</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || 'lexi'}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Chọn chế độ" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="lexi">Thứ tự 1→2→3→4: (1) Không vượt số việc (2) Kinh nghiệm (3) Ít việc (4) Bốc thăm khi hòa</SelectItem>
                            <SelectItem value="weighted">Điểm tổng hợp = Kinh nghiệm 50% + Cân bằng việc 35% + Phủ kỹ năng 10% + Chuyên sâu 5%</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Thứ tự 1→2→3→4: so sánh lần lượt theo các tiêu chí. Điểm tổng hợp: tính một điểm duy nhất từ các tiêu chí.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </Row>

                <Row title="Số việc tối đa mỗi người (mặc định)">
                  <div className="grid md:grid-cols-2 gap-3">
                    <FormField control={form.control} name="assignment_prefs.default_max_concurrent_tasks" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Số việc</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} max={10} value={String(field.value ?? '')}
                                 onChange={e => field.onChange(Number(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="assignment_prefs.respect_user_caps" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Dùng số việc tối đa riêng của từng người</FormLabel>
                        <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                </Row>
                <Row title="Quy tắc chọn A (để mặc định nếu không chắc)">
                  <div className="grid md:grid-cols-2 gap-3">
                    <FormField control={form.control} name="assignment_prefs.allow_same_RA" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel>Cho phép R & A là cùng người</FormLabel>
                        <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />
                    {/* Ẩn số liệu nâng cao: dùng preset ở trên */}
                  </div>
                </Row>

                {showAdvRaci && (
                  <div className="space-y-3">
                    <Row title="Ngưỡng chi tiết (R)">
                      <div className="grid md:grid-cols-2 gap-3">
                        <FormField control={form.control} name="assignment_prefs.min_confidence_R" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Điểm tối thiểu để được làm R</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" min={0} max={1} value={String(field.value ?? '')}
                                     onChange={e => field.onChange(Number(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="assignment_prefs.unassigned_cost" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mức chấp nhận "không gán"</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" min={0} max={1} value={String(field.value ?? '')}
                                     onChange={e => field.onChange(Number(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </Row>
                    <Row title="Ngưỡng chi tiết (A)">
                      <div className="grid md:grid-cols-2 gap-3">
                        <FormField control={form.control} name="assignment_prefs.min_accountable_score" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Điểm tối thiểu cho A</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" min={0} max={1} value={String(field.value ?? '')}
                                     onChange={e => field.onChange(Number(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="assignment_prefs.min_accountable_skill_fit" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mức phù hợp kỹ năng tối thiểu cho A</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" min={0} max={1} value={String(field.value ?? '')}
                                     onChange={e => field.onChange(Number(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    </Row>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CPM */}
            <Card>
              <CardHeader>
                <CardTitle>Lập lịch (CPM)</CardTitle>
                <CardDescription>Hệ thống dùng phương pháp Đường găng (CPM) để tính mốc thời gian.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                {/* CPM Presets */}
                <div className="space-y-2">
                  <div className="text-foreground font-medium">Cài đặt nhanh CPM</div>
                  <div className="grid md:grid-cols-3 gap-3">
                    <Button type="button" variant={cpmPreset==='chat_che'?'default':'secondary'} onClick={()=>setCpmPreset('chat_che')}>Chặt chẽ</Button>
                    <Button type="button" variant={cpmPreset==='can_bang'?'default':'secondary'} onClick={()=>setCpmPreset('can_bang')}>Cân bằng</Button>
                    <Button type="button" variant={cpmPreset==='linh_hoat'?'default':'secondary'} onClick={()=>setCpmPreset('linh_hoat')}>Linh hoạt</Button>
                  </div>
                  <p>Chặt chẽ: găng nghiêm ngặt, không ngày đệm, thời lượng mặc định ngắn. Linh hoạt: găng rộng rãi, có ngày đệm, thời lượng mặc định dài.</p>
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowAdvCpm(v => !v)}>
                    {showAdvCpm ? 'Ẩn cài đặt nâng cao' : 'Tùy chỉnh chi tiết'}
                  </Button>
                </div>
                {!showAdvCpm && (
                  <>
                    <p>Mặc định: bắt đầu sau khi tiền nhiệm kết thúc; thời lượng mặc định = 1 ngày.</p>
                  </>
                )}
                {showAdvCpm && (
                  <div className="grid md:grid-cols-2 gap-3 text-foreground">
                    <FormField control={form.control} name="cpm_prefs.allow_start_next_day" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-1">
                          <FormLabel>Bắt đầu sau công việc trước</FormLabel>
                          <FormDescription>Ví dụ: tiền nhiệm kết thúc 10/5 → công việc này bắt đầu 11/5.</FormDescription>
                        </div>
                        <FormControl><Switch checked={!!field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="cpm_prefs.default_task_duration_days" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Thời lượng mặc định (ngày)</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} max={90} value={String(field.value ?? '')}
                                 onChange={e => field.onChange(Number(e.target.value))} />
                        </FormControl>
                        <FormDescription>Dùng khi công việc chưa có thời lượng.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="cpm_prefs.criticality_threshold_days" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ngưỡng xác định găng (ngày)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.5" min={-30} max={30} value={String(field.value ?? '')}
                                 onChange={e => field.onChange(Number(e.target.value))} />
                        </FormControl>
                        <FormDescription>Slack ≤ ngưỡng → coi là găng. Đặt 0 để chỉ găng khi không dư thời gian.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="cpm_prefs.buffer_days_default" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ngày dự phòng (buffer)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} max={60} value={String(field.value ?? '')}
                                 onChange={e => field.onChange(Number(e.target.value))} />
                        </FormControl>
                        <FormDescription>Thêm ngày đệm vào kế hoạch tổng.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={resetDefaults} disabled={loading || saving}>Khôi phục mặc định</Button>
              <Button type="submit" disabled={loading || saving}>Lưu</Button>
            </div>
          </div>
          {/* Bỏ cột tóm tắt để tránh dài và tràn; giao diện 1 cột gọn hơn */}
        </form>
      </Form>
    </div>
  )
}
