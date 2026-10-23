<script setup lang="ts">
import { nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import { BookOpen, Database, ExternalLink, Lock, Ruler, ShieldCheck, Sparkles } from 'lucide-vue-next'

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
const buildTime = typeof __BUILD_TIME__ !== 'undefined' ? new Date(__BUILD_TIME__).toLocaleString('zh-CN') : '—'

const stack = [
  ['Vue 3', 'Composition API + TypeScript strict'],
  ['Vite', '静态构建，hash 路由，可直接托管'],
  ['Pinia', '数据集、步骤账本、结构与会话状态'],
  ['Element Plus', '表单、表格与交互组件（定制主题）'],
  ['自研 Canvas', '衍射图与曲线图，无图表库依赖'],
  ['KaTeX', '文档与工具页公式'],
  ['Vitest', '纯函数内核的单元测试'],
]

const shortcuts = [
  ['⌘ / Ctrl + K', '文档搜索（在文档页）'],
  ['⌘ / Ctrl + S', '浏览器保存当前页面（不拦截）'],
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
        一个面向纳米材料与晶体学课程的纯前端工具箱。把数据预处理、Jade 往返、倒易空间与
        衍射模拟放在同一个本地工作台里，所有计算都在你的浏览器中完成。
      </p>
      <div class="about-hero__meta">
        <span class="chip chip--mono">v{{ version }}</span>
        <span class="chip chip--mono">build {{ buildTime }}</span>
        <span class="chip chip--ok">无后端 · 无账号</span>
      </div>
    </header>

    <div class="about-grid">
      <section id="about-data" class="panel">
        <div class="panel__head">
          <h2 class="panel__title"><Database /> 数据来源</h2>
        </div>
        <div class="panel__body about-body">
          <p>
            <b>原子散射因子</b>采用 Waasmaier–Kirfel 五高斯参数化（DABAX <code>f0_WaasKirf.dat</code>，源自
            International Tables for Crystallography Vol. C）。
          </p>
          <p>
            <b>空间群</b>对称操作为 230 个空间群的标准化数据，按晶系拆分并按需加载； CIF 解析在本地完成，不依赖服务器。
          </p>
          <p>
            <b>晶体学公式</b>与《X 射线晶体学》《显微结构分析》课程笔记保持一致： 倒易基矢采用晶体学约定（省去
            2π），晶带方程 <span class="mono">hu+kv+lw=0</span>， 结构因子
            <span class="mono">F = Σ f exp(2πi(hx+ky+lz))</span>。
          </p>
        </div>
      </section>

      <section id="about-privacy" class="panel">
        <div class="panel__head">
          <h2 class="panel__title"><Lock /> 隐私与离线</h2>
        </div>
        <div class="panel__body about-body">
          <p>
            导入的文件只在当前标签页内解析；不会发起上传请求，也没有统计脚本或第三方 CDN。
            关闭页面后，数据不会被保留（除非你导出工程或配方）。
          </p>
          <p>
            站点可作为静态文件部署在 GitHub Pages、内网静态服务器或本地文件系统中。 推荐使用 Chrome / Edge / Firefox
            的较新版本。
          </p>
          <div class="privacy-note">
            <ShieldCheck />
            <span>无网络请求 · 无 Cookie · 无跟踪</span>
          </div>
        </div>
      </section>

      <section id="about-stack" class="panel">
        <div class="panel__head">
          <h2 class="panel__title"><Ruler /> 技术栈</h2>
        </div>
        <div class="panel__body">
          <div class="stack-list">
            <div v-for="[name, desc] in stack" :key="name" class="stack-row">
              <span class="stack-row__name">{{ name }}</span>
              <span class="stack-row__desc">{{ desc }}</span>
            </div>
          </div>
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
            }}（本地计算工具）。
          </p>
          <div class="cite-box mono">
            @software{{ '{' }}crystaltoolbox,<br />
            &nbsp;&nbsp;title = {{ '{' }}CrystalToolBox: 纳米材料与晶体学工具箱{{ '}' }},<br />
            &nbsp;&nbsp;version = {{ '{' }}{{ version }}{{ '}' }},<br />
            &nbsp;&nbsp;note = {{ '{' }}纯前端本地计算{{ '}' }}<br />
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
            采用运动学近似，未考虑动力学散射、HOLZ 与样品厚度；XRD 强度为相对值， 未包含仪器几何与样品吸收的完整校正。
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
      <RouterLink to="/docs/dev/architecture">开发者文档</RouterLink>
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
  padding: 26px 28px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background:
    radial-gradient(760px 300px at 0% 0%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 66%),
    linear-gradient(160deg, var(--surface), var(--bg-soft));
  box-shadow: var(--shadow-card);
  margin-bottom: 16px;
  position: relative;
  overflow: hidden;
}

.about-hero::after {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, var(--module-about), transparent 70%);
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
  font-size: clamp(28px, 3vw, 38px);
  font-weight: 780;
  letter-spacing: -0.03em;
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
