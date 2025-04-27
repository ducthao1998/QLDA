"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { PlusIcon, SaveIcon } from "lucide-react"
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
  const [newSkill, setNewSkill] = useState("")
  const [editedSkills, setEditedSkills] = useState<Record<string, Record<number, number>>>({})

  useEffect(() => {
    // Fetch users, skills, and user skills
    Promise.all([
      fetch("/api/users").then((res) => res.json()),
      fetch("/api/skills").then((res) => res.json()),
      fetch("/api/user-skills").then((res) => res.json()),
    ])
      .then(([usersData, skillsData, userSkillsData]) => {
        setUsers(usersData.users)
        setSkills(skillsData.skills)
        setUserSkills(userSkillsData.userSkills)
        setIsLoading(false)
      })
      .catch((error) => {
        console.error("Error fetching data:", error)
        toast.error("Không thể tải dữ liệu")
        setIsLoading(false)
      })
  }, [])

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
    // Check if this skill level has been edited
    if (editedSkills[userId]?.[skillId] !== undefined) {
      return editedSkills[userId][skillId]
    }

    // Otherwise return the original skill level
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
        throw new Error("Không thể cập nhật kỹ năng")
      }

      // Refresh user skills
      const userSkillsData = await fetch("/api/user-skills").then((res) => res.json())
      setUserSkills(userSkillsData.userSkills)
      setEditedSkills({})
      toast.success("Đã cập nhật kỹ năng thành công")
    } catch (error) {
      toast.error("Lỗi khi cập nhật kỹ năng", {
        description: error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định",
      })
    }
  }

  const handleAddSkill = async () => {
    if (!newSkill.trim()) {
      toast.error("Tên kỹ năng không được để trống")
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
        throw new Error("Không thể thêm kỹ năng mới")
      }

      const data = await response.json()
      setSkills([...skills, data.skill])
      setNewSkill("")
      setIsAddSkillOpen(false)
      toast.success("Đã thêm kỹ năng mới thành công")
    } catch (error) {
      toast.error("Lỗi khi thêm kỹ năng", {
        description: error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định",
      })
    }
  }

  if (isLoading) {
    return <div className="flex justify-center p-8">Đang tải dữ liệu...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Ma Trận Kỹ Năng</h2>
        <div className="flex gap-2">
          <Dialog open={isAddSkillOpen} onOpenChange={setIsAddSkillOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusIcon className="h-4 w-4 mr-2" />
                Thêm Kỹ Năng
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Thêm Kỹ Năng Mới</DialogTitle>
                <DialogDescription>Nhập tên kỹ năng mới để thêm vào hệ thống.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="skill-name">Tên kỹ năng</Label>
                <Input
                  id="skill-name"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  placeholder="Ví dụ: Lập trình Java"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddSkillOpen(false)}>
                  Hủy
                </Button>
                <Button onClick={handleAddSkill}>Thêm kỹ năng</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={handleSaveChanges} disabled={Object.keys(editedSkills).length === 0}>
            <SaveIcon className="h-4 w-4 mr-2" />
            Lưu Thay Đổi
          </Button>
        </div>
      </div>

      <div className="border rounded-md overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Nhân Sự</TableHead>
              {skills.map((skill) => (
                <TableHead key={skill.id} className="text-center">
                  {skill.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name}</TableCell>
                {skills.map((skill) => (
                  <TableCell key={skill.id} className="text-center">
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
      <div className="text-sm text-gray-500">
        <p>Mức độ kỹ năng: 1 - Cơ bản, 2 - Trung cấp, 3 - Khá, 4 - Thành thạo, 5 - Chuyên gia</p>
      </div>
    </div>
  )
}
