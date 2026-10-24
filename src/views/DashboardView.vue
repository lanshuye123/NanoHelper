<script setup lang="ts">
import { ArrowRight, BookOpen, Upload } from 'lucide-vue-next'
import { NAV_MODULES } from '@/config/navigation'
import UiButton from '@/components/ui/UiButton.vue'

const featureModules = NAV_MODULES.filter((module) =>
  ['data', 'diffraction', 'crystal', 'micro', 'docs'].includes(module.key),
)

const heroStats = [
  { value: '17', label: '个工具页面' },
  { value: '4', label: '个计算模块' },
  { value: '7', label: '类分析任务' },
]
</script>

<template>
  <div class="page home">
    <div class="home__deco" aria-hidden="true">
      <svg viewBox="0 0 200 200" class="home__deco-shape">
        <path d="M100 12 L176 56 L176 144 L100 188 L24 144 L24 56 Z" />
        <path d="M100 56 L138 78 L138 122 L100 144 L62 122 L62 78 Z" />
        <path d="M24 56 L62 78 M176 56 L138 78 M100 12 L100 56" />
      </svg>
    </div>

    <section class="hero">
      <div class="hero__content">
        <span class="hero__eyebrow">NANOMATERIALS · CRYSTALLOGRAPHY · DIFFRACTION</span>
        <h1 class="hero__title">
          把课程里的计算，<br />
          <span class="hero__title-accent">变成随手可用的工具。</span>
        </h1>
        <p class="hero__sub">
          从原始谱图到 Jade 拟合，从倒易空间到带轴电子衍射，再到 SEM
          粒径统计与三维晶胞。把课程里的推导变成可复用的分析流程。
        </p>
        <div class="hero__actions">
          <UiButton to="/data/import" variant="primary" size="lg" :icon-right="ArrowRight">开始导入</UiButton>
          <UiButton to="/docs/userguide/getting-started" size="lg" :icon="BookOpen">阅读用户指南</UiButton>
        </div>
      </div>

      <div class="hero__visual" aria-hidden="true">
        <svg viewBox="0 0 360 320" class="crystal">
          <g class="crystal__faces">
            <path d="M180 24 L312 96 L180 168 L48 96 Z" />
            <path d="M48 96 L180 168 L180 300 L48 228 Z" />
            <path d="M312 96 L180 168 L180 300 L312 228 Z" />
          </g>
          <g class="crystal__edges">
            <path d="M180 24 L312 96 L180 168 L48 96 Z" />
            <path d="M48 96 L180 168 L180 300 L48 228 Z" />
            <path d="M312 96 L180 168 L180 300 L312 228 Z" />
            <path d="M114 60 L246 132 L114 204 M246 60 L114 132 L246 204" />
            <path d="M180 24 L180 300" />
          </g>
          <g class="crystal__nodes">
            <circle cx="180" cy="168" r="4" />
            <circle cx="180" cy="24" r="2.6" />
            <circle cx="312" cy="96" r="2.6" />
            <circle cx="48" cy="96" r="2.6" />
            <circle cx="180" cy="300" r="2.6" />
            <circle cx="48" cy="228" r="2.6" />
            <circle cx="312" cy="228" r="2.6" />
            <circle cx="114" cy="132" r="2" />
            <circle cx="246" cy="132" r="2" />
            <circle cx="114" cy="204" r="2" />
            <circle cx="246" cy="204" r="2" />
          </g>
          <g class="crystal__labels">
            <text x="190" y="20">[001]</text>
            <text x="322" y="92">200</text>
            <text x="322" y="234">00-2</text>
            <text x="18" y="92">-200</text>
          </g>
        </svg>
      </div>
    </section>

    <section class="stats-band" aria-label="平台数据">
      <div v-for="item in heroStats" :key="item.label" class="stats-band__item">
        <span class="stats-band__value mono">{{ item.value }}</span>
        <span class="stats-band__label">{{ item.label }}</span>
      </div>
    </section>

    <section class="section">
      <div class="section__head">
        <div>
          <span class="section-label">MODULES</span>
          <h2 class="section__title">四个计算模块，一个文档中心</h2>
        </div>
        <span class="chip chip--accent">覆盖 XRD · SAED · SEM</span>
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

          <RouterLink :to="module.path" class="module-card__go">
            进入{{ module.label }}
            <ArrowRight />
          </RouterLink>
        </article>
      </div>
    </section>

    <footer class="dash-foot">
      <span class="mono">CrystalToolBox v0.1.0</span>
      <span class="dim">XRD · SAED · 显微分析</span>
      <RouterLink to="/about">关于与引用</RouterLink>
    </footer>
  </div>
</template>

<style scoped>
.home {
  position: relative;
  max-width: 1400px;
  padding: 24px 24px 32px;
}

/* ------------------------------------------------------------- backdrop */

.home__deco {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}

.home__deco-shape {
  position: absolute;
  top: -60px;
  right: -40px;
  width: 460px;
  height: 460px;
  fill: none;
  stroke: var(--accent);
  stroke-width: 0.6;
  opacity: 0.07;
}

.home > *:not(.home__deco) {
  position: relative;
  z-index: 1;
}

/* ------------------------------------------------------------- hero */

.hero {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 44px 40px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}

.hero__content {
  flex: 1 1 50%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 18px;
  min-width: 0;
}

.hero__eyebrow {
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: 0.18em;
  color: var(--accent);
}

.hero__title {
  font-size: clamp(28px, 3.4vw, 42px);
  line-height: 1.18;
  font-weight: 780;
  letter-spacing: -0.035em;
  color: var(--text);
}

.hero__title-accent {
  color: var(--accent);
}

.hero__sub {
  max-width: 520px;
  font-size: 13px;
  line-height: 1.85;
  color: var(--text-2);
}

.hero__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.hero__visual {
  flex: 1 1 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.crystal {
  width: 100%;
  max-width: 400px;
  height: auto;
}

.crystal__faces path {
  fill: var(--accent-soft);
  stroke: none;
}

.crystal__edges {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1;
  opacity: 0.65;
}

.crystal__nodes {
  fill: var(--accent);
}

.crystal__labels {
  fill: var(--text-3);
  font-family: var(--font-mono);
  font-size: 9px;
}

/* ------------------------------------------------------------- stats */

.stats-band {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

.stats-band__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 22px 28px;
}

.stats-band__item + .stats-band__item {
  border-left: 1px solid var(--border-soft);
}

.stats-band__value {
  font-size: 30px;
  font-weight: 740;
  line-height: 1.1;
  color: var(--accent);
}

.stats-band__label {
  font-size: 12px;
  color: var(--text-3);
}

/* ------------------------------------------------------------- sections */

.section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 28px;
}

.section__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.section__title {
  font-size: 20px;
  font-weight: 720;
  letter-spacing: -0.02em;
  margin-top: 4px;
  color: var(--text);
}

/* ------------------------------------------------------------- modules */

.module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.module-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  transition:
    transform var(--duration) var(--ease),
    box-shadow var(--duration) var(--ease),
    border-color var(--duration) var(--ease);
}

.module-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-hover);
  border-color: color-mix(in srgb, var(--card-accent) 38%, var(--border));
}

.module-card__head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.module-card__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex: 0 0 auto;
  border-radius: 12px;
  background: color-mix(in srgb, var(--card-accent) 12%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--card-accent) 24%, transparent);
  color: var(--card-accent);
}

.module-card__icon svg {
  width: 18px;
  height: 18px;
}

.module-card__copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.module-card__copy b {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.module-card__copy small {
  font-size: 11px;
  line-height: 1.55;
  color: var(--text-3);
}

.module-card__count {
  flex: 0 0 auto;
  font-size: 10px;
  color: var(--text-3);
}

.module-card__list {
  list-style: none;
  margin: 14px 0 0;
  padding: 12px 0 0;
  border-top: 1px solid var(--border-soft);
  flex: 1;
}

.module-card__list li + li {
  margin-top: 2px;
}

.module-card__list a {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-xs);
  color: var(--text-2);
  font-size: 12.5px;
  text-decoration: none;
  transition:
    background var(--duration) var(--ease),
    color var(--duration) var(--ease);
}

.module-card__list a:hover {
  background: color-mix(in srgb, var(--card-accent) 9%, var(--surface));
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
  opacity: 0.9;
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
  width: 12px;
  height: 12px;
  opacity: 0;
  transition:
    opacity var(--duration) var(--ease),
    transform var(--duration) var(--ease);
}

.module-card__list a:hover .module-card__item-arrow {
  opacity: 1;
  transform: translateX(2px);
}

.module-card__go {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 14px;
  padding: 9px 12px;
  border: 1px solid color-mix(in srgb, var(--card-accent) 26%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--card-accent) 7%, var(--surface));
  color: var(--card-accent);
  font-size: 11.5px;
  font-weight: 600;
  text-decoration: none;
  transition: background var(--duration) var(--ease);
}

.module-card__go:hover {
  background: color-mix(in srgb, var(--card-accent) 13%, var(--surface));
  text-decoration: none;
}

.module-card__go svg {
  width: 13px;
  height: 13px;
}

/* ------------------------------------------------------------- foot */

.dash-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 26px;
  padding-top: 14px;
  border-top: 1px solid var(--border-soft);
  font-size: 11px;
  color: var(--text-3);
}

.dash-foot a {
  color: var(--text-2);
}

/* ------------------------------------------------------------- responsive */

@media (max-width: 1200px) {
  .module-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1024px) {
  .hero {
    flex-direction: column;
    align-items: flex-start;
    padding: 30px 24px;
  }

  .hero__content,
  .hero__visual {
    flex: 1 1 auto;
    width: 100%;
  }

  .crystal {
    max-width: 320px;
  }
}

@media (max-width: 640px) {
  .home {
    padding: 16px 14px 24px;
  }

  .hero {
    padding: 22px 18px;
  }

  .stats-band {
    grid-template-columns: minmax(0, 1fr);
  }

  .stats-band__item + .stats-band__item {
    border-left: none;
    border-top: 1px solid var(--border-soft);
  }

  .module-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .dash-foot {
    flex-wrap: wrap;
  }
}
</style>
