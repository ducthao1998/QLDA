"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { BarChart2Icon, CalendarIcon, FileTextIcon } from "lucide-react"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import type { UseFormReturn } from "react-hook-form"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { TaskFormValues } from "../task-edit-form"
import type { User, ProjectPhase, Skill } from "@/app/types/table-types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface TaskDetailsTabProps {
  form: UseFormReturn<TaskFormValues>
  phases: ProjectPhase[]
  users: User[]
  skills: Skill[]
  selectedSkills: number[]
  onSkillChange: (skillId: number) => void
  projectData?: { start_date: string; end_date: string } | null
}

export function TaskDetailsTab({ 
  form, 
  phases, 
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
            name="phase_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Giai đoạn dự án *</FormLabel>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="start_date" render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Ngày bắt đầu</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                            {field.value ? (format(new Date(field.value), "PPP", { locale: vi })) : (<span>Chọn ngày</span>)}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar 
                                                      mode="single" 
                                                      selected={field.value ? new Date(field.value) : undefined} 
                                                      onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")} 
                                                      initialFocus 
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>

                                    <FormField control={form.control} name="end_date" render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Ngày kết thúc</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                            {field.value ? (format(new Date(field.value), "PPP", { locale: vi })) : (<span>Chọn ngày</span>)}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar 
                                                      mode="single" 
                                                      selected={field.value ? new Date(field.value) : undefined} 
                                                      onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")} 
                                                      disabled={(date) => {
                                                        const startDate = form.getValues("start_date");
                                                        return startDate ? date < new Date(startDate) : false;
                                                      }} 
                                                      initialFocus 
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
          </div>

          {/* <FormField
            control={form.control}
            name="assigned_to"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Người thực hiện</FormLabel>
                <Select value={field.value || "unassigned"} onValueChange={(value) => field.onChange(value === "unassigned" ? "" : value)}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn người thực hiện" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="unassigned">Chưa phân công</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name} - {user.position}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          /> */}

          <FormField
            control={form.control}
            name="max_retries"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Số lần cho phép trình sai</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="0"
                    {...field}
                    value={field.value || 0}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    placeholder="0"
                  />
                </FormControl>
                <FormDescription>
                  Số lần tối đa được phép trình lại khi không đạt yêu cầu
                </FormDescription>
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
                    <Input {...field} placeholder="Nhập đơn vị thực hiện" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="legal_basis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Căn cứ thực hiện</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Nhập căn cứ thực hiện" />
                  </FormControl>
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
                  <Textarea {...field} placeholder="Nhập ghi chú" />
                </FormControl>
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
            <FormDescription>
              Chọn các lĩnh vực liên quan đến công việc này. Điều này sẽ giúp gợi ý người thực hiện phù hợp.
            </FormDescription>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
