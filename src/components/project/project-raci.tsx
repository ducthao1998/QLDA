"use client"

import { useState, useEffect } from "react"
import { PlusIcon, UserIcon, BuildingIcon, CheckIcon, CircleIcon, InfoIcon, HelpCircleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Label } from "@/components/ui/label"

const raciRoles = {
  responsible: {
    label: "Responsible (R)",
    description: "Người thực hiện công việc",
    icon: <CheckIcon className="h-4 w-4 text-green-600" />,
  },
  accountable: {
    label: "Accountable (A)",
    description: "Người chịu trách nhiệm cuối cùng",
    icon: <CircleIcon className="h-4 w-4 text-red-600" />,
  },
  consulted: {
    label: "Consulted (C)",
    description: "Người được tham vấn trước khi quyết định",
    icon: <HelpCircleIcon className="h-4 w-4 text-blue-600" />,
  },
  informed: {
    label: "Informed (I)",
    description: "Người được thông báo sau khi quyết định",
    icon: <InfoIcon className="h-4 w-4 text-gray-600" />,
  },
}

export function ProjectRaci({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [externalOrgs, setExternalOrgs] = useState<any[]>([])
  const [raciMatrix, setRaciMatrix] = useState<any[]>([])
  const [isAddingRaci, setIsAddingRaci] = useState(false)
  const [newRaci, setNewRaci] = useState({
    task_id: "",
    user_id: "",
    external_org_id: "",
    role: "responsible",
  })
  useEffect(() => {
    fetchData()
  }, [projectId])

  async function fetchData() {
    try {
      setLoading(true)

      // Fetch tasks
      const tasksResponse = await fetch(`/api/projects/${projectId}/tasks`)
      if (!tasksResponse.ok) {
        throw new Error("Không thể tải danh sách nhiệm vụ")
      }
      const tasksData = await tasksResponse.json()
      setTasks(tasksData.tasks || [])

      // Fetch users
      const usersResponse = await fetch(`/api/users`)
      if (!usersResponse.ok) {
        throw new Error("Không thể tải danh sách người dùng")
      }
      const usersData = await usersResponse.json()
      setUsers(usersData.users || [])

      // Fetch external orgs
      const orgsResponse = await fetch(`/api/external-orgs`)
      if (!orgsResponse.ok) {
        throw new Error("Không thể tải danh sách tổ chức ngoài")
      }
      const orgsData = await orgsResponse.json()
      setExternalOrgs(orgsData.organizations || [])

      // Fetch RACI matrix
      const raciResponse = await fetch(`/api/projects/${projectId}/raci`)
      if (!raciResponse.ok) {
        throw new Error("Không thể tải ma trận RACI")
      }
      const raciData = await raciResponse.json()
      setRaciMatrix(raciData.raci || [])
    } catch (error) {
      console.error("Lỗi khi tải dữ liệu:", error)
      toast.error("Lỗi",{
        description: "Không thể tải dữ liệu ma trận RACI",
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleAddRaci() {
    try {
      setIsAddingRaci(true)

      // Validate
      if (!newRaci.task_id) {
        throw new Error("Vui lòng chọn nhiệm vụ")
      }

      if (!newRaci.user_id && !newRaci.external_org_id) {
        throw new Error("Vui lòng chọn người dùng hoặc tổ chức ngoài")
      }

      const response = await fetch(`/api/projects/${projectId}/raci`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newRaci),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Có lỗi xảy ra khi thêm RACI")
      }

      toast("Thêm RACI thành công",{
        description: "Đã cập nhật ma trận RACI",
      })
      // Reset form
      setNewRaci({
        task_id: "",
        user_id: "",
        external_org_id: "",
        role: "responsible",
      })

      // Refresh data
      fetchData()
    } catch (error) {
      console.error("Lỗi:", error)
      toast.error("Lỗi",{
        description: error instanceof Error ? error.message : "Có lỗi xảy ra khi thêm RACI",
      })
    } finally {
      setIsAddingRaci(false)
    }
  }

  function getRaciForTaskAndEntity(taskId: string, userId: string | null, orgId: string | null) {
    return raciMatrix.find(
      (raci) =>
        raci.task_id === taskId && ((userId && raci.user_id === userId) || (orgId && raci.external_org_id === orgId)),
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Ma trận RACI</h2>
          <Skeleton className="h-10 w-[150px]" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/3 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Ma trận RACI</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              Thêm RACI
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Thêm phân công RACI</DialogTitle>
              <DialogDescription>Phân công trách nhiệm cho nhiệm vụ theo mô hình RACI</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="task">Nhiệm vụ</Label>
                <Select value={newRaci.task_id} onValueChange={(value) => setNewRaci({ ...newRaci, task_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn nhiệm vụ" />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="role">Vai trò RACI</Label>
                <Select value={newRaci.role} onValueChange={(value) => setNewRaci({ ...newRaci, role: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn vai trò" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="responsible">Responsible (R)</SelectItem>
                    <SelectItem value="accountable">Accountable (A)</SelectItem>
                    <SelectItem value="consulted">Consulted (C)</SelectItem>
                    <SelectItem value="informed">Informed (I)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Gán cho</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="user" className="text-xs">
                      Người dùng nội bộ
                    </Label>
                    <Select
                      value={newRaci.user_id}
                      onValueChange={(value) => setNewRaci({ ...newRaci, user_id: value, external_org_id: "" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn người dùng" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Không chọn</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="org" className="text-xs">
                      Tổ chức ngoài
                    </Label>
                    <Select
                      value={newRaci.external_org_id}
                      onValueChange={(value) => setNewRaci({ ...newRaci, external_org_id: value, user_id: "" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn tổ chức" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Không chọn</SelectItem>
                        {externalOrgs.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleAddRaci}
                disabled={isAddingRaci || !newRaci.task_id || (!newRaci.user_id && !newRaci.external_org_id)}
              >
                {isAddingRaci ? "Đang thêm..." : "Thêm RACI"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ma trận trách nhiệm RACI</CardTitle>
          <CardDescription>Phân công trách nhiệm cho các nhiệm vụ trong dự án</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-6 mb-4">
            {Object.entries(raciRoles).map(([key, value]) => (
              <TooltipProvider key={key}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center space-x-1">
                      {value.icon}
                      <span className="text-sm font-medium">{value.label}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{value.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>

          {tasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Chưa có nhiệm vụ nào trong dự án này</p>
              <Button
                variant="outline"
                onClick={() => (window.location.href = `/dashboard/projects/${projectId}?tab=tasks`)}
              >
                Thêm nhiệm vụ trước
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Nhiệm vụ</TableHead>
                    <TableHead>Người dùng / Tổ chức</TableHead>
                    <TableHead>Vai trò</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {raciMatrix.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-muted-foreground">
                        Chưa có phân công RACI nào. Hãy thêm phân công mới.
                      </TableCell>
                    </TableRow>
                  ) : (
                    raciMatrix.map((raci) => {
                      const task = tasks.find((t) => t.id === raci.task_id)
                      const user = users.find((u) => u.id === raci.user_id)
                      const org = externalOrgs.find((o) => o.id === raci.external_org_id)
                      const roleInfo = raciRoles[raci.role as keyof typeof raciRoles]

                      return (
                        <TableRow key={raci.id}>
                          <TableCell className="font-medium">{task?.name || "Không xác định"}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              {user ? (
                                <>
                                  <UserIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                                  <span>{user.full_name}</span>
                                </>
                              ) : org ? (
                                <>
                                  <BuildingIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                                  <span>{org.name}</span>
                                </>
                              ) : (
                                "Không xác định"
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              {roleInfo?.icon}
                              <span className="ml-2">{roleInfo?.label || raci.role}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
