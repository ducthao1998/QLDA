"use client"
import React, { useState, useEffect, useMemo } from 'react'
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
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Plus, Edit2, Trash2, BarChart3, ChevronRight, Search } from 'lucide-react'
import { toast } from 'sonner'

// ──────── Types ────────
interface Skill {
  id: number
  name: string
  field?: string
}

interface UserSkillRow {
  skill_id: number
  skill_name: string
  skill_field: string | null
  experience_days: number
  last_activity_date: string | null
  score: number          // 0..1 combined
  base_score: number
  recency_weight: number
  quality_weight: number
}

interface UserSkillProfile {
  user_id: string
  full_name: string
  position: string | null
  org_unit: string | null
  max_concurrent_tasks: number
  skills: UserSkillRow[]
  top_skills: Array<{ skill_id: number; skill_name: string; score: number }>
  expert_score: number
}

// ──────── Helpers ────────

/** Map a 0..1 score to a Tailwind background class so the heatmap reads at a glance. */
function scoreToCellClass(score: number): string {
  if (score <= 0) return 'bg-muted/30 text-muted-foreground'
  if (score < 0.2) return 'bg-emerald-50 text-emerald-900'
  if (score < 0.4) return 'bg-emerald-100 text-emerald-900'
  if (score < 0.6) return 'bg-emerald-300 text-emerald-950'
  if (score < 0.8) return 'bg-emerald-500 text-white'
  return 'bg-emerald-700 text-white'
}

function scoreLabel(score: number): string {
  if (score <= 0) return 'Chưa có'
  if (score < 0.2) return 'Mới biết'
  if (score < 0.4) return 'Cơ bản'
  if (score < 0.6) return 'Khá'
  if (score < 0.8) return 'Tốt'
  return 'Chuyên gia'
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Chưa có hoạt động'
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
  if (days <= 1) return 'Hôm nay'
  if (days < 30) return `${days} ngày trước`
  if (days < 365) return `${Math.round(days / 30)} tháng trước`
  return `${Math.round(days / 365)} năm trước`
}

// ──────────────────────────────────────────────────────────────────────

function SkillFieldsManagement() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [profiles, setProfiles] = useState<UserSkillProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserSkillProfile | null>(null)

  // Skill CRUD dialog state
  const [isSkillDialogOpen, setIsSkillDialogOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [skillForm, setSkillForm] = useState({ name: '', field: '' })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      const [skillsRes, matrixRes] = await Promise.all([
        fetch('/api/skills'),
        fetch('/api/team/skill-matrix'),
      ])

      if (!skillsRes.ok) throw new Error('Failed to load skills')
      if (!matrixRes.ok) throw new Error('Failed to load skill matrix')

      const skillsData = await skillsRes.json()
      const matrixData = await matrixRes.json()

      setSkills(skillsData.data || skillsData.skills || [])
      setProfiles(matrixData.users || [])
    } catch (err) {
      console.error('Error loading data:', err)
      toast.error('Không thể tải dữ liệu')
      setSkills([])
      setProfiles([])
    } finally {
      setLoading(false)
    }
  }

  const handleSkillSubmit = async () => {
    try {
      const url = editingSkill ? `/api/skills/${editingSkill.id}` : '/api/skills'
      const res = await fetch(url, {
        method: editingSkill ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: skillForm.name, field: skillForm.field }),
      })
      if (!res.ok) throw new Error('Failed to save skill')
      toast.success(editingSkill ? 'Cập nhật kỹ năng thành công' : 'Thêm kỹ năng thành công')
      setIsSkillDialogOpen(false)
      setEditingSkill(null)
      setSkillForm({ name: '', field: '' })
      loadData()
    } catch {
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
    } catch {
      toast.error('Không thể xóa kỹ năng đang được sử dụng')
    }
  }

  // Derived: sorted profiles by expert_score desc, filtered by search
  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return profiles
      .filter((p) => !q || p.full_name.toLowerCase().includes(q) || (p.position || '').toLowerCase().includes(q))
      .sort((a, b) => b.expert_score - a.expert_score)
  }, [profiles, searchQuery])

  // Build a lookup: user_id -> skill_id -> score for the heatmap
  const heatmapLookup = useMemo(() => {
    const map = new Map<string, Map<number, UserSkillRow>>()
    for (const p of profiles) {
      const inner = new Map<number, UserSkillRow>()
      for (const s of p.skills) inner.set(s.skill_id, s)
      map.set(p.user_id, inner)
    }
    return map
  }, [profiles])

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
          <CardTitle>Năng lực & Ma trận kỹ năng</CardTitle>
          <CardDescription>
            Hiển thị kinh nghiệm thực tế của từng người: số giờ làm việc, độ tươi mới và chất lượng giao việc.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="matrix" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="matrix">Heatmap năng lực</TabsTrigger>
              <TabsTrigger value="ranking">Bảng xếp hạng</TabsTrigger>
              <TabsTrigger value="skills">Quản lý kỹ năng</TabsTrigger>
            </TabsList>

            {/* ────────── HEATMAP ────────── */}
            <TabsContent value="matrix" className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên hoặc chức vụ..."
                    className="pl-9"
                  />
                </div>
                <div className="text-xs text-muted-foreground ml-auto flex items-center gap-3">
                  <span>Mức điểm:</span>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded bg-emerald-50 border" /> <span>Mới biết</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded bg-emerald-300" /> <span>Khá</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded bg-emerald-500" /> <span>Tốt</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded bg-emerald-700" /> <span>Chuyên gia</span>
                  </div>
                </div>
              </div>

              <TooltipProvider delayDuration={150}>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background z-10 w-[220px]">
                          Nhân sự
                        </TableHead>
                        {skills.map((skill) => (
                          <TableHead key={skill.id} className="text-center min-w-[110px]">
                            <div className="space-y-1">
                              <div className="text-xs font-medium leading-tight">{skill.name}</div>
                              {skill.field && (
                                <Badge variant="outline" className="text-[10px] font-normal">
                                  {skill.field}
                                </Badge>
                              )}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProfiles.map((profile) => (
                        <TableRow key={profile.user_id}>
                          <TableCell className="sticky left-0 bg-background z-10 align-top">
                            <button
                              type="button"
                              className="text-left group w-full"
                              onClick={() => setSelectedUser(profile)}
                            >
                              <div className="font-medium group-hover:text-blue-600 transition-colors flex items-center gap-1">
                                {profile.full_name}
                                <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
                              </div>
                              {profile.position && (
                                <div className="text-xs text-muted-foreground">{profile.position}</div>
                              )}
                              <div className="text-xs text-emerald-700 mt-0.5">
                                Điểm tổng: {(profile.expert_score * 100).toFixed(0)}%
                              </div>
                            </button>
                          </TableCell>
                          {skills.map((skill) => {
                            const row = heatmapLookup.get(profile.user_id)?.get(skill.id)
                            const score = row?.score ?? 0
                            return (
                              <TableCell key={`${profile.user_id}-${skill.id}`} className="text-center p-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={`rounded-md px-2 py-1.5 text-xs font-medium cursor-help transition-all hover:scale-105 ${scoreToCellClass(score)}`}
                                    >
                                      {score > 0 ? `${Math.round(score * 100)}%` : '—'}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <div className="space-y-1 text-xs">
                                      <div className="font-semibold">{skill.name}</div>
                                      {row ? (
                                        <>
                                          <div>
                                            Mức:{' '}
                                            <span className="font-medium text-emerald-700">{scoreLabel(score)}</span>{' '}
                                            ({Math.round(score * 100)}%)
                                          </div>
                                          <div>Kinh nghiệm: {row.experience_days} ngày làm việc</div>
                                          <div>Hoạt động cuối: {relativeTime(row.last_activity_date)}</div>
                                          <div className="border-t pt-1 mt-1 text-muted-foreground">
                                            Nền: {Math.round(row.base_score * 100)}% × Tươi:{' '}
                                            {Math.round(row.recency_weight * 100)}% × Chất lượng:{' '}
                                            {Math.round(row.quality_weight * 100)}%
                                          </div>
                                        </>
                                      ) : (
                                        <div className="text-muted-foreground">Chưa có dữ liệu kinh nghiệm</div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                      {filteredProfiles.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={skills.length + 1} className="text-center py-8 text-muted-foreground">
                            Không tìm thấy nhân sự phù hợp
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TooltipProvider>
            </TabsContent>

            {/* ────────── RANKING ────────── */}
            <TabsContent value="ranking" className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Xếp hạng theo điểm trung bình của <b>3 kỹ năng mạnh nhất</b> mỗi người.
              </div>
              <div className="space-y-2">
                {filteredProfiles.map((profile, idx) => (
                  <div
                    key={profile.user_id}
                    className="border rounded-lg p-4 hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedUser(profile)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-bold w-8 text-center">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-semibold">{profile.full_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {profile.position}
                            {profile.org_unit && ` · ${profile.org_unit}`}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-emerald-700">
                          {(profile.expert_score * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Điểm tổng</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {profile.top_skills.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Chưa có kinh nghiệm nào được ghi nhận</span>
                      ) : (
                        profile.top_skills.map((s) => (
                          <Badge key={s.skill_id} variant="secondary" className="text-xs">
                            {s.skill_name} · {Math.round(s.score * 100)}%
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ────────── SKILL CRUD ────────── */}
            <TabsContent value="skills" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Danh sách kỹ năng</h3>
                <Dialog open={isSkillDialogOpen} onOpenChange={setIsSkillDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setEditingSkill(null); setSkillForm({ name: '', field: '' }) }}>
                      <Plus className="mr-2 h-4 w-4" /> Thêm kỹ năng
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingSkill ? 'Sửa kỹ năng' : 'Thêm kỹ năng mới'}</DialogTitle>
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
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsSkillDialogOpen(false)}>Hủy</Button>
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
                      <TableHead className="text-right">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {skills.map((skill) => (
                      <TableRow key={skill.id}>
                        <TableCell className="font-medium">{skill.name}</TableCell>
                        <TableCell>
                          {skill.field && <Badge variant="outline">{skill.field}</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingSkill(skill)
                                setSkillForm({ name: skill.name, field: skill.field || '' })
                                setIsSkillDialogOpen(true)
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleSkillDelete(skill.id)}>
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
          </Tabs>
        </CardContent>
      </Card>

      {/* ────────── PER-USER DETAIL DIALOG ────────── */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedUser && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-emerald-600" />
                  Hồ sơ năng lực: {selectedUser.full_name}
                </DialogTitle>
                <DialogDescription>
                  {selectedUser.position}
                  {selectedUser.org_unit && ` · ${selectedUser.org_unit}`}
                  {' · '}
                  <span className="font-medium text-emerald-700">
                    Điểm tổng {(selectedUser.expert_score * 100).toFixed(0)}%
                  </span>
                </DialogDescription>
              </DialogHeader>

              {selectedUser.skills.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  Chưa có dữ liệu kinh nghiệm. Worklog sẽ tự động cập nhật khi nhân sự log giờ làm việc.
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium mb-2">Top kỹ năng mạnh nhất</div>
                    <div className="space-y-2">
                      {[...selectedUser.skills]
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 5)
                        .map((s) => (
                          <div key={s.skill_id}>
                            <div className="flex justify-between text-xs mb-0.5">
                              <span>{s.skill_name}</span>
                              <span className="font-medium">{Math.round(s.score * 100)}% · {scoreLabel(s.score)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${Math.max(2, s.score * 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium mb-2">
                      Tất cả kỹ năng đã có kinh nghiệm ({selectedUser.skills.length})
                    </div>
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Kỹ năng</TableHead>
                            <TableHead className="text-right">Giờ thật</TableHead>
                            <TableHead>Hoạt động cuối</TableHead>
                            <TableHead className="text-right">Nền</TableHead>
                            <TableHead className="text-right">Tươi</TableHead>
                            <TableHead className="text-right">Chất lượng</TableHead>
                            <TableHead className="text-right">Tổng</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...selectedUser.skills]
                            .sort((a, b) => b.score - a.score)
                            .map((s) => (
                              <TableRow key={s.skill_id}>
                                <TableCell>
                                  <div className="font-medium text-xs">{s.skill_name}</div>
                                  {s.skill_field && (
                                    <div className="text-[10px] text-muted-foreground">{s.skill_field}</div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {s.experience_days} ngày
                                </TableCell>
                                <TableCell className="text-xs">
                                  {relativeTime(s.last_activity_date)}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {Math.round(s.base_score * 100)}%
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {Math.round(s.recency_weight * 100)}%
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  {Math.round(s.quality_weight * 100)}%
                                </TableCell>
                                <TableCell
                                  className={`text-right text-xs font-semibold ${scoreToCellClass(s.score)} rounded`}
                                >
                                  {Math.round(s.score * 100)}%
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-md">
                    <strong>Cách tính điểm:</strong> Điểm tổng = Nền (theo số giờ làm) × Tươi (theo
                    thời gian gần nhất, half-life 12 tháng) × Chất lượng (theo tỉ lệ đúng hạn).
                    Đây là dữ liệu thực tế từ worklog và task_progress, không phải tự khai.
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SkillFieldsManagement
