"use client"
import React, { useState, useEffect } from 'react'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Edit2, Trash2, Award } from 'lucide-react'
import { toast } from 'sonner'

// Types
interface Skill {
  id: number
  name: string
  field?: string
  description?: string
}

interface UserSkillData {
  user_id: string
  full_name: string
  position?: string
  skills: {
    skill_id: number
    skill_name: string
    completed_tasks_count: number
    total_experience_days: number | null
    last_activity_date: string | null
  }[]
}

function SkillFieldsManagement() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [matrixData, setMatrixData] = useState<UserSkillData[]>([])
  const [loading, setLoading] = useState(true)
  
  // Dialog states
  const [isSkillDialogOpen, setIsSkillDialogOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  
  // Form states
  const [skillForm, setSkillForm] = useState({ name: '', field: '', description: '' })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load skills
      const skillsRes = await fetch('/api/skills')
      const skillsData = await skillsRes.json()
      setSkills(skillsData.data || skillsData.skills || [])
      
      // Load matrix data
      const matrixRes = await fetch('/api/team/skill-matrix')
      if (!matrixRes.ok) {
        throw new Error('Failed to load matrix data')
      }
      const matrixResponse = await matrixRes.json()
      
      // Ensure matrixData is always an array
      const matrixDataArray = Array.isArray(matrixResponse) ? matrixResponse : 
                             Array.isArray(matrixResponse.data) ? matrixResponse.data : []
      
      console.log('Matrix data loaded:', matrixDataArray) // Debug log
      setMatrixData(matrixDataArray)
      
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Không thể tải dữ liệu')
      // Set empty arrays as fallback
      setSkills([])
      setMatrixData([])
    } finally {
      setLoading(false)
    }
  }

  // CRUD Operations for Skills
  const handleSkillSubmit = async () => {
    try {
      const url = editingSkill 
        ? `/api/skills/${editingSkill.id}`
        : '/api/skills'
      
      const res = await fetch(url, {
        method: editingSkill ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: skillForm.name,
          field: skillForm.field,
          description: skillForm.description
        }),
      })
      
      if (!res.ok) throw new Error('Failed to save skill')
      
      toast.success(editingSkill ? 'Cập nhật kỹ năng thành công' : 'Thêm kỹ năng thành công')
      setIsSkillDialogOpen(false)
      setEditingSkill(null)
      setSkillForm({ name: '', field: '', description: '' })
      loadData()
    } catch (error) {
      toast.error('Có lỗi xảy ra')
    }
  }

  const handleSkillDelete = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa kỹ năng này?')) return
    
    try {
      const res = await fetch(`/api/skills/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      
      toast.success('Xóa kỹ năng thành công')
      loadData()
    } catch (error) {
      toast.error('Không thể xóa kỹ năng đang được sử dụng')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-64 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Quản lý Ma trận Kỹ năng</CardTitle>
              <CardDescription>
                Quản lý kỹ năng và theo dõi năng lực của đội ngũ
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="skills" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="skills">Kỹ năng</TabsTrigger>
              <TabsTrigger value="matrix">Ma trận năng lực</TabsTrigger>
            </TabsList>

            {/* Skills Management Tab */}
            <TabsContent value="skills" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Danh sách kỹ năng</h3>
                <Dialog open={isSkillDialogOpen} onOpenChange={setIsSkillDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingSkill(null)
                      setSkillForm({ name: '', field: '', description: '' })
                    }}>
                      <Plus className="mr-2 h-4 w-4" />
                      Thêm kỹ năng
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingSkill ? 'Sửa kỹ năng' : 'Thêm kỹ năng mới'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="skill-name">Tên kỹ năng</Label>
                        <Input
                          id="skill-name"
                          value={skillForm.name}
                          onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
                          placeholder="VD: React, Node.js, AutoCAD..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="skill-field">Lĩnh vực</Label>
                        <Input
                          id="skill-field"
                          value={skillForm.field}
                          onChange={(e) => setSkillForm({ ...skillForm, field: e.target.value })}
                          placeholder="VD: Công nghệ thông tin, Xây dựng..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="skill-desc">Mô tả</Label>
                        <Textarea
                          id="skill-desc"
                          value={skillForm.description}
                          onChange={(e) => setSkillForm({ ...skillForm, description: e.target.value })}
                          placeholder="Mô tả chi tiết về kỹ năng này..."
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsSkillDialogOpen(false)}>
                        Hủy
                      </Button>
                      <Button onClick={handleSkillSubmit}>
                        {editingSkill ? 'Cập nhật' : 'Thêm mới'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kỹ năng</TableHead>
                      <TableHead>Lĩnh vực</TableHead>
                      <TableHead>Mô tả</TableHead>
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {skills.map(skill => (
                      <TableRow key={skill.id}>
                        <TableCell className="font-medium">{skill.name}</TableCell>
                        <TableCell>
                          {skill.field && (
                            <Badge variant="outline">
                              {skill.field}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {skill.description || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingSkill(skill)
                                setSkillForm({
                                  name: skill.name,
                                  field: skill.field || '',
                                  description: skill.description || '',
                                })
                                setIsSkillDialogOpen(true)
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSkillDelete(skill.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Skills Matrix Tab */}
            <TabsContent value="matrix" className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Ma trận năng lực đội ngũ</h3>
                <p className="text-sm text-muted-foreground">
                  Tổng hợp kinh nghiệm dựa trên số lượng công việc đã hoàn thành cho mỗi kỹ năng
                </p>
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background">Nhân sự</TableHead>
                      {skills.map(skill => (
                        <TableHead key={skill.id} className="text-center">
                          <Badge variant="outline">
                            {skill.name}
                          </Badge>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matrixData.map(user => (
                      <TableRow key={user.user_id}>
                        <TableCell className="font-medium sticky left-0 bg-background">
                          <div>
                            <p className="font-medium">{user.full_name}</p>
                            {user.position && (
                              <p className="text-sm text-muted-foreground">{user.position}</p>
                            )}
                          </div>
                        </TableCell>
                        {skills.map(skill => {
                          const userSkill = user.skills.find(s => s.skill_id === skill.id)
                          return (
                            <TableCell key={`${user.user_id}-${skill.id}`} className="text-center">
                              {userSkill ? (
                                <div className="text-sm">
                                  <p className="font-medium">{userSkill.completed_tasks_count} công việc</p>
                                  {userSkill.total_experience_days && (
                                    <p className="text-xs text-muted-foreground">
                                      {userSkill.total_experience_days} ngày kinh nghiệm
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

export default SkillFieldsManagement