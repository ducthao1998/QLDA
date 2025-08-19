declare module "wx-react-gantt" {
  import * as React from "react"
  export interface WxTask {
    id: string | number
    text: string
    start: Date
    end: Date
    duration?: number
    progress?: number
    type?: string
    parent?: string | number
    lazy?: boolean
  }
  export interface WxLink {
    id: string | number
    source: string | number
    target: string | number
    type?: string
  }
  export interface ScaleItem {
    unit: string
    step: number
    format: string
  }
  export interface GanttProps {
    tasks?: WxTask[]
    links?: WxLink[]
    scales?: ScaleItem[]
    columns?: any[]
    [key: string]: any
  }
  export const Gantt: React.ComponentType<GanttProps>
  export const Willow: React.ComponentType<{ children: React.ReactNode }>
}


