# CrystalToolBox 总体设计

> 纳米材料与技术 / 晶体学工具箱 · 纯前端静态站点
>
> 版本：v0.1 草案　状态：待评审　日期：2026-10-23

---

## 0. 摘要

CrystalToolBox 是一个**完全运行在浏览器中**的晶体学与衍射数据处理工具箱。它把课程
（《X 射线晶体学》《显微结构分析》《新能源材料与技术》）中反复出现的三类工作流固化为
可复用工具：

1. **原始数据 → 预处理 → 逆处理 → MDI Jade 可读格式**，让 Jade 专注于它最擅长的
   背底、寻峰与拟合；
2. **Jade 拟合结果（DIF）→ Origin 可用 XY/多列数据**，并把坐标反算回原始物理量；
3. **倒易空间与晶向计算**：晶面间距、晶面夹角、晶带轴、带轴电子衍射（SAED）模拟，
   以及结构因子与 XRD 理论谱。

三者共享同一套「数据 + 配方（recipe）」模型：导入时生成的映射配方会一路传递到
DIF 反算与 Origin 导出，避免学生在 Jade 的「归一化坐标」和原始 Raman/IR/热重
坐标之间手工换算。

站点无后端、无账号、无上传：所有解析与计算在本地完成，部署于 GitHub Pages 等静态托管。

---

## 1. 背景与目标

### 1.1 来自课程笔记的真实约束

| 约束 | 出处 | 设计含义 |
|---|---|---|
| Jade 横坐标须在 0–140（2θ），纵坐标须始终 > 0 | 《X 射线衍射基础 20261013》 | 非衍射数据必须做**可逆**坐标映射 |
| 外来非衍射数据：X 归一化到 [0,100]，Y 归一化到 [0,10000] | 《X 射线衍射基础 20261020》 | 提供一键预设，并记录仿射系数 |
| Jade 的 DIF 由「文件头 / 参数行 / Y 数据」组成，参数行含起始角、步长、靶材、波长、终止角、点数、曲线名 | 同上 + `tmp/DEMO06.dif` 实测 | 解析器须支持**多数据块**与不同步长/范围 |
| 倒易基矢、晶面间距、晶面夹角、晶带方程、2D 倒易面构建、结构因子 | 《显微结构分析 5 倒易空间计算概述》 | 计算内核的公式与教学步骤一一对应 |
| 峰位 ↔ 晶格参数、峰宽 ↔ 晶粒尺寸/微应变、峰强 ↔ 结构因子 | 《X 射线衍射基础》 | 工具箱要能把「图上的数」翻译成「物理参数」 |

### 1.2 目标用户与场景

- **课程学生**：完成「用 Origin 建立晶体学计算模板」「模拟带轴电子衍射」等作业；
  把 Raman/IR/TGA 数据送进 Jade 做分峰。
- **科研新手**：拿到 XRD/SAED 数据后，需要快速算 d 值、标定带轴、判断消光、
  生成 Origin 可绘图的拟合曲线。
- **教学演示**：课堂上实时改变晶格参数/带轴，观察倒易点阵与衍射斑点的变化。

### 1.3 非目标

- 不做 Rietveld 精修、不做全谱拟合、不做晶体结构解析（这些交给 Jade/FullProf/GSAS）。
- 不做仪器控制、不做原始二进制格式（如 Bruker `.brml`）的完整解码，首版聚焦文本格式。
- 不替代专业建模软件（VESTA/Diamond），3D 查看只承担「看得懂、对得上」的辅助角色。

---

## 2. 设计原则

1. **本地优先**：数据不离开浏览器；刷新不丢工作（IndexedDB 自动保存）；可导出工程文件。
2. **可逆优先**：任何改变坐标的步骤都要声明逆变换；不可逆步骤（平滑、扣背底）单独标记，
   并保留原始数据以便重算。
3. **教学透明**：每个计算页都能展开「公式与步骤」，显示代入的数值，而不是只给结果。
   公式使用 KaTeX 渲染，直接对应笔记中的推导。
4. **可扩展**：导入器、导出器、变换步骤、工具页面均为注册表驱动；新增一个工具只需
   增加一个目录 + 一条注册项 + 一篇文档。
5. **离线可用**：构建产物可离线打开；不依赖任何 CDN 运行时资源。
6. **克制的视觉**：浅蓝—白为默认主题，深蓝顶栏 + 模块侧栏 + 白色内容面板；
   数字使用等宽字体，图表以数据为中心；同时提供深色主题与高对比度支持。

---

## 3. 功能规划

优先级：**P0 = 首版必须**，**P1 = 首版尽量**，**P2 = 后续扩展**。

### 3.1 数据处理

| 编号 | 功能 | 优先级 | 说明 |
|---|---|---|---|
| D1 | 多格式导入 | P0 | 文本/CSV/TSV/XY/DIF/XRDML；自动嗅探分隔符、表头、列号；拖拽与粘贴导入 |
| D2 | 数据检查 | P0 | 点数、步长、单调性、NaN、负值、重复 x、异常跳变；给出可操作的修复建议 |
| D3 | 预处理步骤链 | P0 | 裁剪、重采样、平滑（SG/滑动平均）、扣背底（SNIP/多项式/手选锚点）、Kα2 剥离、归一化、坐标映射 |
| D4 | 步骤账本与撤销 | P0 | 每步可启用/停用/编辑/删除；从原始数据重算；显示每步影响 |
| D5 | Jade 兼容性检查 | P0 | 0<X<140、Y>0、单调、有限值、点数、步长、编码/换行；逐条给出修复按钮 |
| D6 | Jade 导出 | P0 | `.xy`（两列 ASCII）+ `recipe.json`（可逆配方）+ 可选 `.csv`/带表头 `.txt` |
| D7 | 逆处理 | P0 | 对 Jade 拟合结果按配方反算 X/Y；支持峰位、峰面积、峰宽的反算 |
| D8 | DIF 解析 | P0 | 多块（Raw/Background/Fitted Profile n/Overall）、不同范围、名称识别、异常报告 |
| D9 | DIF → XY | P0 | Origin 多列（X, Raw, Bkg, Calc, Diff, 各拟合峰）、宽表/堆叠、CSV/XY、Bragg 位置 |
| D10 | 批处理与工程 | P1 | 多数据集管理、工程 JSON 导入导出、IndexedDB 自动保存 |
| D11 | 原位序列 | P2 | 多温度/时间序列对齐、堆叠图、峰位追踪 |

### 3.2 晶体学计算

| 编号 | 功能 | 优先级 | 说明 |
|---|---|---|---|
| C1 | 晶格与倒易晶格 | P0 | 六参数 → V、G、G\*、a\*b\*c\*、α\*β\*γ\*；预设常见晶体 |
| C2 | 晶面计算 | P0 | d(hkl)、两晶面夹角、晶面与晶向夹角、等效晶面族 |
| C3 | 晶向与晶带 | P0 | 两晶面求带轴、晶带方程校验、带轴内所有晶面枚举 |
| C4 | 2D 倒易面 | P0 | 带轴 → 二维基矢 → 倒易网格；显示 \|g\|、d、夹角；导出表格 |
| C5 | 结构因子 | P0 | 原子坐标 + 散射因子 + 温度因子；消光规律；\|F\|² |
| C6 | SAED 模拟 | P0 | 带轴电子衍射斑点、指数标注、强度、比例尺、CSV/PNG 导出 |
| C7 | XRD 理论谱 | P0 | 2θ、多重度、LP 因子、峰型、Kα1/Kα2；导出 Jade 可读 XY |
| C8 | CIF 导入 | P1 | 晶胞、空间群、原子位点、对称操作展开；常见 CIF 容错 |
| C9 | 3D 晶胞查看 | P1 | Three.js 晶胞/原子/键；与 SAED/XRD 联动 |
| C10 | 峰分析 | P1 | Scherrer 晶粒尺寸、Williamson–Hall 微应变、峰位→晶格参数最小二乘 |
| C11 | 未知谱指标化 | P2 | 基于 d 值序列与候选晶胞的半自动指标化 |

### 3.3 文档与站点

| 编号 | 功能 | 优先级 |
|---|---|---|
| S1 | 应用内文档中心（Markdown + KaTeX + 搜索 + 目录 + 上下篇） | P0 |
| S2 | 用户指南（userguide） | P0 |
| S3 | 实战手册（cookbook，含可复现数据与步骤） | P0 |
| S4 | 功能说明（reference，逐工具 I/O、公式、边界条件） | P0 |
| S5 | 开发文档（架构、扩展指南、格式规范、测试） | P0 |
| S6 | 深色/浅色主题、响应式、键盘快捷键、命令面板 | P1 |
| S7 | PWA 离线安装 | P2 |

---

## 4. 信息架构与页面

```
/                             首页（快速开始、最近工程、模块卡片、学习路径）
/data/import                  导入与预处理（核心工作台）
/data/jade                    Jade 导出与兼容性检查
/data/dif                     DIF → XY / Origin 导出
/crystal/reciprocal           倒易空间计算（d 值、夹角、带轴、2D 倒易面）
/crystal/saed                 带轴电子衍射模拟
/crystal/xrd                  XRD 理论谱与峰分析
/crystal/structure            CIF / 晶体结构（P1，含 3D）
/docs/:section/:slug          文档中心
/about                        关于、符号表、参考文献、版本记录
```

导航分组：**首页 / 数据处理 / 衍射模拟 / 晶体几何 / 文档中心 / 关于**。
顶栏标签切换模块，侧栏列出当前模块的页面；桌面端侧栏可收起为图标栏，移动端为全高抽屉。
工具页标题区显示 `模块 · 序号`，右上角有「对应文档」入口。

### 4.1 工具页统一骨架

```
┌──────────────────────────────────────────────────────────────┐
│ 模块 · 序号 / 工具名 / 副标题          [文档] [示例] [导出]   │
├───────────────┬───────────────────────────────┬──────────────┤
│ 配置面板       │ 主可视化（Canvas / 3D）        │ 结果 / 检查器 │
│ 分组折叠       │ 缩放、平移、十字线、图例        │ 表格、警告     │
│ 参数校验       │ 导出 PNG/SVG/CSV               │ 公式与步骤     │
├───────────────┴───────────────────────────────┴──────────────┤
│ 状态栏：数据范围 · 点数 · 计算耗时 · 项目状态 · 版本          │
└──────────────────────────────────────────────────────────────┘
```

左右面板可折叠；中小屏幕自动改为上下堆叠。配置项采用「即时预览 + 显式应用」混合：
绘图参数即时生效，重计算步骤（如扣背底）防抖 200 ms 后重算。

---

## 5. 技术选型

| 层 | 选择 | 理由 |
|---|---|---|
| 框架 | Vue 3.5（Composition API）+ TypeScript（strict） | 与既有 CrystalViewer 项目一致，生态成熟 |
| 构建 | Vite 7/8 | 快速、静态产物简单、GitHub Pages 友好 |
| 状态 | Pinia | 轻量、可测试；工程/数据集/设置分 store |
| 路由 | Vue Router（hash 模式） | 静态托管零配置，避免 404 回退问题 |
| UI 组件 | Element Plus（定制主题） | 表单、表格、弹窗、消息齐全；与既有项目一致 |
| 样式 | 原生 CSS + 设计令牌（CSS 变量），少量工具类 | 科学 UI 需要精细控制；避免 Tailwind 与 EP 的 preflight 冲突 |
| 图标 | lucide-vue-next | 线性、克制、体量小 |
| 绘图 | **自研 Canvas 2D 图表组件** | 需要十字线、缩放、峰标注、对数轴、大点数抽稀；避免图表库的体积与定制成本 |
| 3D | Three.js（按需懒加载） | 晶胞、原子、键、配位多面体 |
| 公式 | KaTeX | 文档与工具页统一渲染，服务端不需要 |
| Markdown | markdown-it + 自定义容器 + KaTeX 插件 | 文档中心可控、可搜索 |
| 文件解析 | 自研（文本、CSV、XML）；必要时 `fflate` | 保持离线、可测试、可控错误信息 |
| 测试 | Vitest + @vue/test-utils | 纯函数内核优先测试 |
| 代码质量 | ESLint + Prettier（oxlint 可选） | 与既有项目一致 |
| 包管理 | yarn 1.22 | 与既有项目一致，环境已具备 |
| 部署 | GitHub Actions → GitHub Pages | 纯静态、免费、可自定义域名 |

> 说明：不引入 ECharts/Plotly。衍射图与拟合图需要「按像素抽稀 + 峰位吸附 + 千级标注」，
> 自研 Canvas 组件约 500 行即可覆盖，且能精确控制导出分辨率与主题配色。

---

## 6. 系统架构

### 6.1 分层

```
┌─────────────────────────────────────────────────────────┐
│ views/          页面级组合（工作台、导入、SAED、文档…）  │
├─────────────────────────────────────────────────────────┤
│ components/     通用组件（SciChart、DataTable、面板…）   │
├─────────────────────────────────────────────────────────┤
│ stores/         Pinia：project / dataset / settings      │
├─────────────────────────────────────────────────────────┤
│ core/           纯 TypeScript，无 Vue/DOM 依赖            │
│  ├─ lattice/    晶格、倒易、晶向、晶带、2D 倒易面          │
│  ├─ diffraction/结构因子、散射因子、SAED、XRD、峰型        │
│  ├─ io/         importers / exporters / dif / xrdml       │
│  ├─ pipeline/   变换步骤、配方、逆变换、校验               │
│  ├─ crystallography/ CIF 解析、对称操作、消光              │
│  └─ num/        插值、平滑、最小二乘、峰拟合               │
├─────────────────────────────────────────────────────────┤
│ data/           元素表、散射因子、空间群、预设晶体、示例数据 │
└─────────────────────────────────────────────────────────┘
```

**约束**：`core/` 不 import Vue、不访问 `window`；可在 Worker、Node 测试与未来的 CLI 中复用。
UI 只负责参数收集、调用 core、渲染结果。

### 6.2 目录结构

```
CrystalToolBox/
├─ docs/                      # 站点文档（构建时打包）
│  ├─ design/                 # 设计文档（本文件）
│  ├─ userguide/
│  ├─ cookbook/
│  ├─ reference/
│  └─ dev/
├─ public/                    # 图标、示例数据、CNAME
├─ scripts/                   # 数据生成、文档索引、校验脚本
├─ src/
│  ├─ assets/styles/          # 令牌、基础样式、EP 主题覆盖
│  ├─ components/
│  │  ├─ chart/SciChart.vue
│  │  ├─ layout/AppShell.vue, SideNav.vue, StatusBar.vue
│  │  ├─ common/ParamPanel.vue, NumberField.vue, DataTable.vue …
│  │  └─ docs/DocViewer.vue, DocToc.vue, DocSearch.vue
│  ├─ core/
│  │  ├─ lattice/{metric.ts, reciprocal.ts, zone.ts, planeNet.ts, presets.ts}
│  │  ├─ diffraction/{scattering.ts, structureFactor.ts, saed.ts, xrd.ts, profile.ts}
│  │  ├─ io/{importers/, exporters/, dif.ts, xy.ts, xrdml.ts, sniff.ts}
│  │  ├─ pipeline/{types.ts, steps.ts, apply.ts, inverse.ts, validate.ts}
│  │  ├─ crystallography/{cif.ts, symmetry.ts, extinction.ts}
│  │  └─ num/{interpolate.ts, smooth.ts, background.ts, peak.ts, stats.ts}
│  ├─ data/                   # JSON 数据（元素、散射因子、空间群、示例）
│  ├─ router/{index.ts, tools.ts}
│  ├─ stores/{project.ts, dataset.ts, settings.ts}
│  ├─ views/
│  ├─ App.vue
│  └─ main.ts
├─ tests/                     # 固定装置与端到端样例
├─ .github/workflows/deploy.yml
├─ index.html
├─ package.json
├─ tsconfig*.json
└─ vite.config.ts
```

### 6.3 关键第三方数据

- **原子散射因子**：Cromer–Mann 九参数（a1–a4, b1–b4, c），覆盖 H–U；来源为
  International Tables for Crystallography Vol. C。构建期生成 JSON，运行时按元素取用。
- **空间群**：复用/裁剪 CrystalViewer 已生成的 230 空间群数据集（对称操作 + 晶系 +
  Pearson 符号），仅保留本工具需要的字段，按晶系拆分懒加载。
- **元素表**：原子序数、符号、名称、原子量、共价半径/离子半径（3D 与密度计算用）。
- **示例数据**：`DEMO06.dif`、合成的 Raman/TGA 数据、常见晶体 CIF（Si、TiO₂ 锐钛矿/
  金红石、NaCl、Mg、Al）。

---

## 7. 核心数据模型

### 7.1 数据集

```ts
interface PatternMeta {
  xLabel: string          // "2θ", "Raman shift", "Temperature"
  xUnit: string           // "°", "cm⁻¹", "°C"
  yLabel: string          // "Intensity", "Counts"
  yUnit: string
  wavelength?: number     // Å，XRD/SAED 用
  anode?: string          // Cu / Co / Mo
  sourceFile?: string
}

interface Pattern {
  x: Float64Array
  y: Float64Array
  meta: PatternMeta
}

interface Dataset {
  id: string
  name: string
  raw: Pattern            // 原始数据，永不修改
  steps: Step[]           // 有序变换链
  derived: Pattern        // 由 raw + steps 重算
  notes?: string
  createdAt: string
}
```

- `derived` 永远可从 `raw + steps` 重算；撤销 = 删除/停用一步后重算，天然一致。
- 大数据使用 `Float64Array`；图表渲染时按像素桶抽稀，避免每帧遍历全部点。

### 7.2 变换步骤

```ts
type StepType =
  | 'crop' | 'resample' | 'smooth' | 'background'
  | 'kalpha2' | 'normalize' | 'jade-map' | 'custom-affine'

interface Step<P = Record<string, unknown>> {
  id: string
  type: StepType
  enabled: boolean
  params: P
  invertible: boolean
  createdAt: string
}
```

每个步骤在 `core/pipeline/steps.ts` 注册：

```ts
interface StepDefinition<P> {
  type: StepType
  label: string
  description: string
  invertible: boolean
  defaults: P
  apply(input: Pattern, params: P): Pattern
  invert?(input: Pattern, params: P): Pattern
  describe(params: P): string          // 账本中的人类可读摘要
  validate?(params: P): Issue[]
}
```

### 7.3 配方（Recipe）

配方是「如何把原始数据变成 Jade 输入」的完整、可复现描述，可单独下载/加载：

```json
{
  "schema": "crystaltoolbox/recipe@1",
  "name": "raman-2026-10-23",
  "createdAt": "2026-10-23T00:00:00+08:00",
  "source": {
    "file": "sample.txt",
    "xLabel": "Raman shift", "xUnit": "cm⁻¹",
    "yLabel": "Intensity", "yUnit": "a.u."
  },
  "steps": [
    { "type": "crop", "params": { "xMin": 100, "xMax": 2000 } },
    { "type": "smooth", "params": { "method": "sg", "window": 11, "order": 3 } },
    { "type": "background", "params": { "method": "snip", "iterations": 40 } },
    {
      "type": "jade-map",
      "params": {
        "mode": "affine",
        "xScale": 0.0701053, "xOffset": -6.01053,
        "yScale": 2.5, "yOffset": 0.5,
        "jade": { "x0": 1, "step": 0.0701, "n": 1901 }
      }
    }
  ],
  "checksum": "sha256:…"
}
```

- `jade-map` 的 `xScale/xOffset/yScale/yOffset` 保留 12 位有效数字，保证反算精度。
- `checksum` 对原始数据与步骤序列做哈希，用于「配方与数据是否匹配」提示。
- 配方可嵌入 DIF→XY 页面，一键把拟合曲线还原到原始坐标。

---

## 8. 数据管线与逆处理

### 8.1 前向流程

```
导入 ──► 解析报告 ──► 裁剪/重采样 ──► 平滑/扣背底 ──► 归一化/映射
                                                          │
                                          Jade 兼容性检查 ◄┘
                                                          │
                                         导出 .xy + recipe ──► MDI Jade
```

### 8.2 Jade 坐标映射

Jade 的硬约束：`0 < x < 140`，`y > 0`。映射模式：

| 模式 | X 变换 | Y 变换 | 用途 |
|---|---|---|---|
| 衍射数据（默认） | 保持 2θ，超出部分裁剪/压缩 | 负值截断到 `yMin`（默认 0.5） | XRD、SAED 2θ 谱 |
| 非衍射（笔记预设） | 线性映射到 `[0, 100]` | 线性映射到 `[0, 10000]` | Raman、FTIR、TGA |
| 安全区间 | 线性映射到 `[1, 139]` | 线性映射到 `[0.5, 10000]` | 需要留边距时 |
| 自定义仿射 | `x' = a·x + b` | `y' = c·y + d` | 其他 |

通用仿射：

```
x' = xScale · x + xOffset
y' = yScale · y + yOffset
```

反算：

```
x = (x' − xOffset) / xScale
y = (y' − yOffset) / yScale
```

**舍入策略**：X 输出 6 位小数，Y 输出 4 位小数；反算误差在 1e-6 量级，远小于
Jade 的峰位精度。界面实时显示「反算最大误差」估计。

**Y 正性**：若数据含负值，先统计 `min(y)`；`yMin` 默认 0.5，可选 1/10。若用户选择
`yMin = 0.5` 且 `max(y) = 5000`，则 `yScale ≈ 10000/5000`，`yOffset ≈ 0.5`。
界面会提示「该映射把动态范围压缩/放大了 N 倍」。

### 8.3 逆处理

逆处理有三个入口，共享同一套 `inverse.ts`：

1. **步骤撤销**：在账本中停用/删除某步，`derived` 从 `raw` 重算。
2. **曲线反算**：加载 DIF/XY + recipe，把整条曲线映射回原始物理量。
3. **峰表反算**：对拟合得到的峰位/峰宽/峰面积做标量反算
   （峰位用 X 逆映射，峰宽乘 `1/|xScale|`，面积乘 `1/|yScale·xScale|`）。

> 平滑、扣背底、Kα2 剥离属于**信息损失**步骤：可由原始数据重算，但无法从结果精确还原。
> 账本中用琥珀色徽章标注，并在导出配方中记录，提示用户保留原始文件。

### 8.4 DIF 解析（基于实测）

`tmp/DEMO06.dif` 的实测结构：

```
10/20/26 10:16  FIT Red Paint Pigment Mixture          ← 第 1 行：日期 时间 模式 标题
 20  0.02  4 Cu 1.54056  78  2901 (Raw Pattern)        ← 参数行
 372  403  384  390  429  418  460  401                ← Y 值，每行 8 个
 ...
 20  0.02  4 Cu 1.54056  78  2901 (Background)         ← 下一块
 ...
 23.18  0.02  4 Cu 1.54056  29.12  298 (Fitted Profile 1)
 ...
 20  0.02  4 Cu 1.54056  78  2901 (Overall Profile)
```

解析规则：

- 参数行正则（容错）：`start step flag anode wavelength end npoints (name)`；
  `flag` 字段在不同版本中含义不明，按可选项处理，不参与计算。
- 每个块用自己的 `start/step/npoints` 生成 X 轴；**不能假设所有块同网格**。
- 块角色由名称关键字识别：`raw`、`background`、`fitted profile`、`overall`；无法识别时
  按顺序保留为用户可命名的曲线。
- 检验 `npoints` 与实际读入的 Y 值个数；不一致时给出警告并截断/补零（默认截断）。
- 合成曲线：`Overall Profile` 视为「背底 + 各拟合峰」；差值曲线 = `Raw − Overall`。
- 子区间块（如 Fitted Profile 1 覆盖 23.18–29.12）在合成到公共网格时，区间外置 0，
  并在导出说明中注明。

### 8.5 DIF → XY 导出形态

| 形态 | 列 | 适用 |
|---|---|---|
| Origin 宽表 | `X, Raw, Background, Overall, Diff, Fit1…FitN` | 一次导入 Origin，逐列绘图 |
| 堆叠长表 | 空行分隔的若干 `X Y` 段 | Origin 的 Stacked Lines |
| 仅差值 | `X, Diff` | 快速查看拟合质量 |
| Bragg 位置 | `2θ, d, hkl, I` | Rietveld/指标化辅助（若 DIF 含峰表则解析） |

导出时可选：
- 应用 recipe 反算到原始坐标；
- 将 X 从 2θ 转为 `1/d`（布拉格公式），便于不同靶材/同步辐射/电子衍射对比；
- 表头注释开关（`#` 开头，Origin 可识别；Jade 导入时建议关闭）。

### 8.6 数据检查规则

| 检查 | 级别 | 处理 |
|---|---|---|
| 非有限值（NaN/Inf） | error | 拒绝导出，提供「删除该点/线性插值」 |
| x 非单调 | error | 提供排序、去重 |
| x 超出 (0,140) | error | 提供裁剪/仿射映射 |
| y ≤ 0 | error | 提供整体平移、截断 |
| 重复 x | warning | 保留均值/首个 |
| 步长不均匀 | warning | 重采样到均匀网格 |
| 点数 > 200k | warning | 抽稀/分段 |
| 文本编码非 UTF-8 | info | 尝试 GBK 提示（浏览器无内置 GBK 解码时可提示另存） |

---

## 9. 晶体学计算内核

### 9.1 晶格与倒易晶格

实空间基矢 `a, b, c`，夹角 `α, β, γ`。度规张量：

```
G = [ a²        ab·cosγ   ac·cosβ
      ab·cosγ   b²        bc·cosα
      ac·cosβ   bc·cosα   c²      ]
V = √det(G)
G* = G⁻¹
```

倒易参数（与笔记公式一致）：

```
a* = bc·sinα / V        cosα* = (cosβ·cosγ − cosα) / (sinβ·sinγ)
b* = ac·sinβ / V        cosβ* = (cosα·cosγ − cosβ) / (sinα·sinγ)
c* = ab·sinγ / V        cosγ* = (cosα·cosβ − cosγ) / (sinα·sinβ)
```

晶面间距（任意晶系）：

```
1/d² = h²a*² + k²b*² + l²c*²
     + 2hk·a*b*·cosγ* + 2hl·a*c*·cosβ* + 2kl·b*c*·cosα*
```

两晶面夹角：

```
cosθ = (h₁G*h₂ᵀ) / (√(h₁G*h₁ᵀ) · √(h₂G*h₂ᵀ))
```

两晶向夹角：

```
cosφ = (u₁Gu₂ᵀ) / (√(u₁Gu₁ᵀ) · √(u₂Gu₂ᵀ))
```

### 9.2 晶带与带轴

- 晶带方程：`hu + kv + lw = 0`（零阶劳厄带 ZOLZ）。
- 两晶面 `(h₁k₁l₁)`、`(h₂k₂l₂)` 的交线即带轴：

```
[u v w] = [h₁ k₁ l₁] × [h₂ k₂ l₂]
```

结果按最大公约数约化为互质整数；若叉积为零向量则两晶面平行，给出提示。

- 给定带轴，枚举 `|h|,|k|,|l| ≤ N` 且满足晶带方程的晶面；按 `|g| = 1/d` 排序。

### 9.3 二维倒易面（对应笔记步骤）

笔记中的手工步骤是「取倒数 → 最小整数比 → 截点 → 过原点 → 两个基矢」。程序采用
等价但更稳健的整数零空间方法：

1. 求整数向量 `b₁, b₂`，使 `bᵢ · (u,v,w) = 0`（即 `u·h + v·k + w·l = 0`）。
2. 对 `b₁, b₂` 做二维格点约化（Lagrange–Gauss），得到最短、夹角接近 90° 的基矢。
3. 以 `g₁, g₂` 的模长与夹角建立二维笛卡尔坐标：
   `r(i,j) = i·g₁ + j·g₂`，其中 `g₁ = (|g₁|, 0)`，`g₂ = (|g₂|cosθ, |g₂|sinθ)`。
4. 枚举 `i, j`，去重，得到倒易面网格；每个点标注 `(hkl)`、`d`、`|g|`。
5. 有原子数据时叠加 `|F(hkl)|²` 作为强度。

该算法自动覆盖笔记中的「含 0 带轴」特例（如 `[1 0 2]`），无需手工设未知截距。

### 9.4 结构因子

```
F(hkl) = Σⱼ fⱼ(s) · occⱼ · exp(−Bⱼ·s²) · exp[2πi(hxⱼ + kyⱼ + lzⱼ)]
s = sinθ/λ = |g|/2
I ∝ |F|²
```

- `fⱼ(s)`：Cromer–Mann 参数化 `f = Σ aᵢ exp(−bᵢ s²) + c`。
- `Bⱼ`：各向同性温度因子（可选，默认 0）。
- 粉末强度还需乘多重度 `m`、洛伦兹-偏振因子 `LP = (1 + cos²2θ)/(sin²θ·cosθ)`、
  以及可选的择优取向修正。
- 消光：由空间群/点阵类型判定（P/I/F/C/A/B/R 及螺旋轴、滑移面条件）；至少实现
  面心/体心/底心与常见空间群条件。

### 9.5 带轴电子衍射（SAED）

- 电子波长（相对论修正）：

```
λ = h / √(2meV(1 + eV/(2mc²)))
```

  200 kV ≈ 0.02508 Å；100 kV ≈ 0.03701 Å；300 kV ≈ 0.01969 Å。

- 斑点位置：倒易矢量 `g` 在二维倒易面上的投影；相机常数 `Lλ`，屏幕上
  `R = Lλ / d = Lλ·|g|`。
- 强度：`I ∝ |F|²`（运动学近似），可按 `√I` 映射为斑点半径；提供线性/对数/等大三种模式。
- 显示：中心透射斑、指数标注、比例尺、水平/垂直参考线、可选 ±g 对称显示。
- 标定辅助：已知 `R` 与 `d` 求 `Lλ`；已知 `Lλ` 求未知 `d`。

### 9.6 XRD 理论谱

```
2θ = 2·arcsin(λ / (2d))
I(hkl) = m · |F|² · LP · A(θ)
```

峰型：高斯 / 洛伦兹 / 伪 Voigt；FWHM 可由 Caglioti 公式
`FWHM² = U·tan²θ + V·tanθ + W` 给出，也可叠加 Scherrer 尺寸展宽与微应变展宽。
输出可直接导出为 Jade 可读 `.xy`，与实验数据同图对比。

### 9.7 峰分析（P1）

- Scherrer：`D = Kλ / (β·cosθ)`，`K` 默认 0.9，`β` 用弧度。
- Williamson–Hall：`β·cosθ = Kλ/D + 4ε·sinθ`，线性拟合截距/斜率求 `D`、`ε`。
- 峰位最小二乘：由多个 `2θ` 与指标精修晶格参数（仅正交/四方/立方/六方先做）。

---

## 10. 文件格式规范

### 10.1 Jade XY（`.xy`）

```
20.000000   372
20.020000   403
...
```

- ASCII/UTF-8 无 BOM；两列空白分隔；行尾 CRLF（Windows 版 Jade 更稳）。
- `0 < x < 140`，`y > 0`；x 单调递增；建议点数 ≤ 200k。
- 不带表头（Jade 对表头兼容性差）；元数据写入同名 `.recipe.json`。
- 可选导出 `.csv`（带表头）供 Excel/Origin 使用。

### 10.2 Jade DIF（`.dif`）

见 8.4。解析器需容忍：

- 第一行非标准（日期格式、缺少模式字段）；
- 参数行前有空格、字段间多空格、名称含中文/括号；
- 拟合峰块范围不同；
- Y 值每行个数不固定（按空白切分）；
- 文件末尾空行/缺行。

### 10.3 配方（`.recipe.json`）

`schema: crystaltoolbox/recipe@1`；字段见 7.3。加载时校验 schema、步骤类型与参数范围；
未知步骤类型给出警告并跳过（前向兼容）。

### 10.4 工程文件（`.xtalbox.json`）

包含数据集（原始数据以 base64 编码的 Float64Array 或紧凑数字数组）、步骤、界面状态、
版本号。用于备份与跨设备迁移；自动保存使用 IndexedDB，不写入 localStorage（容量限制）。

### 10.5 SAED / 峰表 CSV

```
# CrystalToolBox SAED pattern
# zone axis: [1 1 0]  voltage: 200 kV  camera length: 800 mm
h,k,l,d_A,|g|_1A,I_rel,x_mm,y_mm
1,1,1,3.1355,0.3189,100.0,12.34,0.00
```

UTF-8 BOM 可选（Excel 中文兼容）；列名同时给出符号与单位。

---

## 11. UI / UX 设计

### 11.1 视觉方向

- **默认浅蓝—白主题**：页面底色 `#edf4fb`，内容面板 `#ffffff`，边框 `#d8e5f2`，
  主色蓝 `#2f7fc1`；顶栏为深蓝渐变 `#174f7f → #2b7fbe`，模块标签选中时为白色胶囊。
- 深色主题：页面底色 `#07121d`，面板 `#0e1e2e`，边框 `#213b54`，主色亮蓝 `#5aa9e6`；
  两套主题共用同一组设计令牌。
- 侧栏：浅蓝渐变模块头 + 页面列表，选中项左侧 3 px 模块色指示条。
- 数字使用等宽字体（`ui-monospace, "JetBrains Mono", Consolas`），启用
  `font-variant-numeric: tabular-nums`。
- 图表配色：实测（青）、拟合（琥珀）、背底（灰紫）、差值（玫红）；色盲友好，
  同时用线型/标记区分。
- 动效克制：150–200 ms 过渡；尊重 `prefers-reduced-motion`。

### 11.2 关键交互

- **导入**：整页拖拽、点击选择、粘贴文本三入口；解析后立即显示「解析报告」与曲线，
  可切换列映射并实时预览。
- **步骤账本**：时间线式列表，每步显示摘要、参数、可逆性；拖拽排序；开关即时重算。
- **图表**：滚轮缩放、拖拽平移、双击复位、十字线读数、框选放大、峰位吸附；
  右键菜单（复制坐标、添加标注、导出选区）。
- **参数输入**：数值框支持表达式（`2*3.1416`、`1/3`）与单位后缀；非法值即时红框 +
  说明，不阻塞其他输入。
- **导出**：先预览文件名/大小/校验结果，再下载；成功后提供「打开所在文件夹」提示
  （浏览器限制下改为再次下载与复制路径）。
- **空状态**：每个工具提供「加载示例」按钮，示例数据随站点打包。
- **快捷键**：`Ctrl/Cmd+K` 命令面板；`?` 快捷键帮助；`Ctrl/Cmd+S` 导出工程；
  `Ctrl/Cmd+Z` 撤销步骤。
- **可访问性**：所有图表提供表格视图与 `aria-label`；键盘可达；对比度 ≥ 4.5:1。

### 11.3 响应式

- ≥1500 px：三栏工作台（配置 / 可视化 / 检查器）。
- 1180–1499 px：右栏移到主内容下方，配置与可视化并排。
- <1180 px：单栏，配置面板在可视化上方。
- <900 px：顶栏分为品牌行与模块标签行；侧栏变为全高抽屉；图表高度自适应；表格横向滚动。

---

## 12. 文档系统

### 12.1 结构

```
docs/
├─ userguide/          # 用户指南
│  ├─ getting-started.md
│  ├─ interface.md
│  ├─ data-import.md
│  ├─ preprocessing.md
│  ├─ jade-export.md
│  ├─ dif-to-xy.md
│  ├─ reciprocal.md
│  ├─ saed.md
│  ├─ xrd.md
│  ├─ projects.md
│  └─ faq.md
├─ cookbook/           # 实战手册（任务导向）
│  ├─ raman-to-jade.md
│  ├─ xrd-peak-fitting.md
│  ├─ saed-indexing.md
│  ├─ compare-wavelengths.md
│  ├─ scherrer.md
│  ├─ rietveld-origin.md
│  └─ ...
├─ reference/          # 功能说明 + 格式规范
│  ├─ tools.md
│  ├─ file-formats.md
│  ├─ formulas.md
│  ├─ glossary.md
│  └─ changelog.md
├─ dev/                # 开发文档
│  ├─ architecture.md
│  ├─ adding-a-tool.md
│  ├─ adding-an-importer.md
│  ├─ testing.md
│  └─ deployment.md
└─ design/
   └─ overview.md      # 本文件
```

### 12.2 渲染与导航

- 构建时通过 `import.meta.glob('../../docs/**/*.md', { query: '?raw' })` 懒加载。
- 文档清单 `src/docs/manifest.ts` 显式定义分组、顺序、标题、摘要、关键词，保证导航稳定。
- 渲染管线：front-matter（可选）→ markdown-it → 标题锚点 → KaTeX → 代码高亮/复制按钮 →
  自定义容器（提示/警告/公式推导）→ 相对链接改写（指向站内文档路由）。
- 右侧 TOC 随滚动高亮；顶部搜索框对「标题 + 关键词 + 正文摘要索引」做本地检索；
  搜索结果高亮并跳转到锚点。
- 每篇文档底部：「在 GitHub 编辑」「上一篇/下一篇」「反馈问题」。
- 每个工具页右上角「文档」按钮深链到对应 `reference/tools.md#<tool-id>`。

### 12.3 写作规范

- 中文为主，术语首次出现给出英文；公式使用 KaTeX，变量与单位遵循课程笔记。
- 每篇文档固定结构：**适用场景 → 前置条件 → 操作步骤 → 结果解读 → 常见问题**。
- cookbook 必须包含：可复现的示例数据、期望结果（数值/截图）、失败排查。
- reference 必须包含：输入/输出、参数表、公式、边界条件、相关文件格式、版本差异。
- 文档中的截图使用 `public/docs/` 下的 WebP，提供 `alt` 与图注。

---

## 13. 扩展机制

### 13.1 工具注册表

```ts
// src/router/tools.ts
export interface ToolMeta {
  id: string
  title: string
  subtitle: string
  group: 'workspace' | 'data' | 'crystal'
  path: string
  icon: Component
  status?: 'stable' | 'beta' | 'planned'
  doc?: string
  component: () => Promise<Component>
}

export const tools: ToolMeta[] = [ /* … */ ]
```

路由、侧栏页面、首页卡片与全局搜索由 `tools` / `config/navigation.ts` 生成；新增工具只改注册表。

### 13.2 导入器 / 导出器

```ts
interface Importer {
  id: string
  label: string
  extensions: string[]
  sniff(file: File, head: string): number       // 0–1 置信度
  parse(file: File): Promise<ParseResult>       // 数据 + 警告 + 元数据
}
```

导入器按置信度排序，用户可手动覆盖。导出器类似，接收 `Pattern` 与选项，返回
`{ filename, mime, content }`。

### 13.3 变换步骤

见 7.2。新增步骤 = 实现 `StepDefinition` + 在 `steps.ts` 注册 + 补一篇 reference +
一个往返测试。

### 13.4 schema 版本与迁移

- 所有持久化 JSON 带 `schema` 字段；加载时按版本迁移（`migrations/`）。
- 未知字段保留（向前兼容）；未知步骤类型跳过并警告（向后兼容）。

### 13.5 未来接入点

- Web Worker：SAED/XRD 大范围枚举、批量峰拟合。
- PWA：离线缓存、文件处理关联。
- CLI/Node 复用：`core/` 纯函数可直接被脚本调用（批量转换）。
- 插件包：`@crystaltoolbox/plugin-*` 形式动态加载（P3）。

---

## 14. 测试、质量与性能

### 14.1 单元测试重点

| 模块 | 用例 |
|---|---|
| 晶格 | Si `a=5.431` 的 `d(111)=3.1355`、`d(220)=1.9201`；锐钛矿 `d(101)=3.520`；Mg `d(002)=2.6205` |
| 夹角 | 立方 `(100)`–`(111)=54.7356°`；六方基面与柱面夹角 |
| 晶带 | `(100)×(010)=[001]`；`[421]` 带轴内枚举结果与手算一致 |
| 结构因子 | NaCl：全奇/全偶/混合的三种取值；金刚石消光；Si 111 vs 222 |
| 散射因子 | 与 ITC 表对照若干元素/角度 |
| DIF | `DEMO06.dif`：6 块、点数 2901/298/303/112、首末值、差值曲线 |
| 管线 | 每个可逆步骤 `invert(apply(x)) ≈ x`；Jade 映射往返误差 < 1e-6 |
| CIF | 金红石/锐钛矿/NaCl 解析后的原子数与占位 |
| 导出 | XY 行数、格式、X/Y 范围、CRLF |
| 文档 | 清单中的每篇文件存在；内部链接可解析 |

### 14.2 质量门槛

- `yarn type-check`、`yarn lint`、`yarn test:unit run` 全绿方可合并。
- 核心 `core/` 覆盖率目标 ≥ 80%（语句）。
- 构建体积：首屏 JS ≤ 350 KB（gzip），Three.js/文档按需加载。
- Lighthouse：性能/可访问性 ≥ 90（桌面）。

### 14.3 性能

- 图表抽稀：按像素桶保留 min/max，10 万点仍可 60 fps 交互。
- SAED 枚举上限默认 `|h|,|k|,|l| ≤ 12`，可调；单次计算 < 50 ms。
- 大文件解析在 `FileReader` 分块 + 字符串切分，必要时移入 Worker。
- 文档懒加载；示例数据按需 fetch。

---

## 15. 部署与 CI

```yaml
# .github/workflows/deploy.yml（示意）
on:
  push: { branches: [main] }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: yarn }
      - run: yarn install --frozen-lockfile
      - run: yarn test:unit run
      - run: yarn build
        env: { VITE_BASE_PATH: / }
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    permissions: { pages: write, id-token: write }
    environment: github-pages
    steps:
      - uses: actions/deploy-pages@v4
```

- `vite.config.ts` 读取 `VITE_BASE_PATH`，默认 `/`；本项目使用自定义域名根路径，因此设为 `/`。
- 使用 hash 路由，无需 404 回退；仍生成 `404.html` 作为兜底。
- 自定义域名：`public/CNAME`（按需），文档给出 DNS 配置说明。
- 版本号显示在关于页与状态栏；构建时注入 `__APP_VERSION__`。

---

## 16. 里程碑

| 阶段 | 内容 | 交付物 |
|---|---|---|
| M0 | 设计评审（本文件） | 设计文档 + 问题清单 |
| M1 | 工程脚手架、设计令牌、应用外壳、路由、文档引擎 | 可运行的站点骨架 + 文档中心 |
| M2 | 数据管线、Jade 导出、DIF→XY（含 DEMO06 测试） | 需求 1、2 可用 |
| M3 | 倒易空间、SAED、XRD 模拟 | 需求 3 可用 |
| M4 | CIF 导入、3D 晶胞、峰分析（若纳入首版） | 结构闭环 |
| M5 | 文档内容、测试、性能、可访问性、部署 | 上线版本 |

每个里程碑结束都要求：构建通过、测试通过、文档同步更新、截图/演示可用。

---

## 17. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| Jade DIF/XY 版本差异 | 解析失败/数据错位 | 基于实测样本 + 容错正则 + 导入报告 + 用户可手动指定字段；征集更多样本 |
| 散射因子/空间群数据版权与准确性 | 计算结果不可信 | 使用公开的 ITC 参数并注明来源；单元测试对照已知结构因子 |
| 非衍射数据映射后反算误差 | 峰位/面积偏差 | 12 位系数 + 6 位小数导出 + 实时误差显示；禁止静默裁剪 |
| 大文件导致页面卡顿 | 体验差 | Float64Array + 抽稀 + Worker + 分块解析 |
| 浏览器字体/公式渲染差异 | 排版不一致 | 自托管 KaTeX 字体；CJK 使用系统字体栈 |
| GitHub Pages 子路径 | 静态资源 404 | `VITE_BASE_PATH` + hash 路由 + CI 校验 |
| 功能蔓延 | 延期 | P0/P1/P2 分级，里程碑验收 |

---

## 18. 评审结论（2026-10-23）

| 问题 | 结论 |
|---|---|
| 首版范围 | **A · 标准版**：三大功能 + 倒易空间 + SAED + XRD + CIF 导入；3D 晶胞留到 v1.1 |
| 默认主题 | 浅蓝—白，可切换深色；两套主题均已实现 |
| 文档语言 | 中文为主，术语中英对照；共 29 篇，含用户指南/实战/参考/开发 |
| 部署 | GitHub Pages：仓库 `lanshuye123/NanoHelper`，自定义域名 `nano.jamaccao.cn`，由 `.github/workflows/deploy.yml` 自动发布 |
| 样例数据 | 使用用户提供的 `DEMO06.dif`；其余用可复现的合成数据 |

### 实现状态（v0.1.0）

- ✅ 数据导入、步骤账本、Jade 映射、`recipe.json`、`.xtalbox.json`；
- ✅ Jade 兼容性检查、`.xy` 导出；
- ✅ DIF 多块解析、Origin 多列导出、Rp、配方反算、1/d；
- ✅ 倒易空间、晶带、二维倒易面、SAED、XRD、CIF、Scherrer/W–H；
- ✅ 文档中心、搜索、KaTeX、深浅主题、移动端；
- ✅ 72 个单元测试、生产构建验证；
- ✅ 自动保存；⏳ 3D 晶胞、批量处理、PWA（后续版本）。

### 与初稿的差异

- 初稿计划 12 位系数，实现使用 10 位有效数字（反算误差仍远小于峰位精度）；
- 非衍射映射的 Y 下限由 0 改为 0.5，以满足 Jade 的严格正性；
- 新增 `.xtalbox.json` 工程文件；
- 文档从 4 类扩展为 29 篇。

---

*本设计将随实现迭代；变更记录见 `docs/reference/changelog.md`。*
