import MarkdownIt from 'markdown-it'
import katex from 'katex'
import container from 'markdown-it-container'
import { DOCS } from './manifest'

export interface Heading {
  id: string
  level: number
  text: string
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
})

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

md.core.ruler.push('ctb_heading_ids', (state) => {
  const used = new Map<string, number>()
  for (let i = 0; i < state.tokens.length; i++) {
    const token = state.tokens[i]
    if (token.type !== 'heading_open') continue
    const inline = state.tokens[i + 1]
    const text = inline?.content ?? ''
    let id = slugify(text) || `section-${i}`
    const count = used.get(id) ?? 0
    used.set(id, count + 1)
    if (count > 0) id = `${id}-${count + 1}`
    token.attrSet('id', id)
  }
})

md.renderer.rules.heading_open = (tokens, idx) => {
  const token = tokens[idx]
  const id = token.attrGet('id') ?? ''
  return `<${token.tag} id="${id}">`
}

// Inline math: $...$
md.inline.ruler.after('escape', 'ctb_math_inline', (state, silent) => {
  const start = state.pos
  if (state.src[start] !== '$') return false
  if (state.src[start + 1] === '$') return false
  let end = start + 1
  while ((end = state.src.indexOf('$', end)) !== -1) {
    if (state.src[end - 1] !== '\\') break
    end++
  }
  if (end < 0) return false
  const content = state.src.slice(start + 1, end)
  if (!content.trim()) return false
  if (!silent) {
    const token = state.push('ctb_math_inline', 'math', 0)
    token.content = content
    token.markup = '$'
  }
  state.pos = end + 1
  return true
})

md.renderer.rules.ctb_math_inline = (tokens, idx) => {
  try {
    return katex.renderToString(tokens[idx].content, { displayMode: false, throwOnError: false, strict: false })
  } catch {
    return tokens[idx].content
  }
}

// Block math: $$ ... $$ (single or multi-line)
md.block.ruler.before('fence', 'ctb_math_block', (state, startLine, endLine, silent) => {
  const start = state.bMarks[startLine] + state.tShift[startLine]
  const max = state.eMarks[startLine]
  if (state.src.slice(start, start + 2) !== '$$') return false
  if (silent) return true

  let content = state.src.slice(start + 2, max)
  let nextLine = startLine
  const sameLine = content.indexOf('$$')
  if (sameLine >= 0) {
    content = content.slice(0, sameLine)
  } else {
    const lines: string[] = [content]
    nextLine = startLine + 1
    let closed = false
    while (nextLine < endLine) {
      const lineStart = state.bMarks[nextLine] + state.tShift[nextLine]
      const lineEnd = state.eMarks[nextLine]
      const line = state.src.slice(lineStart, lineEnd)
      const close = line.indexOf('$$')
      if (close >= 0) {
        lines.push(line.slice(0, close))
        closed = true
        break
      }
      lines.push(line)
      nextLine++
    }
    if (!closed) return false
    content = lines.join('\n')
  }

  const token = state.push('ctb_math_block', 'math', 0)
  token.content = content.trim()
  token.markup = '$$'
  token.block = true
  token.map = [startLine, nextLine + 1]
  state.line = nextLine + 1
  return true
})

md.renderer.rules.ctb_math_block = (tokens, idx) => {
  try {
    return `<div class="formula-block">${katex.renderToString(tokens[idx].content, {
      displayMode: true,
      throwOnError: false,
      strict: false,
    })}</div>`
  } catch {
    return `<pre>${md.utils.escapeHtml(tokens[idx].content)}</pre>`
  }
}

// Callouts: ::: tip / warning / danger / info
const calloutTitles: Record<string, string> = {
  tip: '提示',
  warning: '注意',
  danger: '警告',
  info: '说明',
}
for (const type of Object.keys(calloutTitles)) {
  md.use(container, type, {
    render(tokens: Array<{ nesting: number }>, idx: number) {
      if (tokens[idx].nesting === 1) {
        return `<div class="callout callout--${type}"><div class="callout__title">${calloutTitles[type]}</div>\n`
      }
      return '</div>\n'
    },
  })
}

// Code fences with a copy button.
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx]
  const lang = token.info.trim().split(/\s+/)[0] ?? ''
  const code = md.utils.escapeHtml(token.content)
  return `<div class="code-block"><button class="copy-btn" type="button" data-copy>复制</button><pre><code class="language-${lang}">${code}</code></pre></div>`
}

// Rewrite links so the hash router handles them.
md.renderer.rules.link_open = (tokens, idx, _options, env) => {
  const token = tokens[idx]
  const href = token.attrGet('href') ?? ''
  if (href.startsWith('/') && !href.startsWith('//')) {
    token.attrSet('href', `#${href}`)
  } else if (href.endsWith('.md') && !href.startsWith('http')) {
    const current = (env.currentFile as string | undefined) ?? ''
    const base = current.includes('/') ? current.slice(0, current.lastIndexOf('/') + 1) : ''
    const target = resolveRelative(base, href)
    const doc = DOCS.find((d) => d.file === target)
    if (doc) token.attrSet('href', `#/docs/${doc.section}/${doc.slug}`)
  } else if (/^https?:\/\//.test(href)) {
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noopener noreferrer')
  }
  return `<a${tokens[idx].attrs ? ' ' + tokens[idx].attrs.map((a) => `${a[0]}="${md.utils.escapeHtml(String(a[1]))}"`).join(' ') : ''}>`
}

function resolveRelative(base: string, relative: string): string {
  const parts = (base + relative).split('/')
  const out: string[] = []
  for (const part of parts) {
    if (part === '..') out.pop()
    else if (part !== '.') out.push(part)
  }
  return out.join('/')
}

export function renderDoc(source: string, currentFile: string): { html: string; headings: Heading[] } {
  const env = { currentFile }
  const tokens = md.parse(source, env)
  if (tokens[0]?.type === 'heading_open' && tokens[0].tag === 'h1') {
    tokens.splice(0, 3)
  }
  const headings: Heading[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type === 'heading_open') {
      const level = Number(token.tag.slice(1))
      if (level === 2 || level === 3) {
        headings.push({
          id: token.attrGet('id') ?? '',
          level,
          text: tokens[i + 1]?.content ?? '',
        })
      }
    }
  }
  const html = md.renderer.render(tokens, md.options, env)
  return { html, headings }
}

const sources = import.meta.glob('../../docs/**/*.md', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

export async function loadDocSource(file: string): Promise<string> {
  const key = `../../docs/${file}`
  const loader = sources[key]
  if (!loader) throw new Error(`文档不存在：${file}`)
  return await loader()
}
