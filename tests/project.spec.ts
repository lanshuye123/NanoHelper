import { describe, expect, it } from 'vitest'
import { buildProjectFile, parseProjectFile, serializeProjectFile } from '@/core/project/file'
import { createStep } from '@/core/pipeline/steps'
import { makePattern } from '@/core/pipeline/types'
import { renderDoc } from '@/docs/render'

const pattern = makePattern([10, 11, 12], [1, 2, 3], {
  xLabel: '2θ',
  xUnit: '°',
  yLabel: 'Counts',
  yUnit: 'counts',
  wavelength: 1.54056,
})

describe('project file', () => {
  it('round-trips data and steps', () => {
    const steps = [createStep('crop', { xMin: 10, xMax: 12 }), createStep('jade-map', { mode: 'diffraction' })]
    const project = buildProjectFile(pattern, { name: 'demo', format: 'test' }, steps, '0.1.0', 'demo')
    const text = serializeProjectFile(project)
    const parsed = parseProjectFile(text)
    expect(parsed.name).toBe('demo')
    expect(parsed.pattern.x.length).toBe(3)
    expect(parsed.pattern.meta.xLabel).toBe('2θ')
    expect(parsed.steps).toHaveLength(2)
    expect(parsed.steps[1].type).toBe('jade-map')
  })

  it('rejects unknown schemas', () => {
    expect(() => parseProjectFile('{"schema":"other"}')).toThrow()
  })

  it('skips unknown step types', () => {
    const text = JSON.stringify({
      schema: 'crystaltoolbox/project@1',
      name: 'x',
      pattern: { meta: { xLabel: 'X', xUnit: '', yLabel: 'Y', yUnit: '' }, x: [1, 2], y: [1, 2] },
      steps: [{ type: 'not-a-step', enabled: true, params: {} }],
    })
    const parsed = parseProjectFile(text)
    expect(parsed.steps).toHaveLength(0)
  })
})

describe('markdown renderer', () => {
  const source = `# 标题

## 小节

公式 $a^2+b^2=c^2$ 与块级：

$$
E = mc^2
$$

::: tip 提示
这是提示。
:::

| a | b |
|---|---|
| 1 | 2 |

[链接](/data/import)
`
  it('renders headings, math, callouts and links', () => {
    const { html, headings } = renderDoc(source, 'userguide/test.md')
    expect(html).not.toContain('<h1')
    expect(html).toContain('id="小节"')
    expect(html).toContain('katex')
    expect(html).toContain('callout--tip')
    expect(html).toContain('href="#/data/import"')
    expect(headings.map((h) => h.text)).toContain('小节')
  })
})
