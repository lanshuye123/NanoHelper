# CrystalToolBox · 纳米材料与晶体学工具箱

一个**纯前端、本地运行**的晶体学与衍射数据处理工具箱。面向纳米材料/晶体学课程与日常科研：

- 原始谱图 → 预处理 → 可逆坐标映射 → **MDI Jade** 可读的 `.xy`；
- Jade 拟合结果 `.dif` → **Origin** 多列数据，并按配方反算回原始坐标；
- 倒易空间、晶带、**SAED** 与 **XRD** 模拟，CIF 结构导入。

无需后端、无需账号，数据不离开浏览器。

**在线地址：<https://nano.jamaccao.cn>** · **仓库：<https://github.com/lanshuye123/NanoHelper>**

浅蓝色—白色是默认主题，同时提供深色模式：

![工作台 · 浅色](docs/screenshots/home.png)

![工作台 · 深色](docs/screenshots/home-dark.png)

## 功能

| 模块      | 内容                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------ |
| 数据处理  | 多格式导入、列映射、裁剪/重采样/平滑/扣背底/Kα2/归一化、步骤账本、Jade 兼容性检查                |
| Jade 导出 | 两列 `.xy`、`recipe.json`、工程文件 `.xtalbox.json`                                              |
| DIF → XY  | 多块解析（Raw/Background/Fitted/Overall）、公共网格、Origin 宽表/堆叠/差值、Rp、配方反算、1/d 轴 |
| 倒易空间  | 晶格/倒易参数、d 值、晶面/晶向夹角、晶带轴、点阵消光、二维倒易面                                 |
| 电子衍射  | 带轴 SAED、结构因子强度、相机常数标定、PNG/CSV                                                   |
| XRD       | 理论谱、多重度/LP、Kα2、峰表、Scherrer、Williamson–Hall                                          |
| 晶体结构  | CIF 解析、对称展开、密度/化学式、低角反射预览、15 个预设                                         |

## 技术栈

Vue 3 + TypeScript + Vite + Pinia + Vue Router + Element Plus；图表与衍射图为自研 Canvas；公式用 KaTeX；测试用 Vitest。核心算法位于 `src/core/`，不依赖 Vue/DOM。

## 快速开始

```bash
npm install
npm run dev        # http://127.0.0.1:5180
```

生产构建：

```bash
npm run build
npx serve dist
```

不要直接双击 `dist/index.html`：浏览器会阻止 ES module 与示例文件 `fetch`。

## 文档

- [用户指南](docs/userguide/getting-started.md)
- [实战手册](docs/cookbook/raman-to-jade.md)
- [功能说明](docs/reference/tools.md)
- [文件格式](docs/reference/file-formats.md)
- [公式与推导](docs/reference/formulas.md)
- [开发文档](docs/dev/architecture.md)

站内文档中心位于 `/#/docs/userguide/getting-started`，支持搜索、目录与上下篇。

## 目录

```text
src/
├─ core/        纯 TS：晶格、衍射、CIF、数据管线、IO
├─ components/  图表、布局、表单、文档
├─ views/       页面
├─ stores/      Pinia
├─ data/        元素、散射因子、空间群、预设
docs/           站点文档（Markdown，构建时打包）
tests/          Vitest 与固定装置
public/         示例数据、favicon
```

## 脚本

```bash
npm run dev          # 开发服务器
npm run type-check   # vue-tsc
npm run test:unit    # Vitest
npm run build        # 类型检查 + 生产构建
npm run preview      # 预览 dist
```

## 部署

推送到 `main` 会触发 `.github/workflows/deploy.yml`，构建并发布到 GitHub Pages：

- 站点：<https://nano.jamaccao.cn>
- 仓库：<https://github.com/lanshuye123/NanoHelper>
- 自定义域名：`public/CNAME` → `nano.jamaccao.cn`
- Pages 源：GitHub Actions

本地构建：

```bash
npm run build
npx serve dist
```

路由为 hash 模式，不需要 404 回退。使用其他子路径时通过 `VITE_BASE_PATH=/repo/` 覆盖。详见 [构建与部署](docs/dev/deployment.md)。

## 数据来源

- 原子散射因子：Waasmaier–Kirfel 五高斯参数化（DABAX `f0_WaasKirf.dat`，源自 International Tables for Crystallography Vol. C）。
- 空间群对称操作：230 空间群标准化数据，按晶系懒加载。
- 课程公式与约定：与《X 射线晶体学》《显微结构分析》笔记一致；倒易空间不含 2π。

## 已知限制

- 无 3D 晶胞视图（计划 v1.1）；
- SAED 为运动学近似，无 HOLZ/动力学；
- XRD 不含吸收、择优取向与仪器几何；
- 不做 Rietveld、结构解析；
- 不解析二进制厂商格式（`.brml`/`.raw`/`.mdi`）；
- 工程文件不包含晶体结构；不做自动持久化。

## 许可

代码以 MIT 许可发布；第三方数据遵循其原始许可。详见 `LICENSE`。
