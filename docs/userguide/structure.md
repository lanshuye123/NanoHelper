# 晶体结构

本页负责把 CIF 变成可计算的完整晶胞：解析晶格参数、空间群与原子位点，按对称操作展开，并给出密度、化学式与低角反射预览。

## CIF 支持范围

解析器支持常见的 CIF 子集：

| 类别 | 标签 |
|---|---|
| 晶胞 | `_cell_length_a/b/c`、`_cell_angle_alpha/beta/gamma` |
| 空间群 | `_symmetry_space_group_name_H-M`、`_symmetry_Int_Tables_number`、`_space_group_IT_number` |
| 对称操作 | `_symmetry_equiv_pos_as_xyz`、`_space_group_symop_operation_xyz`（loop 或单值） |
| 原子位点 | `_atom_site_label`、`_atom_site_type_symbol`、`_atom_site_fract_x/y/z`、`_atom_site_occupancy`、`_atom_site_B_iso_or_equiv`、`_atom_site_U_iso_or_equiv` |
| 标题 | `_chemical_name_systematic`、`_chemical_name_common`、`_publ_section_title` |

- 支持带不确定度的数值，如 `5.431(2)`；
- 支持分数坐标 `1/3`；
- 支持分号多行文本与 `#` 注释；
- 支持 CIF2 的点号标签（如 `_cell.length_a`、`_atom_site.fract_x`）；
- 若 CIF 未提供对称操作，按空间群编号/符号从内置数据库加载；
- 若两者都没有，按 P1 处理并警告。

::: warning 原点选择
同一空间群可能有不同的原点选择（例如 I4₁/amd 的原点选择 1 和 2）。CIF 中的原子坐标必须与它声明的设置一致；若展开后原子数明显偏多，通常是原点/设置不匹配。此时优先使用 CIF 自带的对称操作，而不是数据库版本。
:::

## 对称展开

CIF 中通常只列出**非对称单元**的原子。程序：

1. 对每个原子应用全部对称操作；
2. 分数坐标取模到 `[0,1)`；
3. 按「元素 + 4 位小数坐标」去重；
4. 结果即完整晶胞的原子列表。

去重容差为 1e-4 分数坐标，足以处理常见的打印误差。

## 密度与化学式

晶胞质量：

$$
m_{\text{cell}}=\sum_j occ_j\,M_j
$$

理论密度：

$$
\rho=\frac{m_{\text{cell}}}{N_A\,V\times10^{-24}}
$$

其中 `V` 为 Å³，`ρ` 为 g/cm³。化学式由晶胞内各元素计数按最大公约数约化得到；若占有率不是整数，会显示两位小数。

::: tip 密度对不上？
- 检查是否有部分占有率或空缺位；
- 检查 CIF 是否只给了一个化学式单元而不是完整晶胞；
- 检查空间群是否选错（导致原子数翻倍/减半）。
:::

## 低角反射预览

枚举 `|h|,|k|,|l| ≤ 4`，计算结构因子，过滤系统消光，并按 d 去重，最多显示 24 条。它用于快速检查：

- 第一条强反射的 d 是否与 PDF 卡片一致；
- 是否有明显的消光异常；
- 结构是否包含原子（无原子时全部为零）。

## 修改晶胞参数

左侧「晶胞参数」可直接编辑 a/b/c/α/β/γ。修改会：

- 立即更新体积、密度；
- 更新低角反射；
- 同步影响 SAED 与 XRD 页（它们共享当前结构）。

原子坐标与占有率目前只读；需要修改请编辑 CIF 后重新导入。

## 预设结构

内置 15 个常见结构：Si、金刚石、NaCl、金红石、锐钛矿、ZnO、Mg、SrTiO₃、Al、Cu、Au、Fe、CsCl、MoS₂、GaAs。它们已经是完整晶胞，可直接用于 SAED/XRD。

## 当前限制

- 不提供 3D 晶胞查看（计划在 v1.1）；
- 不解析各向异性位移参数（只保留各向同性 B）；
- 不处理无序、超胞、磁结构；
- 不做 CIF 的完整语法校验；
- 不导出 CIF。

## 最小 CIF 示例

```cif
data_NaCl
_cell_length_a 5.6402
_cell_length_b 5.6402
_cell_length_c 5.6402
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
_symmetry_space_group_name_H-M 'F m -3 m'
_symmetry_Int_Tables_number 225
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_occupancy
Na1 Na 0 0 0 1
Cl1 Cl 0.5 0 0 1
```

导入后应得到 4 个 Na + 4 个 Cl，化学式 NaCl，密度约 2.16 g/cm³。

## 相关文档

- [电子衍射模拟](/docs/userguide/saed)
- [XRD 模拟与分析](/docs/userguide/xrd)
- [公式与推导](/docs/reference/formulas)
