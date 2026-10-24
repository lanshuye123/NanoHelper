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

export type ToolGroup = 'data' | 'diffraction' | 'crystal'
export type ToolStatus = 'stable' | 'beta'

export interface ToolMeta {
  id: string
  /** Task-oriented name used on cards and in the tool bar. */
  task: string
  /** One sentence: what the tool does for the user. */
  summary: string
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
  { key: 'data', label: '数据处理' },
  { key: 'diffraction', label: '衍射模拟' },
  { key: 'crystal', label: '晶体几何' },
]

export const tools: ToolMeta[] = [
  {
    id: 'data-import',
    task: 'XRD 数据预处理',
    summary: '导入谱图，裁剪、平滑、扣背底，再导出 Jade 可读的两列 XY。',
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
    task: '导出到 Jade',
    summary: '把处理后的数据映射到 Jade 坐标，生成 .xy 与可逆配方。',
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
    task: 'DIF 转 XY',
    summary: '解析 Jade 拟合结果，导出 Origin 多列数据并反算坐标。',
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
    task: '倒易空间计算',
    summary: '算 d 值、晶面与晶向夹角、晶带轴，并绘制二维倒易面。',
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
    task: 'SAED 模拟',
    summary: '按带轴生成电子衍射斑点图、指数与相机常数标定。',
    title: '电子衍射模拟',
    subtitle: '带轴 SAED 斑点与指数',
    group: 'diffraction',
    path: '/crystal/saed',
    icon: ScanLine,
    status: 'stable',
    doc: '/docs/userguide/saed',
    component: () => import('@/views/SaedView.vue'),
  },
  {
    id: 'xrd',
    task: 'XRD 模拟与分析',
    summary: '生成理论谱与峰表，做 Scherrer 和 Williamson–Hall 分析。',
    title: 'XRD 模拟与分析',
    subtitle: '理论谱、峰表、Scherrer / W–H',
    group: 'diffraction',
    path: '/crystal/xrd',
    icon: LineChart,
    status: 'stable',
    doc: '/docs/userguide/xrd',
    component: () => import('@/views/XrdView.vue'),
  },
  {
    id: 'structure',
    task: '晶体结构',
    summary: '导入 CIF，展开对称操作并查看晶胞内容与低角反射。',
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
  return tools.find((tool) => tool.id === id)
}

export const docLinks = [
  { label: '用户指南', path: '/docs/userguide/getting-started', icon: BookOpen },
  { label: '实战手册', path: '/docs/cookbook/raman-to-jade', icon: FlaskConical },
  { label: '功能说明', path: '/docs/reference/tools', icon: FileText },
  { label: '关于', path: '/about', icon: Info },
]
