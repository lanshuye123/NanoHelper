import type { Component } from 'vue'
import {
  Atom,
  BookOpen,
  FileOutput,
  FileText,
  FlaskConical,
  Grid3x3,
  Info,
  LineChart,
  ScanLine,
  Table2,
  Upload,
} from 'lucide-vue-next'

export type ToolGroup = 'workspace' | 'data' | 'crystal'
export type ToolStatus = 'stable' | 'beta'

export interface ToolMeta {
  id: string
  title: string
  subtitle: string
  group: ToolGroup
  path: string
  icon: Component
  status?: ToolStatus
  doc?: string
  component: () => Promise<Component>
}

export const TOOL_GROUPS: Array<{ key: ToolGroup; label: string }> = [
  { key: 'workspace', label: '工作台' },
  { key: 'data', label: '数据处理' },
  { key: 'crystal', label: '晶体学计算' },
]

export const tools: ToolMeta[] = [
  {
    id: 'data-import',
    title: '导入与预处理',
    subtitle: '导入、检查、变换、逆变换',
    group: 'data',
    path: '/data/import',
    icon: Upload,
    status: 'stable',
    doc: '/docs/userguide/data-import',
    component: () => import('@/views/DataImportView.vue'),
  },
  {
    id: 'jade-export',
    title: 'Jade 导出',
    subtitle: '映射到 Jade 可读格式',
    group: 'data',
    path: '/data/jade',
    icon: FileOutput,
    status: 'stable',
    doc: '/docs/userguide/jade-export',
    component: () => import('@/views/JadeExportView.vue'),
  },
  {
    id: 'dif-to-xy',
    title: 'DIF → XY',
    subtitle: '拟合结果转 Origin 多列数据',
    group: 'data',
    path: '/data/dif',
    icon: Table2,
    status: 'stable',
    doc: '/docs/userguide/dif-to-xy',
    component: () => import('@/views/DifView.vue'),
  },
  {
    id: 'reciprocal',
    title: '倒易空间',
    subtitle: 'd 值、夹角、晶带与二维倒易面',
    group: 'crystal',
    path: '/crystal/reciprocal',
    icon: Grid3x3,
    status: 'stable',
    doc: '/docs/userguide/reciprocal',
    component: () => import('@/views/ReciprocalView.vue'),
  },
  {
    id: 'saed',
    title: '电子衍射模拟',
    subtitle: '带轴 SAED 斑点与指数',
    group: 'crystal',
    path: '/crystal/saed',
    icon: ScanLine,
    status: 'stable',
    doc: '/docs/userguide/saed',
    component: () => import('@/views/SaedView.vue'),
  },
  {
    id: 'xrd',
    title: 'XRD 模拟与分析',
    subtitle: '理论谱、峰表、Scherrer / W–H',
    group: 'crystal',
    path: '/crystal/xrd',
    icon: LineChart,
    status: 'stable',
    doc: '/docs/userguide/xrd',
    component: () => import('@/views/XrdView.vue'),
  },
  {
    id: 'structure',
    title: '晶体结构',
    subtitle: 'CIF 导入、对称展开、晶胞内容',
    group: 'crystal',
    path: '/crystal/structure',
    icon: Atom,
    status: 'stable',
    doc: '/docs/userguide/structure',
    component: () => import('@/views/StructureView.vue'),
  },
]

export function toolById(id: string): ToolMeta | undefined {
  return tools.find((t) => t.id === id)
}

export const docLinks = [
  { label: '用户指南', path: '/docs/userguide/getting-started', icon: BookOpen },
  { label: '实战手册', path: '/docs/cookbook/raman-to-jade', icon: FlaskConical },
  { label: '功能说明', path: '/docs/reference/tools', icon: FileText },
  { label: '关于', path: '/about', icon: Info },
]
