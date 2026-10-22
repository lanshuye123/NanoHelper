/** Browser download helpers (no backend involved). */

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function downloadText(text: string, filename: string, mime = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([text], { type: mime }), filename)
}

/** Read a text file, falling back to GBK for legacy Chinese instrument exports. */
export async function readFileText(file: File): Promise<{ text: string; encoding: string; warnings: string[] }> {
  const buffer = await file.arrayBuffer()
  const warnings: string[] = []
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
    return { text: text.replace(/^\uFEFF/, ''), encoding: 'utf-8', warnings }
  } catch {
    try {
      const text = new TextDecoder('gbk').decode(buffer)
      warnings.push('文件不是有效的 UTF-8，已按 GBK 解码；请核对中文标题是否正常')
      return { text: text.replace(/^\uFEFF/, ''), encoding: 'gbk', warnings }
    } catch {
      const text = new TextDecoder('utf-8').decode(buffer)
      warnings.push('文件编码无法确定，已按 UTF-8 容错解码')
      return { text: text.replace(/^\uFEFF/, ''), encoding: 'utf-8', warnings }
    }
  }
}

export function safeFilename(name: string, extension: string): string {
  const base = (name || 'export')
    .replace(/\.[^.]+$/, '')
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .slice(0, 80)
  return `${base}.${extension.replace(/^\./, '')}`
}

export function timestamp(): string {
  const d = new Date()
  const pad = (v: number) => String(v).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`
}
