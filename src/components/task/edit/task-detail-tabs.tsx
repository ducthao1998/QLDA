"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { BarChart2Icon, FileTextIcon } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"

import type { TaskFormValues } from "../task-edit-form"
import type { User, ProjectPhase, Skill } from "@/app/types/table-types"

interface TaskDetailsTabProps {
  form: UseFormReturn<TaskFormValues>
  phases: ProjectPhase[]
  users: User[]
  skills: Skill[]
  selectedSkills: number[]
  onSkillChange: (skillId: number) => void
}

export function TaskDetailsTab({ form, phases, users, skills, selectedSkills, onSkillChange }: TaskDetailsTabProps) {
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
                <FormLabel>Tên công việc</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ngày bắt đầu</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
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
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="phase_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Giai đoạn</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn giai đoạn" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {phases.map((phase) => (
                        <SelectItem key={phase.id} value={phase.id}>
                          {phase.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assigned_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Người thực hiện</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn người thực hiện" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="-1">Chưa phân công</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name}
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
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ghi chú</FormLabel>
                <FormControl>
                  <Textarea {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="unit_in_charge"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Đơn vị thực hiện</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2Icon className="h-5 w-5" />
            Lĩnh vực liên quan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <Badge
                  key={skill.id}
                  variant={selectedSkills.includes(skill.id) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => onSkillChange(skill.id)}
                >
                  {skill.name}
                </Badge>
              ))}
            </div>
            <FormDescription>Chọn các lĩnh vực liên quan đến công việc này</FormDescription>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
