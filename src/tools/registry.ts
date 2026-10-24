import type { Component } from 'vue'
import {
  Atom,
  BookOpen,
  Box,
  Calculator,
  FileOutput,
  FileText,
  FlaskConical,
  Gauge,
  Grid2x2,
  Grid3x3,
  Info,
  LineChart,
  Microscope,
  ScanLine,
  ScanSearch,
  Table2,
  Upload,
} from 'lucide-vue-next'

export type ToolGroup = 'data' | 'diffraction' | 'crystal' | 'micro'
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
  { key: 'micro', label: '显微分析' },
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
  {
    id: 'cell',
    task: '晶胞与密度',
    summary: '由晶格参数与晶胞内容算体积、理论密度、Z 值、化学式量与堆积因子。',
    title: '晶胞与密度',
    subtitle: '体积、密度、Z 值、APF 与低角反射',
    group: 'crystal',
    path: '/crystal/cell',
    icon: Box,
    status: 'stable',
    doc: '/docs/userguide/cell',
    component: () => import('@/views/CellView.vue'),
  },
  {
    id: 'indices',
    task: '晶面与晶向',
    summary: 'Miller/四指数换算、d 值、夹角、晶带轴与系统消光检查。',
    title: '晶面与晶向',
    subtitle: 'Miller 指数、四指数、夹角与消光',
    group: 'crystal',
    path: '/crystal/indices',
    icon: Grid2x2,
    status: 'stable',
    doc: '/docs/userguide/indices',
    component: () => import('@/views/IndicesView.vue'),
  },
  {
    id: 'lattice-refine',
    task: '晶格参数精修',
    summary: '由带 hkl 的峰位同时精修晶格参数与仪器零点，并做 Nelson–Riley 外推。',
    title: '晶格参数精修',
    subtitle: '峰位最小二乘、零点与 Nelson–Riley',
    group: 'crystal',
    path: '/crystal/refine',
    icon: Calculator,
    status: 'stable',
    doc: '/docs/userguide/lattice-refine',
    component: () => import('@/views/RefineView.vue'),
  },
  {
    id: 'crystal-viewer',
    task: '三维晶胞查看',
    summary: '内嵌 CrystalViewer：按空间群浏览 3D 晶胞、Wyckoff 位置与原子点位。',
    title: '三维晶胞查看器',
    subtitle: '内嵌 crystal.jamaccao.cn',
    group: 'crystal',
    path: '/crystal/viewer',
    icon: Grid3x3,
    status: 'stable',
    doc: '/docs/userguide/crystal-viewer',
    component: () => import('@/views/CrystalViewerEmbedView.vue'),
  },
  {
    id: 'particles',
    task: '颗粒尺寸测量',
    summary: '类 NanoMeasure：标尺标定、逐颗画线或自动识别、统计分布与导出。',
    title: '颗粒尺寸测量',
    subtitle: 'SEM/TEM 标尺、粒径统计与导出',
    group: 'micro',
    path: '/micro/particles',
    icon: Microscope,
    status: 'stable',
    doc: '/docs/userguide/particles',
    component: () => import('@/views/ParticleView.vue'),
  },
  {
    id: 'saed-index',
    task: 'SAED 指标化',
    summary: '由实验 SAED 的两个 R 与夹角反算 d、枚举 hkl 与带轴，并检查消光。',
    title: 'SAED 指标化',
    subtitle: '实验斑点指标化与带轴识别',
    group: 'micro',
    path: '/micro/saed-index',
    icon: ScanSearch,
    status: 'stable',
    doc: '/docs/userguide/saed-index',
    component: () => import('@/views/SaedIndexView.vue'),
  },
  {
    id: 'tem',
    task: '电镜参数计算',
    summary: '电子波长、瑞利分辨率、CTF、像差弥散、磁透镜焦距、亮度与相机常数。',
    title: '电镜参数计算',
    subtitle: '电子光学、像差与相机常数',
    group: 'micro',
    path: '/micro/tem',
    icon: Gauge,
    status: 'stable',
    doc: '/docs/userguide/tem',
    component: () => import('@/views/TemView.vue'),
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
