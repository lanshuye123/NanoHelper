/// <reference types="vite/client" />

declare const __APP_VERSION__: string
declare const __BUILD_TIME__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare module 'markdown-it-container' {
  import type MarkdownIt from 'markdown-it'
  interface ContainerOptions {
    validate?: (params: string) => boolean
    render?: (tokens: unknown[], idx: number) => string
  }
  const plugin: (md: MarkdownIt, name: string, options?: ContainerOptions) => void
  export default plugin
}
