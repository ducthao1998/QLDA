'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { GitBranch, ArrowRight, Circle, CheckCircle, Clock, AlertCircle, Archive, Pause, Layers } from 'lucide-react'

interface TreeNode {
  id: string
  name: string
  status: string
  duration_days: number
  level: number
  indexInLevel: number
  totalInLevel: number
  dependencies: string[]
  dependents: string[]
}

interface TreeEdge {
  from: string
  to: string
  type: string
}

interface DependencyTree {
  nodes: TreeNode[]
  edges: TreeEdge[]
  levels: string[][]
  maxLevel: number
}

interface DependencyTreeVisualizationProps {
  projectId: string
  currentTaskId?: string
  className?: string
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'done':
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-600" />
    case 'in_progress':
      return <Clock className="h-4 w-4 text-blue-600" />
    case 'review':
      return <AlertCircle className="h-4 w-4 text-yellow-600" />
    case 'blocked':
      return <Pause className="h-4 w-4 text-red-600" />
    case 'archived':
      return <Archive className="h-4 w-4 text-gray-600" />
    default:
      return <Circle className="h-4 w-4 text-gray-400" />
  }
}

const getNodeColors = (status: string, isCurrentTask: boolean) => {
  if (isCurrentTask) {
    return {
      fill: '#3b82f6',
      stroke: '#2563eb',
      text: 'white'
    }
  }
  
  switch (status) {
    case 'done':
    case 'completed':
      return {
        fill: '#f0fdf4',
        stroke: '#16a34a',
        text: '#15803d'
      }
    case 'in_progress':
      return {
        fill: '#eff6ff',
        stroke: '#3b82f6',
        text: '#1d4ed8'
      }
    case 'review':
      return {
        fill: '#fffbeb',
        stroke: '#f59e0b',
        text: '#d97706'
      }
    case 'blocked':
      return {
        fill: '#fef2f2',
        stroke: '#ef4444',
        text: '#dc2626'
      }
    case 'archived':
      return {
        fill: '#f8fafc',
        stroke: '#64748b',
        text: '#475569'
      }
    default:
      return {
        fill: '#ffffff',
        stroke: '#e2e8f0',
        text: '#334155'
      }
  }
}

const getStatusText = (status: string) => {
  switch (status) {
    case 'done':
    case 'completed':
      return 'Hoàn thành'
    case 'in_progress':
      return 'Đang thực hiện'
    case 'review':
      return 'Đang xem xét'
    case 'blocked':
      return 'Bị chặn'
    case 'archived':
      return 'Lưu trữ'
    case 'todo':
      return 'Chưa bắt đầu'
    default:
      return status
  }
}

export function DependencyTreeVisualization({ 
  projectId, 
  currentTaskId, 
  className = '' 
}: DependencyTreeVisualizationProps) {
  const [tree, setTree] = useState<DependencyTree | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDependencyTree()
  }, [projectId])

  const loadDependencyTree = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/projects/${projectId}/dependency-tree`)
      
      if (!response.ok) {
        throw new Error('Không thể tải dependency tree')
      }
      const data = await response.json()
      setTree(data.tree)
    } catch (err: any) {
      console.error('Error loading dependency tree:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Biểu đồ phụ thuộc công việc
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error || !tree) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Biểu đồ phụ thuộc công việc
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>{error || 'Không có dữ liệu dependency tree'}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Filter nodes with dependencies
  const filteredNodes = tree.nodes.filter(node => 
    node.dependencies.length > 0 || node.dependents.length > 0
  )
  
  const filteredEdges = tree.edges.filter(edge =>
    filteredNodes.some(node => node.id === edge.from) &&
    filteredNodes.some(node => node.id === edge.to)
  )

  if (filteredNodes.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Biểu đồ phụ thuộc công việc
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <GitBranch className="h-8 w-8 mx-auto mb-2" />
            <p>Chưa có công việc nào có phụ thuộc trong dự án</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Compact layout calculations - giảm khoảng cách tối đa
  const nodeWidth = 160
  const nodeHeight = 60
  const levelGap = 80
  const nodeGap = 12  // Giảm từ 24 xuống 12
  const leftPadding = 60
  const topPadding = 40
  const rightPadding = 20
  const bottomPadding = 20

  // Tính toán width dựa trên số nodes thực tế trong mỗi level
  const levelWidths = tree.levels.map(level => {
    const nodesInLevel = level.filter(nodeId => 
      filteredNodes.some(node => node.id === nodeId)
    ).length
    return nodesInLevel * nodeWidth + (nodesInLevel - 1) * nodeGap
  })
  
  const maxLevelWidth = Math.max(...levelWidths)
  const svgWidth = leftPadding + maxLevelWidth + rightPadding
  const svgHeight = topPadding + (tree.maxLevel + 1) * (nodeHeight + levelGap) + bottomPadding

  // Calculate node positions với spacing tối ưu
  const nodePositions = new Map<string, { x: number, y: number }>()
  
  // Tạo map level thực tế chỉ chứa filtered nodes
  const actualLevels = tree.levels.map(level => 
    level.filter(nodeId => filteredNodes.some(node => node.id === nodeId))
  )

  filteredNodes.forEach(node => {
    const actualLevel = actualLevels[node.level]
    const actualIndexInLevel = actualLevel.indexOf(node.id)
    const actualTotalInLevel = actualLevel.length
    
    if (actualIndexInLevel === -1) return
    
    const levelWidth = actualTotalInLevel * nodeWidth + (actualTotalInLevel - 1) * nodeGap
    const levelStartX = leftPadding + (maxLevelWidth - levelWidth) / 2
    const x = levelStartX + actualIndexInLevel * (nodeWidth + nodeGap)
    const y = topPadding + node.level * (nodeHeight + levelGap)
    
    nodePositions.set(node.id, { x, y })
  })

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Biểu đồ phụ thuộc công việc
        </CardTitle>
        <CardDescription>
          Sơ đồ hiển thị mối quan hệ phụ thuộc giữa các công việc trong dự án.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-auto border rounded-lg bg-white">
          <svg
            width={svgWidth}
            height={svgHeight}
            className="min-w-full"
          >
            <defs>
              {/* Arrow marker */}
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <path
                  d="M0,0 L0,6 L8,3 z"
                  fill="#64748b"
                />
              </marker>
            </defs>

            {/* Level labels - compact */}
            {actualLevels.map((level, index) => {
              if (level.length === 0) return null
              return (
                <text
                  key={`level-${index}`}
                  x={20}
                  y={topPadding + index * (nodeHeight + levelGap) + nodeHeight / 2}
                  className="text-xs font-medium fill-gray-500"
                  dominantBaseline="middle"
                >
                  L{index}
                </text>
              )
            })}

            {/* Dependency edges */}
            {filteredEdges.map((edge, index) => {
              const fromPos = nodePositions.get(edge.from)
              const toPos = nodePositions.get(edge.to)
              
              if (!fromPos || !toPos) return null

              const fromX = fromPos.x + nodeWidth / 2
              const fromY = fromPos.y + nodeHeight
              const toX = toPos.x + nodeWidth / 2
              const toY = toPos.y

              // Simple curved path
              const midY = fromY + (toY - fromY) / 2
              const pathData = `M ${fromX} ${fromY} Q ${fromX} ${midY} ${toX} ${toY}`

              return (
                <path
                  key={`edge-${index}`}
                  d={pathData}
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="1.5"
                  markerEnd="url(#arrowhead)"
                  opacity="0.7"
                />
              )
            })}

            {/* Task nodes */}
            {filteredNodes.map(node => {
              const pos = nodePositions.get(node.id)
              if (!pos) return null

              const isCurrentTask = node.id === currentTaskId
              const colors = getNodeColors(node.status, isCurrentTask)

              return (
                <TooltipProvider key={node.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <g className="cursor-pointer">
                        {/* Current task highlight */}
                        {isCurrentTask && (
                          <rect
                            x={pos.x - 3}
                            y={pos.y - 3}
                            width={nodeWidth + 6}
                            height={nodeHeight + 6}
                            rx="8"
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="2"
                            className="animate-pulse"
                          />
                        )}

                        {/* Node background */}
                        <rect
                          x={pos.x}
                          y={pos.y}
                          width={nodeWidth}
                          height={nodeHeight}
                          rx="6"
                          fill={colors.fill}
                          stroke={colors.stroke}
                          strokeWidth="1.5"
                        />

                        {/* Task name */}
                        <text
                          x={pos.x + 8}
                          y={pos.y + 18}
                          className="text-sm font-medium"
                          fill={colors.text}
                        >
                          {node.name.length > 16 ? `${node.name.substring(0, 16)}...` : node.name}
                        </text>

                        {/* Status */}
                        <text
                          x={pos.x + 8}
                          y={pos.y + 35}
                          className="text-xs"
                          fill={colors.text}
                          opacity="0.8"
                        >
                          {getStatusText(node.status)}
                        </text>

                        {/* Duration */}
                        <text
                          x={pos.x + 8}
                          y={pos.y + 50}
                          className="text-xs"
                          fill={colors.text}
                          opacity="0.6"
                        >
                          {node.duration_days} ngày
                        </text>

                        {/* Status icon */}
                        <foreignObject
                          x={pos.x + nodeWidth - 24}
                          y={pos.y + 8}
                          width="16"
                          height="16"
                        >
                          {getStatusIcon(node.status)}
                        </foreignObject>
                      </g>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="space-y-2">
                        <p className="font-semibold">{node.name}</p>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(node.status)}
                          <span className="text-sm">{getStatusText(node.status)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Thời gian: {node.duration_days} ngày
                        </p>
                        {node.dependencies.length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Phụ thuộc: {node.dependencies.length} công việc
                          </p>
                        )}
                        {node.dependents.length > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Được phụ thuộc: {node.dependents.length} công việc
                          </p>
                        )}
                        {isCurrentTask && (
                          <Badge variant="default" className="text-xs">
                            Công việc hiện tại
                          </Badge>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            })}
          </svg>
        </div>

        {/* Compact legend */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium mb-2">Chú thích:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Circle className="h-3 w-3 text-gray-400" />
              <span>Chưa bắt đầu</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-blue-600" />
              <span>Đang thực hiện</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-600" />
              <span>Hoàn thành</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3 w-3 text-yellow-600" />
              <span>Đang xem xét</span>
            </div>
            <div className="flex items-center gap-2">
              <Pause className="h-3 w-3 text-red-600" />
              <span>Bị chặn</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
              <span>Công việc hiện tại</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
