# 公式与推导

本页汇总工具中用到的公式。除特别说明外：

- 长度单位 Å；
- 倒易矢量采用**晶体学约定**，不含 $2\pi$；
- 角度在公式中用弧度，输入框用度；
- 强度均为相对值。

## 1. 晶格与倒易晶格

基矢 $\vec a,\vec b,\vec c$，夹角 $\alpha=<\vec b,\vec c>$、$\beta=<\vec a,\vec c>$、$\gamma=<\vec a,\vec b>$。

度规张量：

$$
G=\begin{pmatrix}
a^2 & ab\cos\gamma & ac\cos\beta\\
ab\cos\gamma & b^2 & bc\cos\alpha\\
ac\cos\beta & bc\cos\alpha & c^2
\end{pmatrix}
$$

$$
V=\sqrt{\det G}=abc\sqrt{1-\cos^2\alpha-\cos^2\beta-\cos^2\gamma+2\cos\alpha\cos\beta\cos\gamma}
$$

倒易基矢：

$$
\vec a^*=\frac{\vec b\times\vec c}{V},\quad
\vec b^*=\frac{\vec c\times\vec a}{V},\quad
\vec c^*=\frac{\vec a\times\vec b}{V}
$$

满足 $\vec a_i\cdot\vec a_j^*=\delta_{ij}$。倒易度规：

$$
G^*=G^{-1}
$$

倒易参数：

$$
a^*=\frac{bc\sin\alpha}{V},\quad
\cos\alpha^*=\frac{\cos\beta\cos\gamma-\cos\alpha}{\sin\beta\sin\gamma}
$$

（其余分量轮换。）

## 2. 晶面间距与夹角

$$
\frac{1}{d_{hkl}^2}
=h^2a^{*2}+k^2b^{*2}+l^2c^{*2}
+2hk\,a^*b^*\cos\gamma^*
+2hl\,a^*c^*\cos\beta^*
+2kl\,b^*c^*\cos\alpha^*
$$

等价地：

$$
\vec g_{hkl}=h\vec a^*+k\vec b^*+l\vec c^*,\qquad
d_{hkl}=\frac{1}{|\vec g_{hkl}|}
$$

两晶面夹角：

$$
\cos\theta=
\frac{\vec g_1\cdot\vec g_2}{|\vec g_1||\vec g_2|}
=
\frac{h_1G^*h_2^\top}{\sqrt{h_1G^*h_1^\top}\sqrt{h_2G^*h_2^\top}}
$$

两晶向夹角：

$$
\cos\varphi=
\frac{u_1Gu_2^\top}{\sqrt{u_1Gu_1^\top}\sqrt{u_2Gu_2^\top}}
$$

## 3. 晶带

晶带方程：

$$
hu+kv+lw=0
$$

两晶面交线（带轴）：

$$
[u\,v\,w]=(h_1k_1l_1)\times(h_2k_2l_2)
$$

结果按 $\gcd$ 约化。若叉积为零，两晶面平行，无唯一带轴。

二维倒易面的整数基矢 $\vec b_1,\vec b_2$ 满足：

$$
\vec b_i\cdot(u,v,w)=0
$$

再做二维 Lagrange–Gauss 约化：

$$
\vec b_2\leftarrow \vec b_2-\mathrm{round}\!\left(\frac{\vec b_1\cdot\vec b_2}{\vec b_1\cdot\vec b_1}\right)\vec b_1
$$

直到 $|\vec b_2|\ge|\vec b_1|$。斑点坐标：

$$
\vec r(i,j)=i\vec g_1+j\vec g_2
$$

## 4. 原子散射因子

Waasmaier–Kirfel 五高斯参数化：

$$
f_0(s)=c+\sum_{i=1}^{5}a_i\exp(-b_i s^2),\qquad
s=\frac{\sin\theta}{\lambda}=\frac{|\vec g|}{2}
$$

参数来自 DABAX `f0_WaasKirf.dat`，覆盖中性原子与常见离子。$s=0$ 时 $f_0\approx Z$。

## 5. 结构因子

$$
F(hkl)=\sum_j f_j(s)\,occ_j\,e^{-B_js^2}\,
e^{2\pi i(hx_j+ky_j+lz_j)}
$$

- $occ_j$：占有率；
- $B_j$：各向同性温度因子（Å²），$B=8\pi^2U$；
- 相位用分数坐标。

强度：

$$
I\propto|F(hkl)|^2
$$

系统消光：完整晶胞求和后 $|F|\approx0$。

## 6. 电子衍射

电子波长（相对论）：

$$
\lambda=\frac{h}{\sqrt{2m_eeV\left(1+\frac{eV}{2m_ec^2}\right)}}
$$

屏幕半径：

$$
R=L\lambda\,|\vec g|=\frac{L\lambda}{d}
$$

相机常数：

$$
L\lambda=R\cdot d
$$

常见值：200 kV，$\lambda=0.02508$ Å；$L=800$ mm → $L\lambda=20.06$ mm·Å。

## 7. 粉末 XRD

布拉格：

$$
2d\sin\theta=\lambda
$$

$$
2\theta=2\arcsin\!\left(\frac{\lambda}{2d}\right)
$$

强度：

$$
I(hkl)=m\cdot|F(hkl)|^2\cdot LP(\theta)
$$

多重度 $m$：Laue 轨道（含 Friedel 反演）的大小。工具只保留每个轨道的一个代表，避免重复求和。

洛伦兹-偏振因子（Bragg–Brentano）：

$$
LP=\frac{1+\cos^2 2\theta}{\sin^2\theta\cos\theta}
$$

### 峰型

以 $t=(x-x_0)/\mathrm{FWHM}$：

$$
G=\exp(-4\ln2\,t^2),\qquad
L=\frac{1}{1+4t^2}
$$

伪 Voigt：

$$
P=\eta L+(1-\eta)G
$$

峰值归一化为 1。$0\le\eta\le1$。

### Kα2

$$
\sin\theta_2=\frac{\lambda_2}{\lambda_1}\sin\theta_1
$$

Kα2 峰位由同一 d 与较长波长重新计算，强度比默认 0.5。

## 8. Rachinger Kα2 剥离

$$
I_1(x)=I_{\text{obs}}(x)-r\,I_1(x')
$$

其中 $x'$ 满足：

$$
\sin\frac{x'}{2}=\frac{\lambda_1}{\lambda_2}\sin\frac{x}{2}
$$

按 $x$ 从低到高扫描，$I_1(x')$ 用已修正曲线插值。

## 9. 数据处理

### SNIP

$$
z=\ln\!\left(\ln\!\left(\sqrt{y+1}+1\right)+1\right)
$$

迭代：

$$
z_i\leftarrow\min\left(z_i,\frac{z_{i-p}+z_{i+p}}{2}\right),\quad p=1\ldots N
$$

逆变换：

$$
y=\left(e^{e^z-1}-1\right)^2-1
$$

### Savitzky–Golay

局部多项式拟合，中心点系数：

$$
c=e_0^\top(A^\top A)^{-1}A^\top
$$

### Jade 仿射

$$
x'=s_xx+t_x,\qquad y'=s_yy+t_y
$$

反算：

$$
x=\frac{x'-t_x}{s_x},\qquad y=\frac{y'-t_y}{s_y}
$$

峰宽与面积的反算：

$$
\beta=\frac{\beta'}{|s_x|},\qquad
A=\frac{A'}{|s_x s_y|}
$$

### 2θ → 1/d

$$
\frac{1}{d}=\frac{2\sin\theta}{\lambda}
$$

## 10. 峰分析

### Scherrer

$$
D=\frac{K\lambda}{\beta\cos\theta}
$$

$K\approx0.9$，$\beta$ 为弧度。

### Williamson–Hall

$$
\beta\cos\theta=\frac{K\lambda}{D}+4\varepsilon\sin\theta
$$

截距 $K\lambda/D$，斜率 $4\varepsilon$。

### 仪器展宽（高斯近似）

$$
\beta_{\text{sample}}^2=\beta_{\text{obs}}^2-\beta_{\text{inst}}^2
$$

## 11. 密度与晶胞内容

$$
m_{\text{cell}}=\sum_j occ_jM_j
$$

$$
\rho=\frac{m_{\text{cell}}}{N_A V\times10^{-24}}
$$

$V$ 为 Å³，$\rho$ 为 g/cm³。

化学式：按晶胞内各元素计数除以最大公约数。

## 12. 常用常数

| 常数 | 值 |
|---|---|
| $N_A$ | $6.02214076\times10^{23}$ mol⁻¹ |
| $h$ | $6.62607015\times10^{-34}$ J·s |
| $m_e$ | $9.1093837015\times10^{-31}$ kg |
| $e$ | $1.602176634\times10^{-19}$ C |
| $c$ | $2.99792458\times10^8$ m/s |

## 13. 约定与边界

- 倒易空间不含 $2\pi$；与固体物理的 `Q=4π sinθ/λ` 相差 $2\pi$。
- 结构因子相位使用 $2\pi$。
- 电子衍射强度为运动学近似；XRD 强度未含吸收、择优取向、仪器几何。
- 粉末多重度使用 Laue 轨道；非中心对称空间群的 Friedel 对按等价处理。
