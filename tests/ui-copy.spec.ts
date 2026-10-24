import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOTS = ['src/views', 'src/components', 'src/config/navigation.ts']

/** Phrases that must never reach the final user interface. See AGENTS.md. */
const BANNED = [
  '本地运行',
  '数据不上传',
  '不会上传',
  '数据不离开',
  '纯前端',
  '无后端',
  '无账号',
  '浏览器本地',
  '浏览器中完成',
  '离线可用',
  '同源',
  '静态构建',
  '构建产物',
  '技术栈',
  'public/crystal-viewer',
  '浏览器拒绝',
  '剪贴板',
  '无法创建检测画布',
  '画布',
  'iframe 嵌入',
  '通过 iframe',
]

function collect(path: string): string[] {
  const stat = statSync(path)
  if (stat.isFile()) return [path]
  return readdirSync(path).flatMap((name) => collect(join(path, name)))
}

describe('final UI copy governance', () => {
  const files = ROOTS.flatMap((root) => collect(root)).filter((file) => /\.(vue|ts)$/.test(file))

  for (const phrase of BANNED) {
    it(`does not expose “${phrase}”`, () => {
      const offenders = files.filter((file) => readFileSync(file, 'utf8').includes(phrase))
      expect(offenders, `${phrase} found in ${offenders.join(', ')}`).toEqual([])
    })
  }
})
