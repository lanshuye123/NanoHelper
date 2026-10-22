# DIF → XY

Jade 的拟合结果可以导出为 `.dif`。本页把它解析成多条曲线，插值到公共网格，再导出 Origin 可用的多列数据。

## DIF 的结构

实测的 `DEMO06.dif`：

```text
10/20/26 10:16  FIT Red Paint Pigment Mixture      ← 文件头：日期 时间 模式 标题
 20  0.02  4 Cu 1.54056  78  2901 (Raw Pattern)    ← 参数行
 372  403  384  390  429  418  460  401            ← Y 值，每行 8 个
 ...
 20  0.02  4 Cu 1.54056  78  2901 (Background)
 ...
 23.18  0.02  4 Cu 1.54056  29.12  298 (Fitted Profile 1)
 ...
 20  0.02  4 Cu 1.54056  78  2901 (Overall Profile)
```

参数行字段：

| 字段 | 示例 | 含义 |
|---|---|---|
| start | 20 | 起始 2θ |
| step | 0.02 | 步长 |
| flag | 4 | 版本相关，解析时忽略 |
| anode | Cu | 靶材 |
| wavelength | 1.54056 | Kα1 波长（Å） |
| end | 78 | 终止 2θ |
| npoints | 2901 | 点数 |
| name | (Raw Pattern) | 曲线名 |

::: warning 不同块可以有不同范围
`Fitted Profile 1` 只覆盖 23.18–29.12°，与 Raw 的 20–78° 不同。导出到公共网格时，区间外默认补 0，也可改为 NaN。
:::

## 解析与角色识别

- 参数行用容错正则匹配；名称两侧的括号会去掉；
- 每一块按自己的 `start/step/npoints` 生成 X 轴；
- 角色按名称关键字识别：`raw`、`background`、`fitted/profile`、`overall/calculated`、`diff`；
- 无法识别时保留原名，由用户决定；
- 点数与声明不一致时截断/补零，并给出警告。

## 公共网格

默认以 **Raw** 的网格为准（没有 Raw 时用 Overall，再否则用第一块）。可切换为「覆盖所有块」的最宽网格。

- 相同网格直接复制；
- 不同网格线性插值；
- 区间外按设置补 0 或 NaN；
- 所有列共享同一个 X。

## 输出形态

| 形态 | 列 | 用途 |
|---|---|---|
| Origin 宽表 | X, Raw, Background, Overall, Diff, Fit1…FitN | 一次导入，逐列绘图 |
| 堆叠长表 | 空行分隔的若干 `X Y` 段 | Origin Stacked Lines |
| 仅差值 | X, Diff | 快速看拟合质量 |
| 单条曲线 | X, Y | 只想要 Raw 或某一条 |

CSV 会额外写一行列名；空白分隔则不写列名，只写 `#` 注释。

## 拟合质量 Rp

当同时存在 Raw 与 Overall 时：

$$
R_p = \frac{\sum |Y_{\text{obs}} - Y_{\text{calc}}|}{\sum |Y_{\text{obs}}|} \times 100\%
$$

它不使用权重，也不是 Rietveld 的 Rwp；只用于快速判断拟合是否明显偏离。

## 反算回原始坐标

1. 在导入时导出过 `recipe.json`；
2. 在本页「配方反算」中选择该文件；
3. 导出时 X 与所有 Y 列都会按配方逆变换；
4. 页面会提示已反算。

反算公式：

$$
x = \frac{x' - t_x}{s_x},\qquad y = \frac{y' - t_y}{s_y}
$$

若原始数据是 Raman 位移，反算后 X 就是 cm⁻¹，可直接与峰位对照。

::: warning 1/d 轴与配方不要混用
若同时选择「1/d」横坐标并加载配方，程序会提示：1/d 是基于反算后的 2θ 计算的。通常只需二选一。
:::

## 1/d 横坐标

用于比较不同波长（Cu、同步辐射、电子衍射）的数据：

$$
\frac{1}{d} = \frac{2\sin\theta}{\lambda}
$$

在 DIF 页选择「1/d（Å⁻¹）」即可。注意：

- 这是 **2θ → 1/d** 的转换，不是能量或 Q；
- 电子衍射数据需要先换算成等效 2θ 或直接使用 SAED 页；
- 不同波长的峰位在 1/d 轴上应对齐。

## Origin 操作

1. `File → Import → CSV`，选择导出的文件；
2. 右键 X 列 → `Set As → X`；
3. 选中 Raw 与 Overall → `Plot → Line+Symbol`；
4. Diff 列单独绘制；若要真实差值，把 Y 设为 `B-D` 或减一个偏移；
5. 需要 PDF 卡片时，把卡片的两列（2θ、强度）作为新列导入，用 Column 图叠加。

详细步骤见 [把 DIF 画成发表级 Origin 图](/docs/cookbook/dif-to-origin)。

## 限制

- DIF 通常不包含 Bragg 位置表；本工具不生成 Bragg 位置文件；
- 拟合峰块是局部范围，插值到全范围后区间外为 0，不是「真实为零」；
- Rp 不含权重，不能替代 Rwp；
- 不解析 Jade 的 `.mdi` 二进制工程文件。

## 相关文档

- [Jade 导出](/docs/userguide/jade-export)
- [Rietveld 图与差值曲线](/docs/cookbook/rietveld-origin)
- [文件格式规范](/docs/reference/file-formats)
