<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowRight, BookOpen, FlaskConical, LineChart, Sparkles, Table2, Upload } from 'lucide-vue-next'
import { NAV_MODULES } from '@/config/navigation'
import { loadSample, type SampleId } from '@/data/samples'
import { useProjectStore } from '@/stores/project'
import MathText from '@/components/common/MathText.vue'

const router = useRouter()
const project = useProjectStore()

const featureModules = NAV_MODULES.filter((module) => ['data', 'diffraction', 'crystal', 'docs'].includes(module.key))

const heroStats = [
  { value: '7', label: '个工具页面' },
  { value: '3', label: '个计算模块' },
  { value: '100%', label: '浏览器本地计算' },
]

const workflow = [
  { step: '01', title: '导入', desc: 'CSV / XY / DIF / XRDML，自动嗅探与列映射' },
  { step: '02', title: '预处理', desc: '裁剪、平滑、扣背底、Kα2、归一化' },
  { step: '03', title: '映射', desc: 'X∈[0,140]、Y>0，生成可逆配方' },
  { step: '04', title: '回归', desc: 'DIF→XY 反算回原始坐标，送入 Origin' },
]

const formulas = [
  { label: 'Bragg', tex: '2d\\sin\\theta=\\lambda' },
  { label: 'd-spacing', tex: '\\frac{1}{d^2}=h^2a^{*2}+k^2b^{*2}+l^2c^{*2}+2hk\\,a^*b^*\\cos\\gamma^*+\\cdots' },
  { label: 'Zone law', tex: 'hu+kv+lw=0' },
]

async function openSample(id: SampleId) {
  try {
    const sample = await loadSample(id)
    project.loadPattern(sample.pattern, { name: sample.title, format: '示例数据' })
    router.push('/data/import')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : String(error))
  }
}
</script>

<template>
  <div class="page dashboard">
    <section class="hero">
      <div class="hero__content">
        <span class="hero__eyebrow">
          <Sparkles />
          NANOMATERIALS · CRYSTALLOGRAPHY · DIFFRACTION
        </span>
        <h1 class="hero__title">
          把课程里的计算，<br />
          变成随手可用的工具。
        </h1>
        <p class="hero__sub">
          从原始谱图到 Jade 拟合，从倒易空间到带轴电子衍射。所有解析与计算都在浏览器中完成， 数据不离开你的电脑。
        </p>
        <div class="hero__actions">
          <el-button type="primary" @click="router.push('/data/import')">
            <Upload class="btn-icon" /> 开始导入
          </el-button>
          <el-button plain @click="router.push('/docs/userguide/getting-started')">
            <BookOpen class="btn-icon" /> 阅读用户指南
          </el-button>
        </div>
        <div class="hero__stats">
          <div v-for="item in heroStats" :key="item.label" class="hero__stat">
            <span class="hero__stat-value mono">{{ item.value }}</span>
            <span class="hero__stat-label">{{ item.label }}</span>
          </div>
        </div>
      </div>

      <div class="hero__visual" aria-hidden="true">
        <svg viewBox="0 0 320 300" class="lattice">
          <defs>
            <linearGradient id="hero-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style="stop-color: var(--accent)" />
              <stop offset="1" style="stop-color: var(--accent-2)" />
            </linearGradient>
            <radialGradient id="hero-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0" style="stop-color: var(--accent); stop-opacity: 0.18" />
              <stop offset="1" style="stop-color: var(--accent); stop-opacity: 0" />
            </radialGradient>
          </defs>
          <circle cx="160" cy="150" r="130" fill="url(#hero-glow)" />
          <g class="lattice__lines" opacity="0.62">
            <path d="M40 150 L160 30 L280 150 L160 270 Z" />
            <path d="M70 150 L160 60 L250 150 L160 240 Z" opacity="0.55" />
            <path d="M100 150 L160 90 L220 150 L160 210 Z" opacity="0.4" />
          </g>
          <g class="lattice__nodes">
            <circle cx="160" cy="150" r="3.2" />
            <circle cx="160" cy="90" r="2.2" />
            <circle cx="220" cy="150" r="2.2" />
            <circle cx="160" cy="210" r="2.2" />
            <circle cx="100" cy="150" r="2.2" />
            <circle cx="130" cy="120" r="1.6" opacity="0.8" />
            <circle cx="190" cy="120" r="1.6" opacity="0.8" />
            <circle cx="190" cy="180" r="1.6" opacity="0.8" />
            <circle cx="130" cy="180" r="1.6" opacity="0.8" />
            <circle cx="160" cy="30" r="2" opacity="0.85" />
            <circle cx="280" cy="150" r="2" opacity="0.85" />
            <circle cx="160" cy="270" r="2" opacity="0.85" />
            <circle cx="40" cy="150" r="2" opacity="0.85" />
          </g>
          <g class="lattice__nodes lattice__nodes--soft">
            <circle cx="115" cy="105" r="1.4" />
            <circle cx="205" cy="105" r="1.4" />
            <circle cx="205" cy="195" r="1.4" />
            <circle cx="115" cy="195" r="1.4" />
          </g>
          <g class="lattice__labels">
            <text x="164" y="84">002</text>
            <text x="226" y="147">200</text>
            <text x="164" y="224">00-2</text>
            <text x="66" y="147">-200</text>
            <text x="151" y="160">000</text>
          </g>
        </svg>
        <div class="hero__visual-caption mono">[uvw] = [001] · ZOLZ</div>
      </div>
    </section>

    <section class="section">
      <div class="section__head">
        <div>
          <span class="section-label">MODULES</span>
          <h2 class="section__title">三个计算模块，一个文档中心</h2>
        </div>
        <span class="chip chip--accent">纯前端 · 离线可用</span>
      </div>
      <div class="module-grid">
        <article
          v-for="module in featureModules"
          :key="module.key"
          class="module-card"
          :style="{ '--card-accent': module.accent }"
        >
          <header class="module-card__head">
            <span class="module-card__icon"><component :is="module.icon" /></span>
            <span class="module-card__copy">
              <b>{{ module.label }}</b>
              <small>{{ module.description }}</small>
            </span>
            <span class="module-card__count mono">{{ module.items.length }} 页</span>
          </header>
          <ul class="module-card__list">
            <li v-for="item in module.items" :key="item.id">
              <RouterLink :to="item.path">
                <span class="module-card__item-icon"><component :is="item.icon" /></span>
                <span class="module-card__item-label">{{ item.label }}</span>
                <ArrowRight class="module-card__item-arrow" />
              </RouterLink>
            </li>
          </ul>
          <div v-if="module.highlights?.length && module.items.length < 4" class="module-card__tags">
            <span v-for="tag in module.highlights" :key="tag">{{ tag }}</span>
          </div>
          <RouterLink :to="module.path" class="module-card__go">
            进入{{ module.label }}
            <ArrowRight />
          </RouterLink>
        </article>
      </div>
    </section>

    <section class="section workflow-section">
      <div class="section__head">
        <div>
          <span class="section-label">WORKFLOW</span>
          <h2 class="section__title">一条配方，贯穿导入到 Origin</h2>
        </div>
        <RouterLink to="/docs/cookbook/raman-to-jade" class="section__link"> 查看完整示例 <ArrowRight /> </RouterLink>
      </div>
      <div class="workflow-grid">
        <div v-for="item in workflow" :key="item.step" class="workflow-card">
          <span class="workflow-card__step mono">{{ item.step }}</span>
          <span class="workflow-card__title">{{ item.title }}</span>
          <span class="workflow-card__desc">{{ item.desc }}</span>
        </div>
      </div>
      <div class="formula-strip">
        <span class="formula-strip__label">核心公式</span>
        <div v-for="f in formulas" :key="f.label" class="formula-strip__item">
          <span class="formula-strip__name">{{ f.label }}</span>
          <MathText :tex="f.tex" />
        </div>
      </div>
    </section>

    <section class="two-col">
      <div class="panel">
        <div class="panel__head">
          <h2 class="panel__title"><Sparkles /> 快速开始</h2>
          <span class="panel__hint">无需准备文件</span>
        </div>
        <div class="panel__body">
          <div class="quick-grid">
            <button class="quick-card" type="button" @click="openSample('raman-anatase')">
              <FlaskConical />
              <span><b>Raman → Jade</b><small>体验非衍射数据映射与逆处理</small></span>
            </button>
            <button class="quick-card" type="button" @click="openSample('dif-demo06')">
              <Table2 />
              <span><b>DIF → Origin</b><small>真实 Jade 拟合结果的 6 条曲线</small></span>
            </button>
            <button class="quick-card" type="button" @click="openSample('xrd-anatase')">
              <LineChart />
              <span><b>锐钛矿 XRD</b><small>查看峰位、Kα2 与 Jade 导出</small></span>
            </button>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel__head">
          <h2 class="panel__title"><BookOpen /> 文档入口</h2>
          <RouterLink to="/docs/userguide/getting-started" class="panel__link">全部文档</RouterLink>
        </div>
        <div class="panel__body docs-list">
          <RouterLink to="/docs/userguide/getting-started" class="docs-item">
            <span class="docs-item__badge">指南</span>
            <span><b>快速开始</b><small>界面、数据流与第一个结果</small></span>
            <ArrowRight />
          </RouterLink>
          <RouterLink to="/docs/cookbook/raman-to-jade" class="docs-item">
            <span class="docs-item__badge">实战</span>
            <span><b>Raman → Jade → Origin</b><small>含可复现数据与逐步说明</small></span>
            <ArrowRight />
          </RouterLink>
          <RouterLink to="/docs/reference/file-formats" class="docs-item">
            <span class="docs-item__badge">参考</span>
            <span><b>文件格式</b><small>Jade XY / DIF / recipe 规范</small></span>
            <ArrowRight />
          </RouterLink>
          <RouterLink to="/docs/reference/formulas" class="docs-item">
            <span class="docs-item__badge">公式</span>
            <span><b>公式与推导</b><small>倒易空间、结构因子、SAED</small></span>
            <ArrowRight />
          </RouterLink>
        </div>
      </div>
    </section>

    <footer class="dash-foot">
      <span class="mono">CrystalToolBox v0.1.0</span>
      <span class="dim">数据本地处理 · 无账号 · 无上传</span>
      <RouterLink to="/about">关于与引用</RouterLink>
    </footer>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 26px;
}

/* ------------------------------------------------------------- hero */

.hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(280px, 0.88fr);
  gap: 18px;
  padding: 32px 34px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background:
    radial-gradient(760px 320px at 0% 0%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 66%),
    radial-gradient(620px 340px at 100% 100%, color-mix(in srgb, var(--accent-2) 10%, transparent), transparent 62%),
    linear-gradient(160deg, var(--surface), var(--bg-soft));
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(640px 340px at 72% 42%, #000 0%, transparent 78%);
  opacity: 0.7;
}

.hero__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
}

.hero__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 9px;
  border: 1px solid var(--accent-line);
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  font-size: 9px;
  font-weight: 650;
  letter-spacing: 0.12em;
  color: var(--accent);
}

.hero__eyebrow svg {
  width: 12px;
  height: 12px;
}

.hero__title {
  font-size: clamp(29px, 3vw, 42px);
  line-height: 1.17;
  font-weight: 780;
  letter-spacing: -0.035em;
  color: var(--text);
}

.hero__sub {
  max-width: 580px;
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--text-2);
}

.hero__actions {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.hero__stats {
  display: flex;
  gap: 28px;
  margin-top: 8px;
  padding-top: 15px;
  border-top: 1px solid var(--border);
  width: 100%;
}

.hero__stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.hero__stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent);
}

.hero__stat-label {
  font-size: 9.5px;
  color: var(--text-3);
  letter-spacing: 0.04em;
}

.hero__visual {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 260px;
}

.lattice {
  width: 100%;
  max-width: 340px;
  height: auto;
  filter: drop-shadow(0 14px 36px color-mix(in srgb, var(--accent) 16%, transparent));
}

.lattice__lines {
  fill: none;
  stroke: url(#hero-grad);
  stroke-width: 0.7;
}

.lattice__nodes {
  fill: var(--accent);
}

.lattice__nodes--soft {
  fill: var(--accent-2);
  opacity: 0.8;
}

.lattice__labels {
  fill: var(--text-3);
  font-family: var(--font-mono);
  font-size: 8px;
}

.hero__visual-caption {
  position: absolute;
  bottom: 2px;
  right: 6px;
  font-size: 9px;
  color: var(--text-3);
  letter-spacing: 0.04em;
}

.btn-icon {
  width: 13px;
  height: 13px;
  margin-right: 4px;
}

/* ------------------------------------------------------------- sections */

.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.section__title {
  font-size: 19px;
  font-weight: 720;
  letter-spacing: -0.02em;
  margin-top: 3px;
  color: var(--text);
}

.section__link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-2);
}

.section__link:hover {
  color: var(--accent);
  text-decoration: none;
}

.section__link svg {
  width: 13px;
  height: 13px;
}

/* ------------------------------------------------------------- module cards */

.module-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.module-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 14px 14px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition:
    border-color var(--duration) var(--ease),
    box-shadow var(--duration) var(--ease),
    transform var(--duration) var(--ease);
}

.module-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, var(--card-accent), color-mix(in srgb, var(--card-accent) 25%, transparent));
}

.module-card:hover {
  border-color: color-mix(in srgb, var(--card-accent) 42%, var(--border));
  box-shadow: var(--shadow-card);
  transform: translateY(-2px);
}

.module-card__head {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-bottom: 11px;
}

.module-card__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--card-accent) 12%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--card-accent) 24%, transparent);
  color: var(--card-accent);
}

.module-card__icon svg {
  width: 17px;
  height: 17px;
}

.module-card__copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.module-card__copy b {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}

.module-card__copy small {
  font-size: 9.5px;
  line-height: 1.5;
  color: var(--text-3);
}

.module-card__count {
  flex: 0 0 auto;
  font-size: 9px;
  color: var(--text-3);
}

.module-card__list {
  list-style: none;
  margin: 0;
  padding: 8px 0;
  border-top: 1px solid var(--border-soft);
  flex: 1;
}

.module-card__list li + li {
  margin-top: 1px;
}

.module-card__list a {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 6px;
  border-radius: var(--radius-xs);
  color: var(--text-2);
  font-size: 11px;
  text-decoration: none;
  transition:
    background var(--duration) var(--ease),
    color var(--duration) var(--ease);
}

.module-card__list a:hover {
  background: color-mix(in srgb, var(--card-accent) 8%, var(--surface));
  color: var(--card-accent);
  text-decoration: none;
}

.module-card__item-icon {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  color: var(--card-accent);
  opacity: 0.85;
}

.module-card__item-icon svg {
  width: 12px;
  height: 12px;
}

.module-card__item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.module-card__item-arrow {
  width: 11px;
  height: 11px;
  opacity: 0;
  transition:
    opacity var(--duration) var(--ease),
    transform var(--duration) var(--ease);
}

.module-card__list a:hover .module-card__item-arrow {
  opacity: 1;
  transform: translateX(2px);
}

.module-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 10px 0 2px;
}

.module-card__tags span {
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  color: var(--text-3);
  font-size: 8.5px;
  white-space: nowrap;
}

.module-card__go {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 6px;
  padding: 7px 9px;
  border: 1px solid color-mix(in srgb, var(--card-accent) 26%, transparent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--card-accent) 7%, var(--surface));
  color: var(--card-accent);
  font-size: 10.5px;
  font-weight: 600;
  text-decoration: none;
}

.module-card__go:hover {
  background: color-mix(in srgb, var(--card-accent) 13%, var(--surface));
  text-decoration: none;
}

.module-card__go svg {
  width: 12px;
  height: 12px;
}

/* ------------------------------------------------------------- workflow */

.workflow-section {
  gap: 12px;
}

.workflow-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9px;
}

.workflow-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 12px 13px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.workflow-card__step {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--accent);
}

.workflow-card__title {
  font-size: 12px;
  font-weight: 680;
  color: var(--text);
}

.workflow-card__desc {
  font-size: 10px;
  line-height: 1.55;
  color: var(--text-3);
}

.formula-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 18px;
  padding: 12px 15px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
}

.formula-strip__label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
}

.formula-strip__item {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 10.5px;
  color: var(--text-2);
}

.formula-strip__name {
  font-weight: 650;
  color: var(--text-3);
}

/* ------------------------------------------------------------- two column */

.two-col {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
}

.panel__link {
  font-size: 10.5px;
  color: var(--accent);
}

.quick-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-2);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color var(--duration) var(--ease),
    background var(--duration) var(--ease),
    transform var(--duration) var(--ease);
}

.quick-card:hover {
  border-color: var(--accent-line);
  background: var(--accent-soft);
  transform: translateX(2px);
}

.quick-card > svg {
  width: 17px;
  height: 17px;
  flex: 0 0 auto;
  color: var(--accent);
}

.quick-card span {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.quick-card b {
  font-size: 11.5px;
  font-weight: 650;
  color: var(--text);
}

.quick-card small {
  font-size: 9.5px;
  color: var(--text-3);
}

.docs-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.docs-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 8px;
  border-radius: var(--radius-sm);
  color: var(--text-2);
  text-decoration: none;
  transition: background var(--duration) var(--ease);
}

.docs-item:hover {
  background: var(--surface-2);
  text-decoration: none;
}

.docs-item__badge {
  display: grid;
  place-items: center;
  flex: 0 0 34px;
  height: 24px;
  border-radius: var(--radius-xs);
  background: var(--accent-soft);
  border: 1px solid var(--accent-line);
  color: var(--accent);
  font-size: 9px;
  font-weight: 650;
}

.docs-item > span:nth-child(2) {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.docs-item b {
  font-size: 11.5px;
  font-weight: 650;
  color: var(--text);
}

.docs-item small {
  font-size: 9.5px;
  color: var(--text-3);
}

.docs-item > svg {
  width: 12px;
  height: 12px;
  color: var(--text-3);
}

.dash-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 6px;
  border-top: 1px solid var(--border-soft);
  font-size: 10px;
  color: var(--text-3);
}

.dash-foot a {
  color: var(--text-2);
}

@media (max-width: 1380px) {
  .module-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1080px) {
  .hero {
    grid-template-columns: minmax(0, 1fr);
    padding: 26px 24px;
  }

  .hero__visual {
    min-height: 210px;
  }

  .lattice {
    max-width: 280px;
  }

  .workflow-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .two-col {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .hero {
    padding: 22px 18px;
  }

  .hero__eyebrow {
    font-size: 8px;
    letter-spacing: 0.08em;
  }

  .hero__visual {
    min-height: 0;
    margin-top: 2px;
  }

  .lattice {
    max-width: 210px;
  }

  .module-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .workflow-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero__stats {
    gap: 20px;
  }

  .dash-foot {
    flex-wrap: wrap;
  }
}
</style>
