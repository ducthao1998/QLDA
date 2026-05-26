"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, Clock, Sparkles, Target } from "lucide-react"

interface TaskDetail {
  taskId: string
  taskName: string
  duration: number
  slack: number
  isCritical: boolean
  reason: string
}

interface Props {
  data: any // OptimizationResult from /api/projects/[id]/optimize
}

/**
 * Friendly "what just got optimized" panel.
 *
 * Why this exists: the previous panel listed UUIDs and percentages with no
 * concrete actionability. This one tells the user, in plain Vietnamese,
 *   - how many days were saved and why,
 *   - which tasks they CANNOT slip (critical chain) — with names + durations,
 *   - which tasks have wiggle room (positive slack) — so they know where they
 *     can deprioritise without delaying the project.
 */
export function OptimizationResultPanel({ data }: Props) {
  const before = data?.original_makespan ?? 0
  const after = data?.optimized_makespan ?? 0
  const saved = Math.max(0, before - after)
  const pct = data?.improvement_percentage ?? 0
  const parallelCount = data?.duration_analysis?.parallel_tasks_count ?? 0

  const taskDetails: TaskDetail[] = data?.critical_path_details?.taskDetails ?? []
  const criticalTasks = taskDetails.filter((t) => t.isCritical)
  const slackTasks = taskDetails
    .filter((t) => !t.isCritical && t.slack > 0)
    .sort((a, b) => b.slack - a.slack)

  return (
    <div className="space-y-6">
      {/* ---------------- Hero: the big "X days saved" number ---------------- */}
      <Card className="border-l-4 border-l-emerald-500">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex-1 min-w-[280px]">
              <p className="text-sm text-emerald-700 font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Thuật toán Multi-Project CPM
              </p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-5xl font-bold text-emerald-700">{saved}</span>
                <span className="text-xl text-emerald-700 font-medium">ngày được tiết kiệm</span>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Tổng thời lượng các công việc là <b>{before} ngày</b> nếu làm tuần tự.
                Nhờ chạy <b>{parallelCount}</b> công việc song song khi không phụ thuộc lẫn nhau,
                dự án chỉ cần <b className="text-emerald-700">{after} ngày</b> &mdash; nhanh hơn {pct.toFixed(1)}%.
              </p>
            </div>

            <div className="flex-1 min-w-[320px]">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">So sánh trực quan</p>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">Tuần tự (baseline)</span>
                    <span className="font-mono text-slate-700">{before} ngày</span>
                  </div>
                  <div className="h-4 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-slate-400" style={{ width: "100%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-emerald-700 font-medium">CPM song song</span>
                    <span className="font-mono text-emerald-700 font-medium">{after} ngày</span>
                  </div>
                  <div className="h-4 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${before > 0 ? Math.max(4, (after / before) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Critical chain ---------------- */}
      <Card className="border-l-4 border-l-amber-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-amber-600" />
            Đường găng &mdash; {criticalTasks.length} công việc không thể trễ
          </CardTitle>
          <CardDescription>
            Nếu bất kỳ công việc nào dưới đây trễ 1 ngày, toàn dự án sẽ trễ 1 ngày.
            Đây là nơi cần dồn nguồn lực và theo dõi sát.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {criticalTasks.length > 0 ? (
            <div className="space-y-2">
              {criticalTasks.map((task, idx) => (
                <div
                  key={task.taskId}
                  className="flex items-center gap-3 p-3 rounded-md border border-amber-200 bg-amber-50"
                >
                  <Badge className="bg-amber-600 hover:bg-amber-600 text-white shrink-0">{idx + 1}</Badge>
                  <span className="font-medium text-amber-900 flex-1">{task.taskName}</span>
                  <Badge variant="outline" className="border-amber-300 text-amber-800 shrink-0">
                    <Clock className="h-3 w-3 mr-1" />
                    {Math.round(task.duration)} ngày
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground text-sm">
              Không có đường găng — dự án này quá nhỏ hoặc không có dependency.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ---------------- Slack tasks (the "wiggle room" list) ---------------- */}
      {slackTasks.length > 0 && (
        <Card className="border-l-4 border-l-sky-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-sky-600" />
              {slackTasks.length} công việc có dư địa (slack)
            </CardTitle>
            <CardDescription>
              Những công việc này có thể trễ trong khoảng dưới đây mà KHÔNG ảnh hưởng đến deadline dự án.
              Có thể tạm ưu tiên thấp hơn để dồn người cho đường găng.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2">
              {slackTasks.slice(0, 12).map((task) => (
                <div
                  key={task.taskId}
                  className="flex items-center gap-3 p-3 rounded-md border bg-sky-50/40"
                >
                  <span className="text-sm flex-1 truncate" title={task.taskName}>
                    {task.taskName}
                  </span>
                  <Badge variant="outline" className="border-sky-300 text-sky-800 shrink-0">
                    Trễ ≤ {Math.floor(task.slack)} ngày
                  </Badge>
                </div>
              ))}
            </div>
            {slackTasks.length > 12 && (
              <p className="text-xs text-muted-foreground mt-3">
                Và {slackTasks.length - 12} công việc nữa &mdash; xuất Excel để xem toàn bộ.
              </p>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  )
}
