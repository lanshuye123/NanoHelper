# 测试与质量

## 命令

```bash
npm run type-check   # vue-tsc，检查 .ts 与 .vue
npm run test:unit    # vitest run
npm run test:watch   # 监听模式
npm run build        # 类型检查 + 生产构建
```

## 当前测试覆盖

| 文件 | 覆盖内容 |
|---|---|
| `tests/lattice.spec.ts` | 晶格体积、d 值、夹角、带轴、二维基矢、[421]/[102] 特例 |
| `tests/structure.spec.ts` | 散射因子、NaCl/金刚石消光、Friedel 对、多重度 |
| `tests/cif.spec.ts` | 对称操作解析、CIF 文本/loop/多行、对称展开 |
| `tests/pipeline.spec.ts` | Jade 映射往返、步骤链、逆变换、校验、XY 解析/导出、SNIP、SG、Kα2 |
| `tests/dif.spec.ts` | DEMO06 六块解析、点数、X 轴、宽表/堆叠/差值导出 |
| `tests/diffraction.spec.ts` | Si/锐钛矿 XRD 峰位、多重度、SAED 斑点、Scherrer、W–H |
| `tests/ewald.spec.ts` | 艾瓦德球半径、ZOLZ/HOLZ、激发误差、X 射线/电子曲率对比 |
| `tests/saedRings.spec.ts` | Si 多晶环顺序、环半径、实测环指标化与 Lλ 反算、晶粒展宽 |
| `tests/symmetry.spec.ts` | Fd-3m/P21/P-1 手性、特殊位置、等效位置数 |
| `tests/persist.spec.ts` | 默认值合并、版本化记录、损坏 JSON 容错、保存时间格式 |
| `tests/toolDraft.spec.ts` | 自动恢复、卸载保存、恢复默认、清空记录、损坏记录回退 |
| `tests/tool-state-coverage.spec.ts` | 每个交互工具页都接入自动保存/恢复默认/清空本页 |

固定装置：`tests/fixtures/DEMO06.dif`（真实 Jade 导出）。

## 测试原则

1. **已知值优先**：用常数（Si a=5.431、Cu Kα1=1.54056）而不是快照；
2. **边界条件**：空数据、单点、零带轴、非正 Y、X 越界；
3. **往返**：可逆映射 `invert(apply(x)) ≈ x`；
4. **物理约束**：消光、Friedel、多重度、峰位；
5. **解析容错**：空格、括号、不同范围块、缺行。

## 示例

```ts
it('round-trips the Jade mapping', () => {
  const mapping = computeJadeMapping(pattern, { mode: 'nonDiffraction' })
  const mapped = applyMapping(pattern, mapping)
  const back = invertMapping(mapped, mapping)
  expect(back.x[10]).toBeCloseTo(pattern.x[10], 9)
})
```

## 手工验收

每次发布前：

- [ ] 工作台 → 示例 Raman → 添加平滑 + 映射 → 检查通过；
- [ ] Jade 导出 → 下载 `.xy` 与配方 → 打开文件检查两列/CRLF；
- [ ] DIF 页 → 载入 DEMO06 → 导出 CSV → 行数 2901、列名正确；
- [ ] 倒易空间 → Si [110] → 夹角 54.7356°（100/111）、带轴正确；
- [ ] SAED → Si [110] → 004 存在、002 消失；
- [ ] XRD → Si → 111/220/311/400 峰位；
- [ ] 结构 → 导入 NaCl CIF → 8 原子、密度 2.16；
- [ ] 文档 → 每篇可打开、目录/上下篇/搜索正常；
- [ ] 任一工具改参数 → 切页 → 返回，输入仍在；
- [ ] 刷新页面后，谱图/图像/测量记录能恢复；
- [ ] 「恢复默认」保留数据；「清空本页」后重新进入为默认状态；
- [ ] 艾瓦德球 → Si [110] → 切换电子/X 射线，曲率比明显变化；
- [ ] 多晶环 → Si → 111/220/400 环位置与 d 值一致；
- [ ] 对称性 → P -1 非手性、P 21 手性、Fd-3m 一般位置数 192；
- [ ] 浅色主题、1600/1280/800 px 宽度；
- [ ] 控制台无错误。

## 性能

- 十万点导入 < 1 s（本机）；
- 曲线交互 60 fps（抽稀后）；
- SAED Si [110]（maxG=0.8）< 50 ms；
- XRD Si 20–80°（step 0.02）< 300 ms；
- 文档首屏 < 200 KB gzip 增量。

## 提交前

- `type-check`、`test:unit`、`build` 全绿；
- 新增功能有对应文档与测试；
- 没有遗留 `console.log`；
- 没有把大数据/临时截图提交到仓库。
