# 工程与配方

工具箱用两个 JSON 文件承载「可复现」：**工程文件**保存原始数据与步骤，**配方文件**保存坐标映射与参数，用于 DIF 反算。

## 工程文件 `.xtalbox.json`

在「导入与预处理 → 数据源」中点击 **保存工程**，得到：

```json
{
  "schema": "crystaltoolbox/project@1",
  "name": "Raman · 锐钛矿",
  "createdAt": "2026-10-23T01:00:00.000Z",
  "app": { "name": "CrystalToolBox", "version": "0.1.0" },
  "source": { "name": "Raman · 锐钛矿", "fileName": "anatase-raman.csv", "format": "示例数据" },
  "pattern": {
    "meta": { "xLabel": "Raman shift", "xUnit": "cm⁻¹", "yLabel": "Intensity", "yUnit": "a.u." },
    "x": [100, 100.5, 101],
    "y": [133.4, 133.9, 134.2]
  },
  "steps": [
    { "id": "…", "type": "smooth", "enabled": true, "params": { "method": "sg", "window": 11, "order": 3 } },
    { "id": "…", "type": "jade-map", "enabled": true, "params": { "mode": "nonDiffraction" } }
  ]
}
```

- 包含**原始数据**，因此文件可能较大；
- 打开工程会替换当前数据与步骤，并清空撤销历史；
- 未知步骤类型会被跳过，不会导致整个文件失败；
- 工程文件**不包含**当前晶体结构（结构由 SAED/XRD/结构页的独立状态维护）。

### 打开工程

点击 **打开工程**，选择 `.xtalbox.json`。若当前已有数据，会先确认是否替换。载入后：

- `raw` 从文件恢复；
- 步骤按原顺序恢复；
- 当前结果重新计算（不保存派生数据，避免不一致）。

## 配方文件 `.recipe.json`

在「Jade 导出」页点击 **配方 JSON** 生成：

```json
{
  "schema": "crystaltoolbox/recipe@1",
  "name": "Raman · 锐钛矿",
  "createdAt": "…",
  "source": {
    "file": "anatase-raman.csv",
    "xLabel": "Raman shift",
    "xUnit": "cm⁻¹",
    "yLabel": "Intensity",
    "yUnit": "a.u.",
    "points": 3801,
    "xRange": [100, 2000],
    "yRange": [133.3, 1076.5]
  },
  "steps": [
    { "type": "smooth", "enabled": true, "params": { "method": "sg", "window": 11, "order": 3 } },
    { "type": "jade-map", "enabled": true, "params": { "mode": "nonDiffraction", "mapping": { "xScale": 0.05263, "xOffset": -5.263, "yScale": 10.6087, "yOffset": -1429.76 } } }
  ],
  "mapping": { "xScale": 0.05263, "xOffset": -5.263, "yScale": 10.6087, "yOffset": -1429.76 },
  "checksum": "fnv1a:…",
  "app": { "name": "CrystalToolBox", "version": "0.1.0" }
}
```

- `mapping` 是解析后的仿射系数，供 DIF 页反算；
- `checksum` 是原始数据的 FNV-1a 哈希，用于提示「配方与数据是否匹配」；
- 配方**不含**数据点，必须与原始数据/工程一起保存。

## 两者怎么选？

| 目标 | 用哪个 |
|---|---|
| 明天继续处理同一份数据 | 工程文件 |
| 把数据送到 Jade，之后反算 | `.xy` + 配方 |
| 把方法分享给同学 | 配方（附原始数据） |
| 归档发表 | `.xy` + 配方 + 原始文件 + 导出图 |

## 校验与兼容

- 两种文件都带 `schema` 版本；加载时校验；
- 配方的未知字段会保留，未知步骤会被跳过；
- 工程文件的 `steps` 会按当前注册的步骤类型过滤；
- 如果版本不匹配，会明确报错，而不是静默丢弃。

## 隐私

保存/打开都是浏览器本地文件操作：

- 没有上传接口；
- 没有云端同步；
- 没有 Cookie 或跟踪脚本。

分享工程文件时请注意：它包含完整的原始数据。

## 当前限制

- 当前工作区会自动保存，但跨设备仍建议导出工程文件；
- 不做多工程管理/最近文件列表；
- 不把晶体结构写入工程文件；
- 不做工程文件的增量保存。
