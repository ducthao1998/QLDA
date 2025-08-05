"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { BarChart2Icon, ClockIcon, FileTextIcon, LayersIcon } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"
import type { TaskFormValues } from "../task-edit-form"
import type { User, Skill } from "@/app/types/table-types"

interface TaskDetailsTabProps {
  form: UseFormReturn<TaskFormValues>
  users: User[]
  skills: Skill[]
  selectedSkills: number[]
  onSkillChange: (skillId: number) => void
  projectData?: { start_date: string; end_date: string } | null
}

export function TaskDetailsTab({
  form,
  users,
  skills,
  selectedSkills,
  onSkillChange,
  projectData
}: TaskDetailsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="h-5 w-5" />
            Thông tin cơ bản
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tên công việc *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Nhập tên công việc" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ghi chú</FormLabel>
                <FormControl>
                  <Textarea {...field} placeholder="Nhập ghi chú cho công việc" rows={3} />
                </FormControl>
                <FormDescription>
                  Mô tả chi tiết về công việc, yêu cầu, hoặc lưu ý đặc biệt.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="duration_days"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <ClockIcon className="h-4 w-4" />
                  Thời gian thực hiện (ngày)
                </FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    type="number" 
                    min="1" 
                    placeholder="Số ngày cần để hoàn thành"
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </FormControl>
                <FormDescription>
                  Dự kiến số ngày cần để hoàn thành công việc này.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2Icon className="h-5 w-5" />
            Kỹ năng & Lĩnh vực liên quan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {skills.length > 0 ? skills.map((skill) => (
                <Badge
                  key={skill.id}
                  variant={selectedSkills.includes(skill.id) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80 transition-colors"
                  onClick={() => onSkillChange(skill.id)}
                >
                  {skill.name}
                </Badge>
              )) : (
                <p className="text-sm text-muted-foreground">Đang tải danh sách kỹ năng...</p>
              )}
            </div>
            <FormDescription>
              Chọn các kỹ năng/lĩnh vực liên quan đến công việc này. Điều này sẽ giúp hệ thống gợi ý người thực hiện phù hợp.
            </FormDescription>
            {selectedSkills.length > 0 && (
              <div className="text-sm text-muted-foreground">
                ✓ Đã chọn {selectedSkills.length} kỹ năng
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}