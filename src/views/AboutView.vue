<script setup lang="ts">
import { nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { BookOpen, Compass, Database, ExternalLink, Sparkles } from 'lucide-vue-next'

const route = useRoute()

watch(
  () => route.hash,
  async (hash) => {
    if (!hash) return
    await nextTick()
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  },
  { immediate: true },
)

const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0'
const scope = [
  ['数据处理', '导入、裁剪、平滑、扣背底、Kα2 与 Jade / Origin 往返'],
  ['衍射与晶体', '倒易空间、SAED 与 XRD 模拟、晶胞与密度、晶面与晶带'],
  ['显微分析', 'SEM/TEM 粒径统计、SAED 指标化、电镜参数与 CTF'],
  ['三维结构', '按空间群查看三维晶胞、Wyckoff 位置与原子点位'],
]

const shortcuts = [
  ['⌘ / Ctrl + K', '文档搜索（在文档页）'],
  ['⌘ / Ctrl + S', '保存当前页面'],
  ['双击图表', '恢复默认视图'],
  ['Alt / ⌘ + 滚轮', '缩放 Y 轴'],
]
</script>

<template>
  <div class="page about">
    <header id="about-overview" class="about-hero">
      <span class="about-hero__eyebrow"><Sparkles /> ABOUT</span>
      <h1>CrystalToolBox</h1>
      <p class="about-hero__sub">
        面向纳米材料、晶体学与电子显微分析的教学与科研辅助工具。把谱图处理、Jade 往返、倒易空间、衍射模拟、 SEM
        粒径统计与三维晶胞放在同一个工作台里。
      </p>
      <div class="about-hero__meta">
        <span class="chip chip--mono">v{{ version }}</span>
        <span class="chip chip--ok">教学 · 科研</span>
        <span class="chip">结果可导出</span>
      </div>
    </header>

    <div class="about-grid">
      <section id="about-data" class="panel">
        <div class="panel__head">
          <h2 class="panel__title"><Database /> 数据来源</h2>
        </div>
        <div class="panel__body about-body">
          <p>
            <b>原子散射因子</b>采用 Waasmaier–Kirfel 参数化，数据源自 International Tables for Crystallography Vol. C。
          </p>
          <p>
            <b>空间群与 Wyckoff 位置</b>采用 International Tables for Crystallography 的标准内容；三维晶胞查看器由
            CrystalViewer 提供。
          </p>
          <p>
            <b>晶体学公式</b>与《X 射线晶体学》《显微结构分析》课程笔记保持一致：倒易基矢采用晶体学约定（省去
            2π），晶带方程 <span class="mono">hu+kv+lw=0</span>，结构因子
            <span class="mono">F = Σ f exp(2πi(hx+ky+lz))</span>。
          </p>
        </div>
      </section>

      <section id="about-scope" class="panel">
        <div class="panel__head">
          <h2 class="panel__title"><Compass /> 功能范围</h2>
        </div>
        <div class="panel__body">
          <div class="stack-list">
            <div v-for="[name, desc] in scope" :key="name" class="stack-row">
              <span class="stack-row__name">{{ name }}</span>
              <span class="stack-row__desc">{{ desc }}</span>
            </div>
          </div>
          <p class="tiny dim" style="margin-top: 10px">
            结果可导出为 CSV、TXT、PNG 或工程文件；离开页面前请保存需要的数据。
          </p>
        </div>
      </section>

      <section id="about-docs" class="panel">
        <div class="panel__head">
          <h2 class="panel__title"><BookOpen /> 文档与引用</h2>
        </div>
        <div class="panel__body about-body">
          <p>
            使用前建议先读<a href="#/docs/userguide/getting-started">快速开始</a>； 需要具体任务时查阅<a
              href="#/docs/cookbook/raman-to-jade"
              >实战手册</a
            >； 文件格式与公式在<a href="#/docs/reference/file-formats">功能说明</a>中。
          </p>
          <p class="tiny dim">
            若在课程作业或论文中使用本工具，可引用为：CrystalToolBox, 纳米材料与晶体学工具箱, v{{
              version
            }}（教学与科研辅助工具）。
          </p>
          <div class="cite-box mono">
            @software{{ '{' }}crystaltoolbox,<br />
            &nbsp;&nbsp;title = {{ '{' }}CrystalToolBox: 纳米材料与晶体学工具箱{{ '}' }},<br />
            &nbsp;&nbsp;version = {{ '{' }}{{ version }}{{ '}' }},<br />
            &nbsp;&nbsp;note = {{ '{' }}教学与科研辅助{{ '}' }}<br />
            }
          </div>
        </div>
      </section>

      <section id="about-shortcuts" class="panel">
        <div class="panel__head">
          <h2 class="panel__title"><Sparkles /> 快捷键</h2>
        </div>
        <div class="panel__body">
          <div class="shortcut-list">
            <div v-for="[key, desc] in shortcuts" :key="key" class="shortcut-row">
              <span class="mono">{{ key }}</span>
              <span>{{ desc }}</span>
            </div>
          </div>
        </div>
      </section>

      <section id="about-limits" class="panel">
        <div class="panel__head">
          <h2 class="panel__title"><ExternalLink /> 边界与声明</h2>
        </div>
        <div class="panel__body about-body">
          <p>
            本工具用于教学辅助与数据整理，不替代专业 Rietveld 精修、晶体结构解析或仪器厂商软件。 SAED
            采用运动学近似，未考虑动力学散射、HOLZ 与样品厚度；SAED 指标化只用两个斑点，存在 180° 不确定性； XRD
            强度为相对值，未包含仪器几何与样品吸收的完整校正。晶格精修只做峰位；颗粒自动识别不做分水岭，粘连颗粒会合并。
          </p>
          <p class="tiny dim">
            代码以 MIT 许可发布；第三方数据遵循其原始许可。发现解析异常时，请保留原始文件以便定位。
          </p>
        </div>
      </section>
    </div>

    <footer class="about-foot">
      <span>CrystalToolBox · 晶体学工具箱</span>
      <RouterLink to="/docs/reference/changelog">版本记录</RouterLink>
      <RouterLink to="/">返回首页</RouterLink>
    </footer>
  </div>
</template>

<style scoped>
.about {
  max-width: 1180px;
}

.about section[id],
.about header[id] {
  scroll-margin-top: 12px;
}

.about-hero {
  padding: 24px 26px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  margin-bottom: 14px;
}

.about-hero__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 9.5px;
  letter-spacing: 0.14em;
  color: var(--accent);
}

.about-hero__eyebrow svg {
  width: 13px;
  height: 13px;
}

.about-hero h1 {
  font-size: clamp(25px, 2.6vw, 34px);
  font-weight: 740;
  letter-spacing: -0.025em;
  margin-top: 6px;
}

.about-hero__sub {
  max-width: 720px;
  margin-top: 7px;
  font-size: 13px;
  line-height: 1.75;
  color: var(--text-2);
}

.about-hero__meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.about-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.about-body p {
  font-size: 12px;
  line-height: 1.75;
  color: var(--text-2);
}

.about-body p + p {
  margin-top: 9px;
}

.about-body b {
  color: var(--text);
}

.about-body code {
  font-size: 10.5px;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--code-bg);
  border: 1px solid var(--border-soft);
  color: var(--accent);
}

.privacy-note {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 11px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--ok-soft);
  border: 1px solid color-mix(in srgb, var(--ok) 25%, transparent);
  color: var(--ok);
  font-size: 11px;
}

.privacy-note svg {
  width: 14px;
  height: 14px;
}

.stack-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stack-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 5px 0;
  border-bottom: 1px solid var(--border-soft);
  font-size: 11.5px;
}

.stack-row:last-child {
  border-bottom: none;
}

.stack-row__name {
  min-width: 110px;
  color: var(--text);
  font-weight: 600;
}

.stack-row__desc {
  color: var(--text-3);
  font-size: 11px;
}

.cite-box {
  margin-top: 11px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--code-bg);
  font-size: 10px;
  line-height: 1.7;
  color: var(--text-2);
  overflow-x: auto;
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.shortcut-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 11px;
  color: var(--text-2);
}

.shortcut-row .mono {
  color: var(--text-3);
  font-size: 10px;
}

.about-foot {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 22px;
  padding-top: 12px;
  border-top: 1px solid var(--border-soft);
  font-size: 10.5px;
  color: var(--text-3);
}

.about-foot a:nth-last-child(1) {
  margin-left: auto;
}

@media (max-width: 800px) {
  .about-grid {
    grid-template-columns: 1fr;
  }
}
</style>
