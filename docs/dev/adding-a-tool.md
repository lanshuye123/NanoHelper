# 新增一个工具

目标：在不改动导航、路由与文档框架的前提下，新增一个工具页。

## 1. 写页面

在 `src/views/` 新建 `MyToolView.vue`：

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import ToolPage from '@/components/layout/ToolPage.vue'
import PanelCard from '@/components/common/PanelCard.vue'
import NumberField from '@/components/common/NumberField.vue'

const a = ref(1)
const b = ref(2)
const sum = computed(() => a.value + b.value)
</script>

<template>
  <ToolPage title="我的工具" subtitle="一句话说明它解决什么问题" eyebrow="晶体几何 · 03" doc="/docs/userguide/my-tool">
    <template #config>
      <PanelCard title="参数">
        <div class="form-stack">
          <NumberField v-model="a" label="a" />
          <NumberField v-model="b" label="b" />
        </div>
      </PanelCard>
    </template>

    <PanelCard title="结果">
      <div class="stat">
        <div class="stat__label">a + b</div>
        <div class="stat__value mono">{{ sum }}</div>
      </div>
    </PanelCard>

    <template #aside>
      <PanelCard title="说明">
        <p class="small muted">这里放边界条件、公式或快速提示。</p>
      </PanelCard>
    </template>
  </ToolPage>
</template>
```

页面约定：

- 用 `ToolPage` 获得统一的标题、文档链接与三栏布局；
- 配置放 `#config`，结果放默认 slot，检查器放 `#aside`；
- 参数用 `NumberField`，自动支持表达式与范围校验；
- 不要直接操作 `document` 之外的全局状态。

## 2. 注册工具

编辑 `src/tools/registry.ts`：

```ts
import { Compass } from 'lucide-vue-next'

export const tools: ToolMeta[] = [
  // …
  {
    id: 'my-tool',
    title: '我的工具',
    subtitle: '一句话说明',
    group: 'crystal',
    path: '/crystal/my-tool',
    icon: Compass,
    status: 'beta',
    doc: '/docs/userguide/my-tool',
    component: () => import('@/views/MyToolView.vue'),
  },
]
```

注册后自动获得：

- 路由；
- 顶栏模块标签下的侧栏入口；
- 首页对应模块的页面卡片；
- 全局搜索（`Ctrl / ⌘ + K`）索引；
- 工具页右上角的文档按钮。

模块由 `group` 决定：`data` → 数据处理，`diffraction` → 衍射模拟，
`crystal` → 晶体几何。侧栏与首页会按工具在 `tools` 数组中的顺序自动编号。

## 3. 写文档

1. 在 `docs/userguide/my-tool.md` 新建文档；
2. 在 `src/docs/manifest.ts` 添加条目：

```ts
{
  section: 'userguide',
  slug: 'my-tool',
  title: '我的工具',
  description: '一句话说明',
  file: 'userguide/my-tool.md',
  order: 13,
  keywords: ['关键词'],
}
```

文档会出现在侧栏、搜索与上下篇导航中；`doc` 路径要一致。

## 4. 加测试

核心算法放在 `src/core/`，测试放在 `tests/`：

```ts
import { describe, expect, it } from 'vitest'
import { myComputation } from '@/core/mydomain/myComputation'

describe('myComputation', () => {
  it('matches a known value', () => {
    expect(myComputation(1, 2)).toBeCloseTo(3, 12)
  })
})
```

要求：

- 至少一个已知值/边界条件；
- 若涉及可逆变换，加往返测试；
- 若涉及文件解析，加固定装置（`tests/fixtures/`）。

## 5. 检查清单

- [ ] `npm run type-check` 通过；
- [ ] `npm run test:unit` 通过；
- [ ] `npm run build` 通过；
- [ ] 侧栏、顶栏模块标签与首页模块卡片出现新工具；
- [ ] 文档链接可用，标题不重复；
- [ ] 空状态、错误状态、移动端布局都有处理；
- [ ] 导出/下载有成功与失败提示；
- [ ] 没有网络请求、没有 `eval` 不受控输入。

## 6. 可选：新导入器 / 新步骤

### 导入器

在 `src/services/importData.ts` 增加分支，或把解析器放到 `src/core/io/`：

```ts
if (ext === 'myformat') {
  const data = parseMyFormat(text)
  return { kind: 'pattern', pattern: data, format: 'MyFormat', fileName: name, warnings: [], headers: [] }
}
```

### 变换步骤

在 `src/core/pipeline/steps.ts`：

1. 实现 `StepDefinition`；
2. 加入 `STEP_DEFINITIONS` 与 `STEP_TYPES`；
3. 在 `StepCard.vue` 增加参数控件；
4. 在文档中补充参数与可逆性；
5. 加往返/边界测试。

## 7. 发布

1. 更新 `docs/reference/changelog.md`；
2. 若格式变化，提升对应 `schema` 版本；
3. 构建并检查 `dist/`；
4. 部署静态文件。
