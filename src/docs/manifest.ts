export interface DocSection {
  key: string
  label: string
  description: string
}

export interface DocEntry {
  section: string
  slug: string
  title: string
  description: string
  file: string
  order: number
  keywords?: string[]
}

export const DOC_SECTIONS: DocSection[] = [
  { key: 'userguide', label: '用户指南', description: '从第一次打开到完整工作流' },
  { key: 'cookbook', label: '实战手册', description: '可复现的任务与参数' },
  { key: 'reference', label: '功能说明', description: '输入输出、公式与格式规范' },
  { key: 'dev', label: '开发文档', description: '架构、扩展与部署' },
]

export const DOCS: DocEntry[] = [
  {
    section: 'userguide',
    slug: 'getting-started',
    title: '快速开始',
    description: '五分钟内完成导入、映射与 Jade 导出',
    file: 'userguide/getting-started.md',
    order: 1,
    keywords: ['入门', '安装', '离线', '浏览器'],
  },
  {
    section: 'userguide',
    slug: 'interface',
    title: '界面与工作流',
    description: '顶栏模块、侧栏导航、三栏工作台与快捷键',
    file: 'userguide/interface.md',
    order: 2,
    keywords: ['界面', '导航', '布局'],
  },
  {
    section: 'userguide',
    slug: 'data-import',
    title: '数据导入',
    description: '支持格式、列映射、编码与解析报告',
    file: 'userguide/data-import.md',
    order: 3,
    keywords: ['CSV', 'XY', 'DIF', 'XRDML', '编码'],
  },
  {
    section: 'userguide',
    slug: 'preprocessing',
    title: '预处理与逆处理',
    description: '步骤账本、平滑、扣背底、Kα2 与可逆映射',
    file: 'userguide/preprocessing.md',
    order: 4,
    keywords: ['SNIP', 'Savitzky', 'Kα2', '归一化', '逆变换'],
  },
  {
    section: 'userguide',
    slug: 'jade-export',
    title: 'Jade 导出',
    description: '兼容性检查、坐标映射与配方文件',
    file: 'userguide/jade-export.md',
    order: 5,
    keywords: ['Jade', 'XY', 'recipe', '兼容性'],
  },
  {
    section: 'userguide',
    slug: 'dif-to-xy',
    title: 'DIF → XY',
    description: '解析多块拟合结果并导出 Origin 多列数据',
    file: 'userguide/dif-to-xy.md',
    order: 6,
    keywords: ['DIF', 'Origin', '拟合', 'Rwp'],
  },
  {
    section: 'userguide',
    slug: 'reciprocal',
    title: '倒易空间',
    description: 'd 值、晶面/晶向夹角、晶带轴与二维倒易面',
    file: 'userguide/reciprocal.md',
    order: 7,
    keywords: ['倒易', '晶带', 'd 值', '夹角'],
  },
  {
    section: 'userguide',
    slug: 'saed',
    title: '电子衍射模拟',
    description: '带轴选择、斑点强度、相机常数与导出',
    file: 'userguide/saed.md',
    order: 8,
    keywords: ['SAED', 'ZOLZ', '相机常数', '结构因子'],
  },
  {
    section: 'userguide',
    slug: 'xrd',
    title: 'XRD 模拟与分析',
    description: '理论谱、峰表、Scherrer 与 Williamson–Hall',
    file: 'userguide/xrd.md',
    order: 9,
    keywords: ['XRD', 'Scherrer', 'Williamson-Hall', '峰宽'],
  },
  {
    section: 'userguide',
    slug: 'structure',
    title: '晶体结构',
    description: 'CIF 导入、对称展开、密度与反射预览',
    file: 'userguide/structure.md',
    order: 10,
    keywords: ['CIF', '空间群', '对称', '密度'],
  },
  {
    section: 'userguide',
    slug: 'cell',
    title: '晶胞与密度',
    description: '体积、理论密度、Z 值、APF 与低角反射',
    file: 'userguide/cell.md',
    order: 13,
    keywords: ['晶胞', '密度', 'Z 值', 'APF', '堆积因子'],
  },
  {
    section: 'userguide',
    slug: 'indices',
    title: '晶面与晶向',
    description: 'Miller/四指数、d 值、夹角、晶带与消光',
    file: 'userguide/indices.md',
    order: 14,
    keywords: ['Miller', '四指数', '晶带', '消光', 'Weiss'],
  },
  {
    section: 'userguide',
    slug: 'lattice-refine',
    title: '晶格参数精修',
    description: '峰位最小二乘、仪器零点与 Nelson–Riley',
    file: 'userguide/lattice-refine.md',
    order: 15,
    keywords: ['精修', '晶格参数', '零点', 'Nelson-Riley'],
  },
  {
    section: 'userguide',
    slug: 'crystal-viewer',
    title: '三维晶胞查看器',
    description: '内嵌 CrystalViewer 的 3D 晶胞与 Wyckoff 位置',
    file: 'userguide/crystal-viewer.md',
    order: 16,
    keywords: ['CrystalViewer', '三维', '晶胞', 'Wyckoff', '空间群'],
  },
  {
    section: 'userguide',
    slug: 'particles',
    title: '颗粒尺寸测量',
    description: '类 NanoMeasure：标尺、测量、统计与导出',
    file: 'userguide/particles.md',
    order: 17,
    keywords: ['NanoMeasure', 'SEM', 'TEM', '粒径', '标尺', '统计'],
  },
  {
    section: 'userguide',
    slug: 'saed-index',
    title: 'SAED 指标化',
    description: '从实验斑点 R/夹角反算 d、hkl 与带轴',
    file: 'userguide/saed-index.md',
    order: 18,
    keywords: ['SAED', '指标化', '带轴', '相机常数', '消光'],
  },
  {
    section: 'userguide',
    slug: 'tem',
    title: '电镜参数计算',
    description: '电子波长、分辨率、像差、焦距与相机常数',
    file: 'userguide/tem.md',
    order: 19,
    keywords: ['TEM', '电子波长', '瑞利', '像差', '相机常数'],
  },
  {
    section: 'userguide',
    slug: 'ewald',
    title: '艾瓦德球与劳厄带',
    description: '用倒易点阵、艾瓦德球与 ZOLZ/HOLZ 理解衍射几何',
    file: 'userguide/ewald.md',
    order: 20,
    keywords: ['Ewald', '艾瓦德球', 'ZOLZ', 'HOLZ', '劳厄带', '激发误差'],
  },
  {
    section: 'userguide',
    slug: 'symmetry',
    title: '对称性、消光与手性',
    description: '空间群、等效位置、反射条件与手性判断',
    file: 'userguide/symmetry.md',
    order: 21,
    keywords: ['空间群', '对称', 'Wyckoff', '消光', '手性'],
  },
  {
    section: 'userguide',
    slug: 'saed-rings',
    title: '多晶电子衍射环',
    description: '多晶 SAED 环、hkl 标注与相机常数反算',
    file: 'userguide/saed-rings.md',
    order: 22,
    keywords: ['SAED', '多晶', '衍射环', '相机常数', 'hkl'],
  },
  {
    section: 'userguide',
    slug: 'projects',
    title: '工程与配方',
    description: '数据结构、配方 JSON 与跨页面共享',
    file: 'userguide/projects.md',
    order: 11,
    keywords: ['工程', '配方', 'JSON', '校验'],
  },
  {
    section: 'userguide',
    slug: 'faq',
    title: '常见问题',
    description: '导入失败、Jade 读不出、峰位偏移等排查',
    file: 'userguide/faq.md',
    order: 12,
    keywords: ['FAQ', '排查', '错误'],
  },

  {
    section: 'cookbook',
    slug: 'raman-to-jade',
    title: 'Raman → Jade → Origin 全流程',
    description: '非衍射数据的映射、拟合与坐标反算',
    file: 'cookbook/raman-to-jade.md',
    order: 1,
    keywords: ['Raman', 'Jade', '逆处理'],
  },
  {
    section: 'cookbook',
    slug: 'xrd-peak-fitting',
    title: 'XRD 峰拟合与背底',
    description: '在 Jade 中扣背底、手动寻峰并导出 DIF',
    file: 'cookbook/xrd-peak-fitting.md',
    order: 2,
    keywords: ['XRD', '背底', '寻峰'],
  },
  {
    section: 'cookbook',
    slug: 'dif-to-origin',
    title: '把 DIF 画成发表级 Origin 图',
    description: '多列数据、差值曲线与 PDF 卡片叠加',
    file: 'cookbook/dif-to-origin.md',
    order: 3,
  },
  {
    section: 'cookbook',
    slug: 'rietveld-origin',
    title: 'Rietveld 图与差值曲线',
    description: '实验/计算/差值三线图的 Origin 设置',
    file: 'cookbook/rietveld-origin.md',
    order: 4,
  },
  {
    section: 'cookbook',
    slug: 'saed-indexing',
    title: 'SAED 标定与带轴识别',
    description: '量 R、算 d、对卡片、定带轴',
    file: 'cookbook/saed-indexing.md',
    order: 5,
  },
  {
    section: 'cookbook',
    slug: 'compare-wavelengths',
    title: '不同波长数据的对比',
    description: '把 2θ 换成 1/d，对齐 Cu/同步辐射/电子衍射',
    file: 'cookbook/compare-wavelengths.md',
    order: 6,
  },
  {
    section: 'cookbook',
    slug: 'scherrer',
    title: 'Scherrer 与 Williamson–Hall',
    description: '从峰宽到晶粒尺寸与微应变',
    file: 'cookbook/scherrer.md',
    order: 7,
  },
  {
    section: 'cookbook',
    slug: 'kalpha2',
    title: 'Kα2 剥离',
    description: 'Rachinger 方法的参数与效果检查',
    file: 'cookbook/kalpha2.md',
    order: 8,
  },

  {
    section: 'reference',
    slug: 'tools',
    title: '工具总览',
    description: '每个工具的输入、输出、参数与限制',
    file: 'reference/tools.md',
    order: 1,
  },
  {
    section: 'reference',
    slug: 'file-formats',
    title: '文件格式规范',
    description: 'Jade XY、DIF、recipe.json、CSV 与 SAED 表',
    file: 'reference/file-formats.md',
    order: 2,
  },
  {
    section: 'reference',
    slug: 'formulas',
    title: '公式与推导',
    description: '倒易空间、结构因子、SAED、XRD 与峰分析',
    file: 'reference/formulas.md',
    order: 3,
  },
  {
    section: 'reference',
    slug: 'glossary',
    title: '术语与符号',
    description: '中英对照、单位与常用记号',
    file: 'reference/glossary.md',
    order: 4,
  },
  {
    section: 'reference',
    slug: 'changelog',
    title: '版本记录',
    description: '功能、修复与格式变更',
    file: 'reference/changelog.md',
    order: 5,
  },

  {
    section: 'dev',
    slug: 'architecture',
    title: '架构',
    description: '分层、目录、数据流与纯函数内核',
    file: 'dev/architecture.md',
    order: 1,
  },
  {
    section: 'dev',
    slug: 'adding-a-tool',
    title: '新增一个工具',
    description: '从注册表到文档的完整清单',
    file: 'dev/adding-a-tool.md',
    order: 2,
  },
  {
    section: 'dev',
    slug: 'testing',
    title: '测试与质量',
    description: '单元测试、固定装置与验收清单',
    file: 'dev/testing.md',
    order: 3,
  },
  {
    section: 'dev',
    slug: 'ai-governance',
    title: '界面文案治理',
    description: '最终界面的禁用词、写法对照与验收清单',
    file: 'dev/ai-governance.md',
    order: 5,
    keywords: ['文案', '治理', '界面', 'AI', '禁用词'],
  },
  {
    section: 'dev',
    slug: 'deployment',
    title: '构建与部署',
    description: '静态产物、GitHub Pages 与子路径',
    file: 'dev/deployment.md',
    order: 4,
  },
]

export function getDoc(section: string | undefined, slug: string | undefined): DocEntry | undefined {
  if (!section) return undefined
  const entries = DOCS.filter((d) => d.section === section)
  if (!slug) return entries[0]
  return entries.find((d) => d.slug === slug)
}

export function docsBySection(section: string): DocEntry[] {
  return DOCS.filter((d) => d.section === section).sort((a, b) => a.order - b.order)
}

export function sectionLabel(key: string): string {
  return DOC_SECTIONS.find((s) => s.key === key)?.label ?? key
}

export function docPath(doc: DocEntry): string {
  return `/docs/${doc.section}/${doc.slug}`
}

export function prevNext(doc: DocEntry): { prev?: DocEntry; next?: DocEntry } {
  const sectionDocs = docsBySection(doc.section)
  const index = sectionDocs.findIndex((d) => d.slug === doc.slug)
  return { prev: sectionDocs[index - 1], next: sectionDocs[index + 1] }
}
