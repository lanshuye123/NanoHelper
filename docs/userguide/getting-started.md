# 快速开始

CrystalToolBox 是一个**纯前端**的纳米材料与晶体学工具箱。它把三类常见工作流放在同一个本地工作台里：

1. 原始谱图 → 预处理 → 可逆坐标映射 → MDI Jade 可读的 `.xy`；
2. Jade 拟合结果 `.dif` → Origin 可用的多列数据，并按配方反算回原始坐标；
3. 晶格/倒易空间计算、带轴电子衍射（SAED）与 XRD 理论谱。

不需要安装、不需要账号，也不会把数据上传到任何服务器。

::: tip 五分钟路线
载入示例 **Raman · 锐钛矿** → 添加「Jade 坐标映射」→ 查看兼容性 → 导出 `.xy` → 到「Jade 导出」页下载配方。
:::

## 运行环境

- Chrome / Edge / Firefox 的较新版本（ES2022、`Float64Array`、Canvas）。
- 十万点级数据建议 4 GB 以上可用内存。
- 若使用构建产物 `dist/`，请通过静态服务器访问，而不是直接双击 `index.html`：

```bash
npx serve dist
# 或
python3 -m http.server 8000 --directory dist
```

直接以 `file://` 打开时，浏览器会阻止 ES module 与示例文件 `fetch`，页面可能空白。

## 第一次使用

### 1. 导入数据

点击顶栏 **数据处理**，在侧栏打开 **导入与预处理**。有三种入口：

- **拖入文件**：CSV、TSV、TXT、XY、DAT、DIF、XRDML、UXD；
- **粘贴文本**：从 Excel、Origin 或仪器软件复制的两列/多列文本；
- **示例数据**：XRD、Raman、TGA、FTIR 与真实 Jade DIF。

没有现成数据时，点击 **Raman · 锐钛矿** 卡片。示例 X 范围是 100–2000 cm⁻¹，包含 144、197、399、513、639 cm⁻¹ 五个特征峰。

### 2. 检查与预处理

导入后会看到曲线、数据统计与「Jade 兼容性」检查。Raman 数据最初会报错：

```text
存在 N 个 X 超出 [0,140] 的数据点
```

这是预期的：Jade 的横坐标只接受 0–140。点击 **添加处理步骤 → Jade 坐标映射**，选择 **非衍射数据：X→[0,100]**。页面会实时计算仿射系数：

$$
x' = 0.0526316\,x - 5.26316,\qquad y' = 10.6087\,y - 1429.76
$$

系数随数据范围而变，以页面显示为准。此时检查应变为绿色「格式检查通过」。

### 3. 导出给 Jade

打开 **数据处理 → Jade 导出**，确认 X 在 0–140 之间、Y 全部大于 0、步长与点数符合预期。

- 点击 **导出 .xy**：两列 ASCII 文件，CRLF，无表头；
- 点击 **配方 JSON**：记录原始元数据与全部映射系数。

把 `.xy` 拖进 Jade 即可做背底、寻峰与拟合。

### 4. 拟合之后

Jade 中拟合完成后，选择 **File → Save → DIF**。回到 **数据处理 → DIF → XY**：

1. 拖入 `.dif`；
2. 选择输出形态（推荐 Origin 宽表）；
3. 如需要，加载第 3 步保存的 `recipe.json`，把坐标反算回 Raman shift；
4. 导出 CSV，在 Origin 中绘图。

## 你会得到什么

| 文件               | 内容                                     | 用途                |
| ------------------ | ---------------------------------------- | ------------------- |
| `*.xy`             | 两列：X、强度；CRLF；无表头              | MDI Jade 直接读取   |
| `*.recipe.json`    | 原始元数据 + 全部步骤 + 映射系数         | 复现、反算、分享    |
| `*.csv`（DIF 页）  | X、Raw、Background、Overall、Diff、Fit1… | Origin 多列绘图     |
| `*.csv`（SAED 页） | h、k、l、d、\|g\|、强度、R               | 标定与归档          |
| `*.xy`（XRD 页）   | 模拟的 2θ–强度                           | 与实验对比或送 Jade |
| `*.xtalbox.json`   | 原始数据 + 步骤账本                      | 保存/恢复整个工作区 |

## 数据会保存在哪里？

- 当前会话：保存在浏览器内存中，切换页面不会丢失；
- 刷新页面：当前工具输入与数据会自动恢复；
- 长期保存：使用 **保存工程**（`.xtalbox.json`）或分别导出 `.xy` 与配方；
- 任何数据都不会被上传。详见 [工程与配方](/docs/userguide/projects)。

## 下一步

- [界面与工作流](/docs/userguide/interface)
- [数据导入](/docs/userguide/data-import)
- [预处理与逆处理](/docs/userguide/preprocessing)
- [Raman → Jade → Origin 全流程](/docs/cookbook/raman-to-jade)
- [颗粒尺寸测量](/docs/userguide/particles)
- [晶胞与密度](/docs/userguide/cell)
- [三维晶胞查看器](/docs/userguide/crystal-viewer)
