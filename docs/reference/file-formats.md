# 文件格式规范

## Jade XY（`.xy`）

```text
0.000000 211.7699
0.026316 217.4856
0.052632 222.6806
```

| 规则   | 值                   |
| ------ | -------------------- |
| 编码   | ASCII / UTF-8 无 BOM |
| 列     | 2 列，空白分隔       |
| X 范围 | 0–140                |
| Y      | > 0                  |
| X 单调 | 是                   |
| 行尾   | CRLF（推荐）         |
| 表头   | 无（默认）           |
| 小数位 | X 6，Y 4（可调）     |

本工具的校验器会拒绝：X 越界、Y ≤ 0、NaN、非单调、点数 < 2。

## Jade DIF（`.dif`）

实测结构：

```text
10/20/26 10:16  FIT Red Paint Pigment Mixture
 20  0.02  4 Cu 1.54056  78  2901 (Raw Pattern)
 372  403  384  390  429  418  460  401
 ...
 20  0.02  4 Cu 1.54056  78  2901 (Background)
 ...
 23.18  0.02  4 Cu 1.54056  29.12  298 (Fitted Profile 1)
 ...
 20  0.02  4 Cu 1.54056  78  2901 (Overall Profile)
```

参数行：

| 字段       | 类型      | 说明              |
| ---------- | --------- | ----------------- |
| start      | float     | 起始 2θ           |
| step       | float     | 步长              |
| flag       | float/int | 版本相关，忽略    |
| anode      | string    | 靶材（Cu/Co/Mo…） |
| wavelength | float     | Kα1 波长（Å）     |
| end        | float     | 终止 2θ           |
| npoints    | int       | 点数              |
| name       | string    | 括号内的曲线名    |

Y 值每行 8 个，空白分隔；不同块可使用不同 start/step/npoints。

### 解析容错

- 参数行允许前后空格、多空格；
- 名称允许中文、括号；
- Y 值按空白切分，不假设每行个数；
- 点数与声明不一致时截断或补零；
- 参数行可出现在任意位置，自动开始新块。

## recipe.json

```json
{
  "schema": "crystaltoolbox/recipe@1",
  "name": "Raman · 锐钛矿",
  "createdAt": "2026-10-23T01:00:00.000Z",
  "source": {
    "file": "anatase-raman.csv",
    "xLabel": "Raman shift",
    "xUnit": "cm⁻¹",
    "yLabel": "Intensity",
    "yUnit": "a.u.",
    "wavelength": null,
    "anode": null,
    "points": 3801,
    "xRange": [100, 2000],
    "yRange": [133.3, 1076.5]
  },
  "steps": [
    { "type": "smooth", "enabled": true, "params": { "method": "sg", "window": 11, "order": 3 } },
    {
      "type": "jade-map",
      "enabled": true,
      "params": {
        "mode": "nonDiffraction",
        "mapping": { "xScale": 0.05263, "xOffset": -5.263, "yScale": 10.6087, "yOffset": -1429.76 }
      }
    }
  ],
  "mapping": { "xScale": 0.05263, "xOffset": -5.263, "yScale": 10.6087, "yOffset": -1429.76 },
  "checksum": "fnv1a:1a2b3c4d",
  "app": { "name": "CrystalToolBox", "version": "0.1.0" }
}
```

`mapping` 可缺省（没有 Jade 映射时）。`checksum` 是原始数据 x/y 的 FNV-1a 32 位哈希。

## project.json（`.xtalbox.json`）

```json
{
  "schema": "crystaltoolbox/project@1",
  "name": "…",
  "createdAt": "…",
  "app": { "name": "CrystalToolBox", "version": "0.1.0" },
  "source": { "name": "…", "fileName": "…", "format": "…" },
  "pattern": {
    "meta": { "xLabel": "2θ", "xUnit": "°", "yLabel": "Counts", "yUnit": "counts" },
    "x": [20, 20.02],
    "y": [372, 403]
  },
  "steps": [{ "id": "…", "type": "crop", "enabled": true, "params": { "xMin": 20, "xMax": 80 } }]
}
```

- 数据以普通 JSON 数组保存；
- 未知步骤类型会被跳过；
- 载入后重新计算派生数据。

## SAED CSV

```text
# CrystalToolBox SAED pattern
# zone axis: [1 1 0]
# voltage: 200 kV, wavelength: 0.025079 A
# camera length: 800 mm, camera constant: 20.0632 mm*A
h,k,l,d_A,g_invA,I_rel,R_mm,x_mm,y_mm
0,0,0,0.000000,0.000000,100.00,0.0000,0.0000,0.0000
0,0,4,1.357750,0.736500,100.00,14.7750,0.0000,14.7750
```

- 透射斑包含在表中，d=0；
- `I_rel` 为相对强度 0–100；
- `R_mm` 为到中心的距离。

## 模拟 XRD CSV（峰表）

```text
h,k,l,d_A,twoTheta_deg,multiplicity,F2,rel_intensity
1,1,1,3.135600,28.44130,8,3.5530e+3,100.000
```

- 每个 Laue 轨道一行；
- `F2` 为 |F|²；
- `rel_intensity` 以最强峰为 100。

## CIF 子集

支持：

```cif
_cell_length_a 5.6402
_cell_length_b 5.6402
_cell_length_c 5.6402
_cell_angle_alpha 90
_cell_angle_beta 90
_cell_angle_gamma 90
_symmetry_space_group_name_H-M 'F m -3 m'
_symmetry_Int_Tables_number 225
loop_
_symmetry_equiv_pos_as_xyz
'x, y, z'
'-x, -y, -z'
loop_
_atom_site_label
_atom_site_type_symbol
_atom_site_fract_x
_atom_site_fract_y
_atom_site_fract_z
_atom_site_occupancy
_atom_site_B_iso_or_equiv
Na1 Na 0 0 0 1 0.5
```

也支持 CIF2 的点号标签（`_cell.length_a`、`_atom_site.fract_x`）。

不支持：各向异性 Uij、磁矩、无序模型、`_atom_site_Cartn_*`（部分文件）、非标准对称操作语法。

## 编码与换行

- 输入：UTF-8 优先，GBK 回退；
- 输出：默认 UTF-8（ASCII 兼容）；Jade XY 的数值部分为纯 ASCII；
- 行尾：Jade XY 默认 CRLF；CSV 默认 LF（Origin 两者都接受）。

## 颗粒测量 CSV

测量表（`*_measurements_*.csv`）：

```csv
index,method,size_nm,size_display_nm,length_px,area_px,perimeter_px,circularity,x1_px,y1_px,x2_px,y2_px,source
1,线测法/Feret,108.779,108.779,43.51,,,  ,512.3,410.2,545.1,441.7,manual
2,面积等效圆,72.36,72.36,28.94,658.2,92.1,0.976,...
```

- `size_nm` 始终以 nm 保存，`size_<unit>` 是当前显示单位；
- 手动画线记录 `length_px` 与端点；自动识别额外记录面积、周长、圆度；
- `method` 区分 Feret 与面积等效圆；`source` 区分 manual / auto。

分组表（`*_histogram_*.csv`）：

```csv
# 粒径分布（nm；左闭右开，末组含上限）
bin_low_nm,bin_high_nm,count,frequency
20.000000,40.000000,12,18.4615
```

TXT 报告包含「基本报告」（逐颗）、「统计报告」（分组）与「汇总」（均值/标准差/D10…），便于直接粘贴到 Origin。

## 晶格精修 CSV

```csv
h,k,l,twoTheta_obs,twoTheta_calc,residual,d_obs,d_calc,weight
1,1,1,28.501347,28.501347,0.000000,3.129125,3.135589,1
```

第二段是 `parameter,value,sigma`，最后是 `rms_deg`、`rwp_percent` 与 `iterations`。

## SAED 指标化 CSV

```csv
h1,k1,l1,h2,k2,l2,u,v,w,d1,d2,angle,delta_d1,delta_d2,delta_angle,score,allowed
-1,-1,-1,-2,-2,0,1,-1,0,3.1356,1.9201,35.2636,0.0001,0.0000,0.0001,0.108,1
```

`allowed` 为 1/0，表示是否通过空间群系统消光检查。

## 三维晶胞内嵌

`public/crystal-viewer/` 是 CrystalViewer 的静态构建，不是数据格式；`index.html` 使用相对路径 `./assets/`，可随本站部署到任意子路径。同步脚本：`npm run embed:cryviewer`。
