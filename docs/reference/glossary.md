# 术语与符号

## 晶体学

| 术语 | 英文 | 符号/说明 |
|---|---|---|
| 晶胞 | unit cell | $a,b,c,\alpha,\beta,\gamma$ |
| 初基原胞 | primitive cell | 体积最小，只含一个格点 |
| 晶面 | lattice plane | $(hkl)$ |
| 晶向 | direction | $[uvw]$ |
| 晶面族 | family of planes | $\{hkl\}$ |
| 晶向族 | family of directions | $\langle uvw\rangle$ |
| 晶带 | zone | 交于同一直线的晶面族 |
| 带轴 | zone axis | $[uvw]$ |
| 晶带方程 | Weiss zone law | $hu+kv+lw=0$ |
| 倒易矢量 | reciprocal vector | $\vec g=h\vec a^*+k\vec b^*+l\vec c^*$ |
| 倒易点阵 | reciprocal lattice | 由 $\vec a^*,\vec b^*,\vec c^*$ 生成 |
| 消光 | extinction | 系统消光 / 点阵消光 |
| 空间群 | space group | 230 种 |
| 点群 | point group | 32 种 |
| 布拉菲格子 | Bravais lattice | 14 种 |
| Wyckoff 位置 | Wyckoff position | 多重度 + 位置对称性 |
| 占有率 | occupancy | $occ$ |
| 温度因子 | temperature factor | $B$ 或 $U$，$B=8\pi^2U$ |

## 衍射

| 术语 | 英文 | 说明 |
|---|---|---|
| 2θ | two-theta | XRD 横坐标 |
| d 值 | d-spacing | 晶面间距 |
| 结构因子 | structure factor | $F(hkl)$ |
| 多重度 | multiplicity | $m$ |
| 洛伦兹-偏振因子 | Lorentz–polarization factor | $LP$ |
| 半高宽 | FWHM | 峰宽 |
| 仪器展宽 | instrumental broadening | 标样测定 |
| 微应变 | microstrain | $\varepsilon$ |
| Kα1/Kα2 | | 特征 X 射线双线 |
| 相机常数 | camera constant | $L\lambda$ |
| 选区电子衍射 | SAED | selected area electron diffraction |
| 零阶劳厄带 | ZOLZ | zero-order Laue zone |
| 高阶劳厄带 | HOLZ | higher-order Laue zone |
| 运动学近似 | kinematic approximation | 单次散射 |
| 动力学效应 | dynamical effect | 多次散射 |
| 择优取向 | preferred orientation | 织构 |

## 数据与格式

| 术语 | 说明 |
|---|---|
| raw | 导入的原始数据，只读 |
| derived | 经步骤链处理后的当前结果 |
| step / 步骤 | 一个可启用/停用的变换 |
| recipe | 配方：步骤 + 映射系数 + 校验和 |
| project | 工程：原始数据 + 步骤 |
| Rp | 无权重拟合残差 |
| Rwp | 加权残差（本工具不计算） |

## 单位

| 量 | 单位 |
|---|---|
| 晶格常数、d、波长 | Å |
| 倒易矢量、1/d | Å⁻¹ |
| 2θ、FWHM | °（公式中转为弧度） |
| 相机长度 | mm |
| 相机常数 | mm·Å |
| 密度 | g/cm³ |
| 能量 | keV / eV |

## 记号约定

- $h,k,l$：晶面指数；$u,v,w$：晶向/带轴指数；
- $[uvw]$：晶向；$(hkl)$：晶面；$\{hkl\}$：晶面族；$\langle uvw\rangle$：晶向族；
- $\vec a^*,\vec b^*,\vec c^*$：倒易基矢（不含 $2\pi$）；
- $s=\sin\theta/\lambda=|\vec g|/2$；
- $V$：晶胞体积；$Z$：化学式单元数；
- $F$：结构因子；$f$：原子散射因子；$m$：多重度。
