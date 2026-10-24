# 三维晶胞查看器

本页嵌入 [CrystalViewer](https://crystal.jamaccao.cn/)，用于按空间群浏览三维晶胞、Wyckoff 位置与原子点位。它与本站其他工具共享「空间群」这一主题，但状态不互通。

## 为什么用内嵌

CrystalViewer 是一个独立的 Vue 3 + Three.js 应用。为了保持两边的开发和部署独立，本站把它的静态构建产物放在：

```text
public/crystal-viewer/
```

然后通过同源 iframe 嵌入。这样做的好处：

- 不引入 Three.js 到主应用的依赖树；
- 不需要复制/维护两套空间群数据加载逻辑；
- 静态构建产物随本站一起部署，断网也能用；
- CrystalViewer 可以独立升级，只需替换 `public/crystal-viewer/`。

## 使用

1. 在顶部输入空间群编号（如 `225`）或 Hermann–Mauguin 符号（如 `Fm-3m`）；
2. 在 3D 视图中拖拽旋转、滚轮缩放、右键平移；
3. 右侧查看 Wyckoff 位置、代表坐标与等效坐标；
4. 可切换原子半径、模型类型、背景色、晶胞边框与对称元素；
5. 支持自定义原子输入与显示设置。

## 与本站工具的分工

| 场景                               | 推荐工具                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| 查空间群、看 3D 晶胞、Wyckoff 位置 | 本页（CrystalViewer）                                                              |
| CIF 导入、对称展开、密度           | [晶体结构](/docs/userguide/structure)                                              |
| 晶胞体积、Z 值、APF                | [晶胞与密度](/docs/userguide/cell)                                                 |
| 倒易空间、晶带、SAED               | [倒易空间](/docs/userguide/reciprocal) / [SAED 指标化](/docs/userguide/saed-index) |

## 离线与部署

`public/crystal-viewer/` 下的 `index.html` 使用相对路径引用 `assets/`，因此可以部署在任意子路径。CrystalViewer 重新构建后，可用 `npm run embed:cryviewer` 从 `../CryViewer/dist` 同步（也可传入路径或设置 `CRYVIEWER_DIST`）。替换构建产物时请注意：

- 保留 `index.html` 中的相对路径（`./assets/...`）；
- 不要提交 CryViewer 的 `CNAME`（本站域名不同）；
- 若主站使用 `VITE_BASE_PATH`，iframe 地址会自动带上 `BASE_URL`。

## 限制

- 内嵌应用保留自己的顶栏，不能与主站主题完全融合；
- 若浏览器阻止第三方 iframe（例如某些隐私插件），请使用「新窗口」；
- 内嵌应用的设置不会同步到本站其他工具；
- 本站不修改 CrystalViewer 的数据与算法。

## 相关文档

- [晶体结构](/docs/userguide/structure)
- [晶胞与密度](/docs/userguide/cell)
- [空间群与对称](/docs/reference/glossary)
