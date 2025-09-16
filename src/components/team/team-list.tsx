"use client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreHorizontalIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { AddUserDialog } from "./add-user-dialog"
import { EditUserDialog, type EditUserData } from "./edit-user-dialog"

interface TeamMember {
  id: string
  full_name: string
  position: string
  org_unit: string
  email: string
  phone_number?: string
}

export function TeamList() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<EditUserData | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      
      if (data.error) {
        throw new Error(data.error)
      }
      
      setTeamMembers(data.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTeamMembers()
  }, [])

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên</TableHead>
              <TableHead>Chức Vụ</TableHead>
              <TableHead>Đơn Vị</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Số giờ làm việc</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-[120px]" />
                  </div>
                </TableCell>
                <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-[150px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-[30px]" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border p-4 text-center text-red-500">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <AddUserDialog onUserAdded={fetchTeamMembers} />
      </div>
      <EditUserDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        user={editingUser}
        onUpdated={fetchTeamMembers}
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên</TableHead>
              <TableHead>Chức Vụ</TableHead>
              <TableHead>Đơn Vị</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamMembers.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={`/placeholder.svg?height=32&width=32`} alt={member.full_name} />
                      <AvatarFallback>{member.full_name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <span>{member.full_name}</span>
                  </div>
                </TableCell>
                <TableCell>{member.position}</TableCell>
                <TableCell>{member.org_unit}</TableCell>
                <TableCell>{member.email}</TableCell>
              
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontalIcon className="h-4 w-4" />
                        <span className="sr-only">Mở menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Hành động</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>Xem hồ sơ</DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault()
                          setEditingUser({
                            id: member.id,
                            full_name: member.full_name,
                            email: member.email,
                            position: member.position,
                            org_unit: member.org_unit,
                          })
                          setIsEditOpen(true)
                        }}
                      >
                        Chỉnh sửa thông tin
                      </DropdownMenuItem>
                      <DropdownMenuItem>Xem nhiệm vụ được giao</DropdownMenuItem>
                      <DropdownMenuItem>Xem dự án tham gia</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">Vô hiệu hóa</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
