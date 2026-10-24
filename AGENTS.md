# AGENTS.md

本文件是 CrystalToolBox 的 AI 协作治理约束。任何自动化代理、外包开发者或 AI 助手修改本仓库时，都必须先阅读并遵守本文件。

## Commands

- 安装：`npm install`
- 开发：`npm run dev`
- 类型检查：`npm run type-check`
- 单元测试：`npm run test:unit`
- 生产构建：`npm run build`
- 同步三维晶胞构建产物：`npm run embed:cryviewer`

完成任何任务前，必须至少通过 `npm run type-check`、`npm run test:unit` 与 `npm run build`。

## Project overview

CrystalToolBox 是面向纳米材料、晶体学与电子显微分析课程/科研的浏览器端分析工具箱。核心算法在 `src/core/`，页面在 `src/views/`，工具注册表在 `src/tools/registry.ts`，界面文案与文档清单分别在 `src/config/navigation.ts`、`src/docs/manifest.ts`。

## 最终界面文案治理（强制命令）

**最终用户不是计算机科班出身。界面只说用户要解决的问题、要做的操作、要理解的结果；不解释软件是怎么做出来的。**

以下内容**绝对禁止**出现在最终界面（`src/views/`、`src/components/`、导航、状态栏、首页、关于页、按钮、提示、空状态、错误信息、工具提示、`aria-label` 等所有用户可见/可听到的文案）：

1. **实现与部署术语**：iframe、同源、静态构建、构建产物、`public/...`、hash 路由、Canvas、Vue、Vite、Pinia、TypeScript、KaTeX、spglib、pyxtal、localStorage、DOM、API、CDN、bundle、组件、渲染、部署、路径、文件系统、服务器、浏览器本地解析、画布、剪贴板等。
2. **以技术为卖点的口号**：本地运行、数据不上传、不会上传、数据不离开电脑、纯前端、无后端、无账号、浏览器本地计算、离线可用、100% 本地、无需安装、静态站点等。
3. **调试/实现说明**：为什么这样实现、数据放在哪个目录、如何构建、如何嵌入、如何部署、兼容性兜底、内部模块名称、开发者才知道的错误原因。
4. **面向开发者的解释**：架构、依赖、性能、缓存、路由、状态管理、打包、测试等。

允许并鼓励：

- 领域语言：XRD、SAED、晶胞、晶面、晶带、标尺、粒径、分布、空间群、Wyckoff、衬度传递函数、相机常数等；
- 操作指引、单位、误差、适用范围、结果解释、导出建议；
- 必要的科学方法名、文件格式名（CIF、XY、DIF 等）；
- 面向用户的问题排查：例如“图片无法打开，请转换为 PNG 或 JPEG”。

**技术细节只能出现在 `README.md`、`docs/`、`AGENTS.md`、代码注释与开发文档中，不能进入最终界面。** 文档可以技术化，界面不可以。

### 界面文案验收清单

- [ ] 新增/修改界面时，先写“用户要做什么”，再写实现；
- [ ] `tests/ui-copy.spec.ts` 通过（自动扫描禁用短语）；
- [ ] 全量搜索 `src/views`、`src/components`、`src/config/navigation.ts`，确认没有上述禁用词；
- [ ] 错误提示用用户语言描述“发生了什么、下一步怎么做”，不解释内部原因；
- [ ] 不用隐私、离线、本地运行、技术栈作为卖点；
- [ ] 技术说明放在文档，不放在界面。

## 代码约定

- 核心算法保持纯 TS，不依赖 Vue/DOM；界面只做展示与交互。
- 新增工具按 `docs/dev/adding-a-tool.md` 注册，并补齐用户指南。
- 不在界面引入网络请求；三维晶胞使用仓库内 `public/crystal-viewer/` 的静态资源。
- 注释可以使用英文；界面文案使用简体中文。
