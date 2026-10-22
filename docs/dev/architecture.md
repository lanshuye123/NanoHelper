# 架构

## 技术栈

| 层 | 选择 |
|---|---|
| 框架 | Vue 3.5 + TypeScript（strict） |
| 构建 | Vite 8 |
| 状态 | Pinia |
| 路由 | Vue Router（hash 模式） |
| UI | Element Plus（定制主题） |
| 图表 | 自研 Canvas（`SciChart`、`DiffractionCanvas`） |
| 公式 | KaTeX |
| 文档 | markdown-it + 自定义容器 + KaTeX |
| 测试 | Vitest |
| 部署 | 任意静态托管（构建产物 `dist/`） |

## 分层

```text
views/          页面组合
components/     通用组件（图表、面板、表单、文档）
stores/         Pinia：project / structure / settings
core/           纯 TypeScript，无 Vue/DOM
  ├─ math/            向量、矩阵、指数
  ├─ lattice/         晶格、倒易、晶带、二维倒易面
  ├─ diffraction/     散射因子、结构因子、SAED、XRD、峰型
  ├─ crystallography/ CIF、对称操作、结构构建
  ├─ io/              导入器、DIF、XY、XRDML、导出
  ├─ pipeline/        步骤、映射、校验、配方
  ├─ num/             插值、平滑、背底、峰分析
  ├─ project/         工程文件
  └─ data/            空间群加载
data/           预设结构、示例数据生成
docs/           站点文档（Markdown）
```

**硬约束**：`core/` 不 import Vue、不访问 `window`。这样核心算法可在 Vitest、Worker 或未来的 Node CLI 中复用。

## 数据流

```text
导入 → Pattern { x: Float64Array, y: Float64Array, meta }
       │
       ▼
project.raw（只读）+ steps[]
       │  applyPipeline()
       ▼
project.derived（当前结果）+ resolved（解析后的映射系数）
       │
       ├─ SciChart 显示
       ├─ validateForJade
       ├─ buildRecipe
       └─ buildXy
```

- `computed` 负责派生；步骤变化时 Vue 自动重算。
- 步骤 `resolve()` 把「模式」解析成具体仿射系数（`jade-map`），解析结果同时用于导出配方。
- 失败步骤不会中断整条链，而是记录到 `issues` 并跳过。

## 状态

### project store

- `raw`：`shallowRef<Pattern>`，避免 Vue 深度代理 `Float64Array`；
- `steps`：`ref<Step[]>`；
- `derived`、`issues`、`jadeMapping` 为 computed；
- `undo/redo` 保存步骤快照（最多 60 条）；
- `exportProject/importProject` 序列化原始数据与步骤。

### structure store

- 当前结构在 SAED/XRD/结构页之间共享；
- `loadPreset/setStructure` 更新结构、标签、警告；
- 结构是对外可变的响应式对象，页面直接编辑晶胞参数。

### settings store

- 主题、侧栏收起、移动端抽屉；
- 写入 `localStorage`，不涉及数据。

## 渲染

### SciChart

- 单 Canvas，按 `devicePixelRatio` 缩放；
- 坐标变换、刻度（1/2/5×10ⁿ）、网格、图例、标记；
- 大数据按像素桶做 min/max 抽稀；
- 交互：滚轮缩放 X、Alt/⌘+滚轮缩放 Y、拖拽平移、双击复位、十字线提示；
- 导出：1600×900、2× DPR 的离屏 Canvas。

### DiffractionCanvas

- 以 (000) 为中心的极坐标式布局；
- 斑点大小由相对强度映射；
- 标签碰撞检测；
- 比例尺、鼠标命中、PNG 导出。

### 文档

- `import.meta.glob('../../docs/**/*.md', { query: '?raw' })` 懒加载；
- `manifest.ts` 定义分组、顺序、标题、关键词；
- `render.ts` 处理标题 ID、KaTeX、代码块、callout、链接改写；
- hash 路由下，站内链接改写为 `#/...`，锚点由组件拦截滚动。

## 目录与命名

- 页面：`src/views/*View.vue`；
- 通用组件：`src/components/<domain>/`；
- 核心算法：`src/core/<domain>/`，文件用 camelCase；
- 测试：`tests/*.spec.ts`，固定装置在 `tests/fixtures/`；
- 文档：`docs/<section>/<slug>.md`，与 `manifest.ts` 一一对应。

## 性能

- `Float64Array` 存储数据；
- 图表抽稀；
- 空间群按晶系动态 import；
- 文档按需加载；
- Element Plus 全量引入（首版优先稳定，后续可按需）；
- 大范围 SAED/XRD 枚举有上限（默认 60），并在 UI 提示。

## 可访问性

- 图表有数值提示与表格替代；
- 所有图标按钮有 `title`；
- 颜色之外还用线型/标记区分曲线；
- 支持 `prefers-reduced-motion`；
- 键盘可达的表单与对话框。

## 扩展点

1. **工具**：`src/tools/registry.ts` + `views/` + `docs/manifest.ts`；
2. **导入器**：`services/importData.ts` 或 `core/io/`；
3. **步骤**：`core/pipeline/steps.ts` 注册；
4. **导出器**：`core/io/xy.ts` / `core/io/dif.ts`；
5. **数据**：`src/data/`（元素、散射因子、空间群、预设）。

详见 [新增一个工具](/docs/dev/adding-a-tool)。
