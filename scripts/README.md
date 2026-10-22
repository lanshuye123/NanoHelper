# 数据生成脚本

## `generate-scattering.py`

从 `scripts/vendor/f0_WaasKirf.dat` 生成 `src/data/scattering.json`。

- 数据来源：DABAX `f0_WaasKirf.dat`（Waasmaier & Kirfel, Acta Cryst. A51 (1995) 416）；
- 参数化：`f0(s) = c + Σ aᵢ exp(−bᵢ s²)`，`s = sinθ/λ`；
- 覆盖中性原子与常见离子；
- 生成结果已提交，通常无需重新运行。

```bash
python3 scripts/generate-scattering.py
```

## 空间群数据

`src/data/spacegroups/*.json` 与 `spacegroups-index.json` 是从标准化空间群数据（spglib 对称操作）

 精简而来，仅保留工具需要的字段：编号、H-M 符号、晶系、点阵类型、点群与对称操作。

如需重新生成，请准备同结构的原始 JSON（每个条目含 `symmetryOperations`），再运行：

```python
# 见项目历史或按字段裁剪：number, symbolHM, symbolHall, crystalSystem,
# latticeType, pointGroup, ops[{r,t,s}]
```

## 数据校验

```bash
npm run test:unit
```

`tests/structure.spec.ts` 会校验若干已知结构因子与散射因子。
