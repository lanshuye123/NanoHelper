# 版本记录

## v0.1.0 — 2026-10-23

首个可用版本。

### 数据处理

- 通用文本/CSV/TSV/XY/DAT/ASC 导入，自动分隔符与表头嗅探；
- UTF-8 / GBK 编码回退；
- 多列文件列映射；
- Jade DIF 导入（Raw 曲线）；
- PANalytical XRDML 解析；
- 步骤账本：裁剪、重采样、滑动平均、Savitzky–Golay、SNIP/锚点背底、Rachinger Kα2、归一化、Jade 映射、自定义仿射；
- 可逆映射与逆变换；
- Jade 兼容性检查（X 范围、Y 正性、单调、NaN、步长、点数）；
- `.xy` 导出（CRLF、小数位可调）；
- `recipe.json` 导出；
- `.xtalbox.json` 工程保存/打开。

### DIF → XY

- 多块 DIF 解析（Raw/Background/Fitted Profile/Overall）；
- 不同范围块插值到公共网格；
- Origin 宽表/堆叠/仅差值/单曲线；
- CSV 与空白分隔；
- 2θ → 1/d；
- 无权重 Rp；
- 配方反算。

### 晶体学

- 晶格/倒易/体积/倒易参数；
- d 值、晶面/晶向夹角、晶面-晶向夹角；
- 晶带轴、带内晶面、点阵消光；
- 二维倒易面（整数零空间 + Gauss 约化）；
- 结构因子、Waasmaier–Kirfel 散射因子、Friedel 对；
- CIF 解析、对称展开、密度/化学式；
- 带轴 SAED 模拟、相机常数标定、CSV/PNG；
- XRD 理论谱、多重度/LP、Kα2、峰表、Scherrer、Williamson–Hall；
- 15 个预设结构。

### 站点

- 深色/浅色主题；
- 自研 Canvas 曲线与衍射图；
- 文档中心：用户指南、实战手册、功能说明、开发文档；
- KaTeX 公式、站内搜索、目录、上下篇；
- 移动端响应式；
- 纯静态构建，无后端。

### 已知限制

- 无 3D 晶胞视图；
- 不做 Rietveld/结构解析；
- 不解析二进制厂商格式（`.brml`、`.raw`、`.mdi`）；
- 不做自动持久化/最近工程；
- SAED 为运动学近似，无 HOLZ/动力学；
- XRD 不含吸收、择优取向与仪器几何；
- CIF 只支持常见子集，不做完整语法校验；
- 工程文件不含晶体结构。

### 格式版本

- `crystaltoolbox/recipe@1`
- `crystaltoolbox/project@1`

### 下一版计划

- 3D 晶胞/超胞与原子配位；
- 批量处理与多数据集对比；
- 峰表导入/自动寻峰；
- 更完整的 CIF（各向异性 Uij、Cartn）；
- 仪器展宽库；
- PWA 离线安装；
- 更多文件格式。

## 版本号规则

- `0.x`：功能快速迭代，格式可能变化；
- 格式变化时必须提升 `schema` 版本并提供迁移；
- 修复与文档更新也记录在本页。
