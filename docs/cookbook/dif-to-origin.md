# 把 DIF 画成发表级 Origin 图

目标：把 Jade 的拟合结果画成「实验 + 计算 + 差值 + PDF 卡片」的组合图。

## 1. 导出多列 CSV

在 **DIF → XY** 页：

1. 拖入 `.dif`；
2. 确认块列表：Raw、Background、Fitted Profile n、Overall；
3. 输出形态：**Origin 宽表**；
4. 勾选 CSV、注释表头；
5. 如做过映射，加载配方反算；
6. 导出。

列结构：

```text
X, Raw, Background, Overall, Diff, Fit1, Fit2, Fit3
```

## 2. 导入 Origin

1. `File → Import → CSV`；
2. 在导入选项中确认分隔符为逗号，首行为列名；
3. 把 `X` 列右键 → `Set As → X`；
4. 选中 `Raw` 与 `Overall` → `Plot → Line+Symbol`。

如果 CSV 的 `#` 注释行被当成数据，导入时勾选“跳过注释行”或删除前几行。

## 3. 实验与计算曲线

- **Raw**：黑色或深灰，线宽 1；可加空心圆点（size 2–3）；
- **Overall**：红色或橙色，线宽 1.2；
- 图例放在右上角，去掉边框；
- 坐标轴：2θ（°）对 Intensity（a.u. 或 counts）。

::: tip 强度尺度
Raw 与 Overall 必须使用同一尺度。若在 Jade 中归一化过，导出时也保持一致；不要分别归一化。
:::

## 4. 差值曲线

三种做法：

1. 直接画 `Diff` 列（推荐，工具已计算 Raw − Overall）；
2. 在 Origin 中新增一列，设为 `B - D`（假设 B=Raw、D=Overall）；
3. 用 `Overall − Raw`，注意符号。

差值曲线通常放在主图下方，或用 offset 平移：

- 在 Layer 中设置 `Offset`；
- 或在函数中改为 `B-D` 并设置 Y 偏移；
- 差值轴的刻度比主图小一个量级。

## 5. 叠加 PDF 卡片

1. 准备 PDF 卡片的两列：2θ、相对强度；
2. 导入为新的 worksheet；
3. 设为 X/Y，`Plot → Column`；
4. 右键图层 → `Layer Contents`，把卡片列加入；
5. 在 Layer 的 `Size/Position` 中把卡片层放在主图下方或右侧；
6. 卡片用柱状图，强度归一化到 100。

课程笔记中的参考布局（Origin）：

```text
主图：left 15, top 10, width 70, height 60
PDF：height 10（放在主图下方）
```

## 6. 多相/多温度叠图

- 多列 Y → `Plot → Stacked Lines by Y Offsets`；
- 或用 `Waterfall`；
- 每条曲线加固定 offset，图例标注条件；
- 所有曲线使用相同 X 范围与强度尺度。

## 7. 导出

- `File → Export Graphs`；
- 格式：TIFF/PNG（300–600 dpi）或 PDF/SVG（矢量）；
- 宽度按期刊单栏/双栏设置；
- 字体嵌入（PDF）。

## 检查清单

- [ ] X 轴单位与范围正确；
- [ ] Raw/Overall 同尺度；
- [ ] Diff 的零线可见；
- [ ] PDF 卡片强度已归一化；
- [ ] 图例不遮挡数据；
- [ ] 导出分辨率 ≥ 300 dpi。

## 常见问题

**差值曲线整体偏移**

- Raw 与 Overall 的背底定义不同；
- 在 Jade 中 Overall 可能不含背底，需确认；
- 用 `Raw − Background − ΣFits` 或 `Raw − Overall`，二选一。

**PDF 卡片位置不对**

- 卡片的 2θ 轴与实验轴必须一致；
- 若卡片是 d 值，先用布拉格公式换算成 2θ。

**Origin 导入后列错位**

- 检查 CSV 是否有逗号与小数点混用；
- 本工具输出固定用 `.` 作为小数点。
