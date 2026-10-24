<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Box, ExternalLink, Maximize2, RefreshCw } from 'lucide-vue-next'
import ToolPage from '@/components/layout/ToolPage.vue'
import PanelCard from '@/components/common/PanelCard.vue'

const frame = ref<HTMLIFrameElement | null>(null)
const reloadKey = ref(0)
const embedSrc = computed(() => `${import.meta.env.BASE_URL}crystal-viewer/index.html`)

function reload() {
  reloadKey.value++
  ElMessage.success('已重新载入三维晶胞')
}

function openNewWindow() {
  window.open(embedSrc.value, '_blank', 'noopener')
}

async function fullscreen() {
  const el = frame.value
  if (!el) return
  try {
    await el.requestFullscreen()
  } catch {
    ElMessage.warning('无法进入全屏，可在新窗口打开')
  }
}
</script>

<template>
  <ToolPage
    tool-id="crystal-viewer"
    title="三维晶胞查看器"
    subtitle="输入空间群编号或符号，查看三维晶胞、Wyckoff 位置与原子点位。可全屏或在新窗口打开，方便对照。"
    eyebrow="晶体几何 · 06"
    doc="/docs/userguide/crystal-viewer"
  >
    <template #source>
      <PanelCard title="使用提示" :icon="Box">
        <ul class="tips">
          <li>输入空间群编号（如 225）或符号（如 Fm-3m）查询。</li>
          <li>在视图中拖拽旋转、滚轮缩放；右侧查看 Wyckoff 位置、原子点位与显示设置。</li>
          <li>需要更大视图时，使用「全屏」或「新窗口」。</li>
          <li>不同空间群的晶胞形状与原子排布差异很大，建议结合晶格参数一起看。</li>
        </ul>
      </PanelCard>
    </template>

    <template #config>
      <PanelCard title="视图" :icon="Maximize2">
        <div class="btn-row">
          <button type="button" class="btn btn--quiet" @click="reload"><RefreshCw /> 重新载入</button>
          <button type="button" class="btn btn--quiet" @click="openNewWindow"><ExternalLink /> 新窗口</button>
          <button type="button" class="btn btn--quiet" @click="fullscreen"><Maximize2 /> 全屏</button>
        </div>
        <p class="tiny dim">如果视图没有显示，请在新窗口中打开。</p>
      </PanelCard>
    </template>

    <div class="viewer-toolbar">
      <div class="viewer-toolbar__info">
        <span class="chip chip--accent"><Box /> CrystalViewer</span>
        <span class="chip">三维晶胞</span>
        <span class="chip">空间群 230 种</span>
      </div>
      <div class="viewer-toolbar__actions">
        <button type="button" class="btn btn--quiet" @click="reload"><RefreshCw /> 重新载入</button>
        <button type="button" class="btn btn--quiet" @click="openNewWindow"><ExternalLink /> 新窗口</button>
        <button type="button" class="btn btn--quiet" @click="fullscreen"><Maximize2 /> 全屏</button>
      </div>
    </div>

    <div class="embed-shell">
      <iframe
        :key="reloadKey"
        ref="frame"
        :src="embedSrc"
        class="embed-frame"
        title="三维晶胞查看器"
        allow="fullscreen"
        allowfullscreen
        referrerpolicy="no-referrer"
      />
    </div>

    <p class="tiny dim embed-note">如视图未显示，请使用「新窗口」打开。</p>
  </ToolPage>
</template>

<style scoped>
.viewer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.viewer-toolbar__info,
.viewer-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.embed-shell {
  width: 100%;
  height: min(78vh, 920px);
  min-height: 560px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface-2);
  box-shadow: var(--shadow-card);
}

.embed-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #ffffff;
}

.embed-note {
  margin-top: 6px;
}

.tips {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--text-2);
}

@media (max-width: 900px) {
  .embed-shell {
    height: 72vh;
    min-height: 480px;
  }
}
</style>
