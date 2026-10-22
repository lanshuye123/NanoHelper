<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowRight,
  BookOpen,
  FlaskConical,
  LineChart,
  Sparkles,
  Table2,
  Upload,
} from 'lucide-vue-next'
import { tools } from '@/tools/registry'
import { loadSample, type SampleId } from '@/data/samples'
import { useProjectStore } from '@/stores/project'
import MathText from '@/components/common/MathText.vue'

const router = useRouter()
const project = useProjectStore()

const heroStats = [
  { value: '7', label: '个工具模块' },
  { value: '3', label: '类数据工作流' },
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
          从原始谱图到 Jade 拟合，从倒易空间到带轴电子衍射。所有解析与计算都在浏览器中完成，
          数据不离开你的电脑。
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
              <stop stop-color="#22d3ee" />
              <stop offset="1" stop-color="#6366f1" />
            </linearGradient>
            <radialGradient id="hero-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0" stop-color="#22d3ee" stop-opacity="0.24" />
              <stop offset="1" stop-color="#22d3ee" stop-opacity="0" />
            </radialGradient>
          </defs>
          <circle cx="160" cy="150" r="130" fill="url(#hero-glow)" />
          <g opacity="0.55" stroke="url(#hero-grad)" stroke-width="0.6" fill="none">
            <path d="M40 150 L160 30 L280 150 L160 270 Z" />
            <path d="M70 150 L160 60 L250 150 L160 240 Z" opacity="0.5" />
            <path d="M100 150 L160 90 L220 150 L160 210 Z" opacity="0.35" />
          </g>
          <g fill="#22d3ee">
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
          <g fill="#a5b4fc" opacity="0.8">
            <circle cx="115" cy="105" r="1.4" />
            <circle cx="205" cy="105" r="1.4" />
            <circle cx="205" cy="195" r="1.4" />
            <circle cx="115" cy="195" r="1.4" />
          </g>
          <text x="164" y="84" fill="#94a3b8" font-size="8" font-family="monospace">002</text>
          <text x="226" y="147" fill="#94a3b8" font-size="8" font-family="monospace">200</text>
          <text x="164" y="224" fill="#94a3b8" font-size="8" font-family="monospace">00-2</text>
          <text x="66" y="147" fill="#94a3b8" font-size="8" font-family="monospace">-200</text>
          <text x="151" y="160" fill="#e2e8f0" font-size="8" font-family="monospace">000</text>
        </svg>
        <div class="hero__visual-caption mono">[uvw] = [001] · ZOLZ</div>
      </div>
    </section>

    <section class="section">
      <div class="section__head">
        <div>
          <span class="section-label">TOOLBOX</span>
          <h2 class="section__title">七个工具，覆盖三条课程主线</h2>
        </div>
        <span class="chip chip--accent">纯前端 · 离线可用</span>
      </div>
      <div class="tool-grid">
        <RouterLink v-for="tool in tools" :key="tool.id" :to="tool.path" class="tool-card">
          <span class="tool-card__icon"><component :is="tool.icon" /></span>
          <span class="tool-card__body">
            <span class="tool-card__title">
              {{ tool.title }}
              <span v-if="tool.status === 'beta'" class="chip chip--accent tiny">beta</span>
            </span>
            <span class="tool-card__sub">{{ tool.subtitle }}</span>
          </span>
          <ArrowRight class="tool-card__arrow" />
        </RouterLink>
      </div>
    </section>

    <section class="section workflow-section">
      <div class="section__head">
        <div>
          <span class="section-label">WORKFLOW</span>
          <h2 class="section__title">一条配方，贯穿导入到 Origin</h2>
        </div>
        <RouterLink to="/docs/cookbook/raman-to-jade" class="section__link">
          查看完整示例 <ArrowRight />
        </RouterLink>
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
        </div>
        <div class="panel__body docs-list">
          <RouterLink to="/docs/userguide/getting-started" class="docs-item">
            <span class="docs-item__badge">指南</span>
            <span><b>快速开始</b><small>界面、数据流与第一个结果</small></span>
            <ArrowRight />
          </RouterLink>
          <RouterLink to="/docs/cookbook/raman-to-jade" class="docs-item">
            <span class="docs-item__badge">实战</span>
            <span><b>Raman → Jade → Origin</b><small>含可复现数据与逐步截图位</small></span>
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

.hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
  gap: 18px;
  padding: 30px 32px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background:
    radial-gradient(700px 300px at 0% 0%, rgba(34, 211, 238, 0.08), transparent 65%),
    radial-gradient(600px 320px at 100% 100%, rgba(99, 102, 241, 0.09), transparent 60%),
    linear-gradient(160deg, var(--surface), var(--bg-soft));
  overflow: hidden;
}

.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(600px 320px at 70% 40%, #000 0%, transparent 78%);
  opacity: 0.6;
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
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--accent);
}

.hero__eyebrow svg {
  width: 13px;
  height: 13px;
}

.hero__title {
  font-size: clamp(30px, 3.2vw, 44px);
  line-height: 1.16;
  font-weight: 780;
  letter-spacing: -0.035em;
  background: linear-gradient(120deg, var(--text) 25%, color-mix(in srgb, var(--accent) 70%, var(--text)));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero__sub {
  max-width: 580px;
  font-size: 13px;
  line-height: 1.75;
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
  gap: 26px;
  margin-top: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--border-soft);
  width: 100%;
}

.hero__stat {
  display: flex;
  flex-direction: column;
}

.hero__stat-value {
  font-size: 19px;
  font-weight: 650;
  color: var(--text);
}

.hero__stat-label {
  font-size: 10px;
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
  filter: drop-shadow(0 14px 40px rgba(34, 211, 238, 0.12));
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
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-top: 3px;
}

.section__link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
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

.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}

.tool-card {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 13px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  text-decoration: none;
  transition: border-color 0.16s, background 0.16s, transform 0.16s, box-shadow 0.16s;
}

.tool-card:hover {
  border-color: var(--accent-line);
  background: var(--surface-2);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
  text-decoration: none;
}

.tool-card__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
  flex: 0 0 auto;
}

.tool-card__icon svg {
  width: 17px;
  height: 17px;
}

.tool-card__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.tool-card__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 650;
  color: var(--text);
}

.tool-card__sub {
  font-size: 10.5px;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-card__arrow {
  width: 14px;
  height: 14px;
  margin-left: auto;
  color: var(--text-3);
  opacity: 0;
  transition: opacity 0.16s, transform 0.16s;
}

.tool-card:hover .tool-card__arrow {
  opacity: 1;
  transform: translateX(2px);
  color: var(--accent);
}

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
  overflow: hidden;
}

.workflow-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(180deg, var(--accent), var(--accent-2));
}

.workflow-card__step {
  font-size: 9.5px;
  color: var(--accent);
  letter-spacing: 0.06em;
}

.workflow-card__title {
  font-size: 12.5px;
  font-weight: 650;
  color: var(--text);
}

.workflow-card__desc {
  font-size: 10.5px;
  color: var(--text-3);
  line-height: 1.5;
}

.formula-strip {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  padding: 11px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-soft);
  background: var(--surface-2);
}

.formula-strip__label {
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
}

.formula-strip__item {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-2);
}

.formula-strip__name {
  font-size: 10px;
  color: var(--text-3);
}

.two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  align-items: start;
}

.quick-grid {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.quick-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-soft);
  background: var(--surface-2);
  color: var(--text-2);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.quick-card:hover {
  border-color: var(--accent-line);
  background: var(--accent-soft);
}

.quick-card > svg {
  width: 16px;
  height: 16px;
  color: var(--accent);
  flex: 0 0 auto;
}

.quick-card span {
  display: flex;
  flex-direction: column;
  line-height: 1.4;
}

.quick-card b {
  font-size: 11.5px;
  color: var(--text);
  font-weight: 600;
}

.quick-card small {
  font-size: 10px;
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
  padding: 8px 9px;
  border-radius: 6px;
  color: var(--text-2);
  text-decoration: none;
  transition: background 0.15s;
}

.docs-item:hover {
  background: var(--surface-2);
  text-decoration: none;
}

.docs-item__badge {
  display: grid;
  place-items: center;
  width: 30px;
  height: 24px;
  border-radius: 5px;
  background: var(--surface-3);
  border: 1px solid var(--border);
  font-size: 9px;
  color: var(--text-3);
  flex: 0 0 auto;
}

.docs-item span:nth-child(2) {
  display: flex;
  flex-direction: column;
  line-height: 1.4;
  min-width: 0;
}

.docs-item b {
  font-size: 11.5px;
  color: var(--text);
  font-weight: 600;
}

.docs-item small {
  font-size: 10px;
  color: var(--text-3);
}

.docs-item > svg {
  width: 13px;
  height: 13px;
  margin-left: auto;
  color: var(--text-3);
}

.dash-foot {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-top: 8px;
  border-top: 1px solid var(--border-soft);
  font-size: 10.5px;
  color: var(--text-3);
}

.dash-foot a {
  margin-left: auto;
}

@media (max-width: 1100px) {
  .hero {
    grid-template-columns: 1fr;
    padding: 24px;
  }

  .hero__visual {
    display: none;
  }

  .workflow-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .two-col {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .hero__stats {
    gap: 18px;
  }

  .workflow-grid {
    grid-template-columns: 1fr;
  }

  .formula-strip {
    gap: 10px;
  }
}
</style>
