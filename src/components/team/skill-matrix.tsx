"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { PlusIcon, SaveIcon, PencilIcon, TrashIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { User, Skill, UserSkill } from "@/app/types/table-types"

export function SkillMatrix() {
  const [users, setUsers] = useState<User[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [userSkills, setUserSkills] = useState<UserSkill[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddSkillOpen, setIsAddSkillOpen] = useState(false)
  const [isEditSkillOpen, setIsEditSkillOpen] = useState(false)
  const [selectedSkills, setSelectedSkills] = useState<number[]>([])
  const [newSkill, setNewSkill] = useState("")
  const [editedSkill, setEditedSkill] = useState<{ id: number; name: string } | null>(null)
  const [editedSkills, setEditedSkills] = useState<Record<string, Record<number, number>>>({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [usersData, skillsData, userSkillsData] = await Promise.all([
        fetch("/api/users").then((res) => res.json()),
        fetch("/api/skills").then((res) => res.json()),
        fetch("/api/user-skills").then((res) => res.json()),
      ])
      setUsers(usersData.users)
      setSkills(skillsData.skills)
      setUserSkills(userSkillsData.userSkills)
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Không thể tải dữ liệu")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSkillLevelChange = (userId: string, skillId: number, level: number) => {
    setEditedSkills((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {}),
        [skillId]: level,
      },
    }))
  }

  const getSkillLevel = (userId: string, skillId: number) => {
    if (editedSkills[userId]?.[skillId] !== undefined) {
      return editedSkills[userId][skillId]
    }
    const userSkill = userSkills.find((us) => us.user_id === userId && us.skill_id === skillId)
    return userSkill ? userSkill.level : 0
  }

  const handleSaveChanges = async () => {
    try {
      const updates = Object.entries(editedSkills).flatMap(([userId, skills]) =>
        Object.entries(skills).map(([skillId, level]) => ({
          user_id: userId,
          skill_id: Number.parseInt(skillId),
          level,
        })),
      )

      const response = await fetch("/api/user-skills", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ updates }),
      })

      if (!response.ok) {
        throw new Error("Không thể cập nhật lĩnh vực")
      }

      const userSkillsData = await fetch("/api/user-skills").then((res) => res.json())
      setUserSkills(userSkillsData.userSkills)
      setEditedSkills({})
      toast.success("Đã cập nhật lĩnh vực thành công")
    } catch (error) {
      toast.error("Lỗi khi cập nhật lĩnh vực", {
        description: error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định",
      })
    }
  }

  const handleAddSkill = async () => {
    if (!newSkill.trim()) {
      toast.error("Tên lĩnh vực không được để trống")
      return
    }

    try {
      const response = await fetch("/api/skills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newSkill }),
      })

      if (!response.ok) {
        throw new Error("Không thể thêm lĩnh vực mới")
      }

      const data = await response.json()
      setSkills([...skills, data.skill])
      setNewSkill("")
      setIsAddSkillOpen(false)
      toast.success("Đã thêm lĩnh vực mới thành công")
    } catch (error) {
      toast.error("Lỗi khi thêm lĩnh vực", {
        description: error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định",
      })
    }
  }

  const handleEditSkill = async () => {
    if (!editedSkill?.name.trim()) {
      toast.error("Tên lĩnh vực không được để trống")
      return
    }

    try {
      const response = await fetch(`/api/skills/${editedSkill.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: editedSkill.name }),
      })

      if (!response.ok) {
        throw new Error("Không thể cập nhật lĩnh vực")
      }

      setSkills(skills.map(skill => 
        skill.id === editedSkill.id ? { ...skill, name: editedSkill.name } : skill
      ))
      setEditedSkill(null)
      setIsEditSkillOpen(false)
      toast.success("Đã cập nhật lĩnh vực thành công")
    } catch (error) {
      toast.error("Lỗi khi cập nhật lĩnh vực", {
        description: error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định",
      })
    }
  }

  const handleDeleteSkills = async () => {
    if (selectedSkills.length === 0) {
      toast.error("Vui lòng chọn ít nhất một lĩnh vực để xóa")
      return
    }

    try {
      const response = await fetch("/api/skills", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ skillIds: selectedSkills }),
      })

      if (!response.ok) {
        throw new Error("Không thể xóa lĩnh vực")
      }

      setSkills(skills.filter(skill => !selectedSkills.includes(skill.id)))
      setSelectedSkills([])
      toast.success("Đã xóa lĩnh vực thành công")
    } catch (error) {
      toast.error("Lỗi khi xóa lĩnh vực", {
        description: error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định",
      })
    }
  }

  const handleSkillSelect = (skillId: number) => {
    setSelectedSkills(prev => 
      prev.includes(skillId) 
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    )
  }

  if (isLoading) {
    return <div className="flex justify-center p-8">Đang tải dữ liệu...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Ma Trận Lĩnh Vực</h2>
        <div className="flex gap-2">
          <Dialog open={isAddSkillOpen} onOpenChange={setIsAddSkillOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusIcon className="h-4 w-4 mr-2" />
                Thêm Lĩnh Vực
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Thêm Lĩnh Vực Mới</DialogTitle>
                <DialogDescription>Nhập tên lĩnh vực mới để thêm vào hệ thống.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="skill-name">Tên lĩnh vực</Label>
                <Input
                  id="skill-name"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  placeholder="Ví dụ: Phát triển phần mềm"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddSkillOpen(false)}>
                  Hủy
                </Button>
                <Button onClick={handleAddSkill}>Thêm lĩnh vực</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditSkillOpen} onOpenChange={setIsEditSkillOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                disabled={selectedSkills.length !== 1}
                onClick={() => {
                  const skill = skills.find(s => s.id === selectedSkills[0])
                  if (skill) {
                    setEditedSkill({ id: skill.id, name: skill.name })
                  }
                }}
              >
                <PencilIcon className="h-4 w-4 mr-2" />
                Sửa Lĩnh Vực
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Sửa Lĩnh Vực</DialogTitle>
                <DialogDescription>Chỉnh sửa tên lĩnh vực đã chọn.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="edit-skill-name">Tên lĩnh vực</Label>
                <Input
                  id="edit-skill-name"
                  value={editedSkill?.name || ""}
                  onChange={(e) => setEditedSkill(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="Nhập tên lĩnh vực mới"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditSkillOpen(false)}>
                  Hủy
                </Button>
                <Button onClick={handleEditSkill}>Lưu thay đổi</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button 
            variant="outline" 
            size="sm"
            onClick={handleDeleteSkills}
            disabled={selectedSkills.length === 0}
          >
            <TrashIcon className="h-4 w-4 mr-2" />
            Xóa Lĩnh Vực
          </Button>

          <Button onClick={handleSaveChanges} disabled={Object.keys(editedSkills).length === 0}>
            <SaveIcon className="h-4 w-4 mr-2" />
            Lưu Thay Đổi
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-hidden">
        <div className="overflow-auto max-h-[600px] max-w-full">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="min-w-[200px] sticky left-0 bg-background z-20 border-r">Nhân Sự</TableHead>
                {skills.map((skill) => (
                  <TableHead key={skill.id} className="text-center min-w-[120px]">
                    <div className="flex items-center justify-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedSkills.includes(skill.id)}
                        onChange={() => handleSkillSelect(skill.id)}
                        className="h-4 w-4"
                      />
                      <span className="truncate" title={skill.name}>{skill.name}</span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium sticky left-0 bg-background z-10 border-r min-w-[200px]">
                    <span className="truncate" title={user.full_name}>{user.full_name}</span>
                  </TableCell>
                  {skills.map((skill) => (
                    <TableCell key={skill.id} className="text-center min-w-[120px]">
                      <select
                        className="w-12 h-8 rounded border text-center"
                        value={getSkillLevel(user.id, skill.id)}
                        onChange={(e) => handleSkillLevelChange(user.id, skill.id, Number.parseInt(e.target.value))}
                      >
                        <option value="0">-</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5</option>
                      </select>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="text-sm text-gray-500">
        <p>Mức độ lĩnh vực: 1 - Cơ bản, 2 - Trung cấp, 3 - Khá, 4 - Thành thạo, 5 - Chuyên gia</p>
      </div>
    </div>
  )
}
