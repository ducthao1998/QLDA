import { format } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ClockIcon, BarChart2Icon } from "lucide-react"

import type { TaskHistory, TaskProgress } from "@/app/types/table-types"

interface TaskHistoryTabProps {
  taskHistory: TaskHistory[]
  taskProgress: TaskProgress | null
}

export function TaskHistoryTab({ taskHistory, taskProgress }: TaskHistoryTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClockIcon className="h-5 w-5" />
            Lịch sử công việc
          </CardTitle>
        </CardHeader>
        <CardContent>
          {taskHistory.length > 0 ? (
            <div className="space-y-4">
              {taskHistory.map((history) => (
                <div key={history.id} className="flex items-start gap-3 p-2 border-b last:border-0">
                  <div className="w-12 text-xs text-muted-foreground">{format(new Date(history.created_at), "dd/MM/yy")}</div>
                  <div>
                    <p className="text-sm font-medium">
                      {history.action === "status_changed" && "Thay đổi trạng thái"}
                      {history.action === "assignment_changed" && "Thay đổi người thực hiện"}
                      {history.action === "overdue_detected" && "Phát hiện quá hạn"}
                      {history.action === "dependency_added" && "Thêm phụ thuộc"}
                      {history.action === "dependency_removed" && "Xóa phụ thuộc"}
                      {history.action === "worklog_added" && "Thêm nhật ký công việc"}
                    </p>
                    <p className="text-xs">
                      {history.from_val && history.to_val && (
                        <>
                          Từ <span className="font-medium">{history.from_val}</span> thành{" "}
                          <span className="font-medium">{history.to_val}</span>
                        </>
                      )}
                      {!history.from_val && history.to_val && (
                        <>
                          <span className="font-medium">{history.to_val}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Chưa có lịch sử</p>
          )}
        </CardContent>
      </Card>

      {taskProgress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart2Icon className="h-5 w-5" />
              Tiến độ công việc
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Kế hoạch</p>
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bắt đầu:</span>
                    <span>
                      {taskProgress.planned_start
                        ? format(new Date(taskProgress.planned_start), "dd/MM/yyyy")
                        : "Chưa thiết lập"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kết thúc:</span>
                    <span>
                      {taskProgress.planned_finish
                        ? format(new Date(taskProgress.planned_finish), "dd/MM/yyyy")
                        : "Chưa thiết lập"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Thực tế</p>
                <div className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bắt đầu:</span>
                    <span>
                      {taskProgress.actual_start
                        ? format(new Date(taskProgress.actual_start), "dd/MM/yyyy")
                        : "Chưa bắt đầu"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Kết thúc:</span>
                    <span>
                      {taskProgress.actual_finish
                        ? format(new Date(taskProgress.actual_finish), "dd/MM/yyyy")
                        : "Chưa hoàn thành"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Badge
                variant={
                  taskProgress.status_snapshot === "on_time"
                    ? "default"
                    : taskProgress.status_snapshot === "ahead"
                      ? "outline"
                      : "destructive"
                }
              >
                {taskProgress.status_snapshot === "on_time" && "Đúng tiến độ"}
                {taskProgress.status_snapshot === "ahead" && "Sớm hơn dự kiến"}
                {taskProgress.status_snapshot === "late" && "Trễ tiến độ"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
