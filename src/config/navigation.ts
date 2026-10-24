import type { Component } from 'vue'
import {
  Atom,
  BookOpen,
  Code2,
  Compass,
  Database,
  ExternalLink,
  FileText,
  FlaskConical,
  Info,
  LayoutDashboard,
  Microscope,
  ScanLine,
  Upload,
} from 'lucide-vue-next'
import { DOC_SECTIONS, docsBySection, docPath, type DocEntry, type DocSection } from '@/docs/manifest'
import { tools, type ToolGroup, type ToolMeta } from '@/tools/registry'

export type ModuleKey = 'home' | 'data' | 'diffraction' | 'crystal' | 'micro' | 'docs' | 'about'

export interface NavItem {
  id: string
  label: string
  description?: string
  path: string
  icon: Component
  /** Small ordinal chip, e.g. "01" — mirrors BoMIND's sidebar numbering. */
  index?: string
  badge?: string
  doc?: string
}

export interface NavModule {
  key: ModuleKey
  label: string
  /** Shorter label for narrow top bars. */
  short: string
  description: string
  path: string
  icon: Component
  accent: string
  highlights?: string[]
  items: NavItem[]
}

const GROUP_META: Record<
  ToolGroup,
  {
    key: Exclude<ModuleKey, 'home' | 'docs' | 'about'>
    label: string
    short: string
    description: string
    icon: Component
    accent: string
    highlights: string[]
  }
> = {
  data: {
    key: 'data',
    label: '数据处理',
    short: '数据',
    description: '导入、预处理与 Jade / Origin 往返',
    icon: Upload,
    accent: 'var(--module-data)',
    highlights: ['Jade 兼容', '可逆映射', 'Origin 多列'],
  },
  diffraction: {
    key: 'diffraction',
    label: '衍射模拟',
    short: '衍射',
    description: '电子衍射与 X 射线衍射的正演计算',
    icon: ScanLine,
    accent: 'var(--module-diffraction)',
    highlights: ['带轴 SAED', 'XRD 理论谱', 'Scherrer'],
  },
  crystal: {
    key: 'crystal',
    label: '晶体几何',
    short: '晶体',
    description: '倒易空间、晶带、晶胞与 CIF 结构解析',
    icon: Atom,
    accent: 'var(--module-crystal)',
    highlights: ['d 值/夹角', '晶带轴', 'CIF 展开'],
  },
  micro: {
    key: 'micro',
    label: '显微分析',
    short: '显微',
    description: 'SEM/TEM 图像、电子衍射与电镜参数',
    icon: Microscope,
    accent: 'var(--module-micro)',
    highlights: ['粒径统计', 'SAED 指标化', '电镜参数'],
  },
}

function toNavItem(tool: ToolMeta, index: number): NavItem {
  return {
    id: tool.id,
    label: tool.title,
    description: tool.subtitle,
    path: tool.path,
    icon: tool.icon,
    index: String(index + 1).padStart(2, '0'),
    badge: tool.status === 'beta' ? 'BETA' : undefined,
    doc: tool.doc,
  }
}

function moduleForGroup(group: ToolGroup): NavModule {
  const meta = GROUP_META[group]
  const items = tools.filter((tool) => tool.group === group).map(toNavItem)
  return {
    ...meta,
    path: items[0]?.path ?? '/',
    items,
  }
}

export const DOC_SECTION_ICONS: Record<string, Component> = {
  userguide: Compass,
  cookbook: FlaskConical,
  reference: FileText,
  dev: Code2,
}

export interface DocNavGroup extends DocSection {
  icon: Component
  items: Array<DocEntry & { path: string }>
}

export const docNavGroups: DocNavGroup[] = DOC_SECTIONS.map((section) => ({
  ...section,
  icon: DOC_SECTION_ICONS[section.key] ?? BookOpen,
  items: docsBySection(section.key).map((doc) => ({ ...doc, path: docPath(doc) })),
}))

const docsModule: NavModule = {
  key: 'docs',
  label: '文档中心',
  short: '文档',
  description: '用户指南、实战手册与参考资料',
  path: '/docs/userguide/getting-started',
  icon: BookOpen,
  accent: 'var(--module-docs)',
  highlights: ['用户指南', '实战手册', '站内搜索'],
  items: docNavGroups.map((group) => ({
    id: group.key,
    label: group.label,
    description: group.description,
    path: group.items[0]?.path ?? `/docs/${group.key}`,
    icon: group.icon,
  })),
}

const aboutModule: NavModule = {
  key: 'about',
  label: '关于',
  short: '关于',
  description: '项目说明、数据来源与使用边界',
  path: '/about',
  icon: Info,
  accent: 'var(--module-about)',
  items: [
    {
      id: 'about-overview',
      label: '项目概览',
      description: '版本、定位与适用范围',
      path: '/about',
      icon: Info,
    },
    {
      id: 'about-data',
      label: '数据来源',
      description: '散射因子、空间群与公式约定',
      path: '/about#about-data',
      icon: Database,
    },
    {
      id: 'about-scope',
      label: '功能范围',
      description: '数据处理、衍射、显微分析与三维结构',
      path: '/about#about-scope',
      icon: Compass,
    },
    {
      id: 'about-docs',
      label: '文档与引用',
      description: '引用格式与文档入口',
      path: '/about#about-docs',
      icon: BookOpen,
    },
    {
      id: 'about-limits',
      label: '边界与声明',
      description: '适用范围与已知限制',
      path: '/about#about-limits',
      icon: ExternalLink,
    },
  ],
}

export const homeModule: NavModule = {
  key: 'home',
  label: '首页',
  short: '首页',
  description: '工具箱总览与工作流入口',
  path: '/',
  icon: LayoutDashboard,
  accent: 'var(--accent)',
  items: [],
}

export const NAV_MODULES: NavModule[] = [
  homeModule,
  moduleForGroup('data'),
  moduleForGroup('diffraction'),
  moduleForGroup('crystal'),
  moduleForGroup('micro'),
  docsModule,
  aboutModule,
]

export function moduleByKey(key: string | undefined): NavModule {
  return NAV_MODULES.find((module) => module.key === key) ?? homeModule
}

/** Find the module that owns a route path (fallback when meta.module is absent). */
export function moduleForPath(path: string): NavModule {
  if (path === '/') return homeModule
  if (path.startsWith('/docs')) return docsModule
  if (path.startsWith('/about')) return aboutModule
  const module = NAV_MODULES.find((candidate) =>
    candidate.items.some((item) => path === item.path || path.startsWith(`${item.path}/`)),
  )
  return module ?? homeModule
}

export const searchEntries = [
  ...tools.map((tool) => ({
    kind: 'tool' as const,
    id: `tool-${tool.id}`,
    label: tool.title,
    description: tool.subtitle,
    path: tool.path,
    module: GROUP_META[tool.group].label,
    icon: tool.icon,
  })),
  ...docNavGroups.flatMap((group) =>
    group.items.map((doc) => ({
      kind: 'doc' as const,
      id: `doc-${doc.section}-${doc.slug}`,
      label: doc.title,
      description: doc.description,
      path: doc.path,
      module: group.label,
      icon: group.icon,
    })),
  ),
  {
    kind: 'page' as const,
    id: 'page-about',
    label: '关于本项目',
    description: '版本、数据来源、适用范围与引用',
    path: '/about',
    module: '关于',
    icon: Info,
  },
]
