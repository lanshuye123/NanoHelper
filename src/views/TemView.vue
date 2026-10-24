<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Activity, Camera, Copy, Download, Gauge, Magnet, Ruler, ScanLine, Sparkles } from 'lucide-vue-next'
import ToolPage from '@/components/layout/ToolPage.vue'
import type { DrawerState, ResultTab } from '@/components/tool/types'
import PanelCard from '@/components/common/PanelCard.vue'
import NumberField from '@/components/common/NumberField.vue'
import MathText from '@/components/common/MathText.vue'
import SciChart, { type ChartSeries } from '@/components/chart/SciChart.vue'
import {
  aberrationDiscs,
  cameraConstant,
  coherenceLength,
  ctfCurve,
  dFromRadius,
  depthOfField,
  electronState,
  gunBrightness,
  lensFocalLength,
  radiusFromD,
  rayleighResolution,
  scherzerDefocus,
} from '@/core/micro/tem'
import { downloadText, safeFilename, timestamp } from '@/utils/download'

const drawer = ref<DrawerState>('closed')
const resultTabs: ResultTab[] = ['text', 'download', 'copy']

const voltageKv = ref(200)
const betaMrad = ref(10)
const csMm = ref(0.5)
const ccMm = ref(1.2)
const energySpreadEv = ref(1)
const defocusNm = ref(10)
const cameraLengthMm = ref(800)
const radiusMm = ref(5)
const lensK = ref(90)
const lensI = ref(1)
const lensN = ref(3000)
const beamCurrentUa = ref(1)
const spotDiameterNm = ref(10)
const alphaMrad = ref(10)
const ctfDefocusNm = ref(-40)

const state = computed(() => {
  try {
    return electronState(voltageKv.value)
  } catch {
    return null
  }
})

const betaRad = computed(() => betaMrad.value * 1e-3)
const resolution = computed(() => (state.value ? rayleighResolution(state.value.wavelength, betaRad.value) : NaN))
const dof = computed(() => (state.value ? depthOfField(state.value.wavelength, betaRad.value) : NaN))
const coherence = computed(() => coherenceLength(voltageKv.value, energySpreadEv.value))
const cameraConst = computed(() => (state.value ? cameraConstant(state.value.wavelength, cameraLengthMm.value) : NaN))
const dFromR = computed(() => dFromRadius(radiusMm.value, cameraConst.value))
const rFromD = computed(() => radiusFromD(3.14, cameraConst.value))
const lensF = computed(() => lensFocalLength(lensK.value, voltageKv.value * 1000, lensI.value, lensN.value))
const excitation = computed(() => lensI.value * lensN.value)
const aberrations = computed(() =>
  aberrationDiscs({
    Cs: csMm.value,
    Cc: ccMm.value,
    betaRad: betaRad.value,
    energySpread: energySpreadEv.value,
    energy: voltageKv.value * 1000,
    defocus: defocusNm.value,
  }),
)
const brightness = computed(() => gunBrightness(beamCurrentUa.value, spotDiameterNm.value, alphaMrad.value))
const scherzerNm = computed(() => (state.value ? scherzerDefocus(csMm.value * 1e7, state.value.wavelength) / 10 : NaN))
const ctf = computed(() => {
  if (!state.value) return null
  return ctfCurve({
    wavelengthAngstrom: state.value.wavelength,
    csAngstrom: csMm.value * 1e7,
    defocusAngstrom: ctfDefocusNm.value * 10,
    maxU: 0.8,
    points: 1000,
  })
})
const ctfSeries = computed<ChartSeries[]>(() => {
  if (!ctf.value) return []
  return [
    { label: 'CTF', x: ctf.value.u, y: ctf.value.ctf, color: '#7c3aed', width: 1.4 },
    { label: '零线', x: [0, 0.8], y: [0, 0], color: '#94a3b8', width: 1, dash: [5, 4] },
  ]
})

const summary = computed(() => [
  { label: '电子波长 λ', value: state.value?.wavelength.toFixed(5) ?? '—', unit: 'Å' },
  { label: '相对论因子 γ', value: state.value?.gamma.toFixed(5) ?? '—', unit: '' },
  { label: '瑞利分辨率 δ', value: Number.isFinite(resolution.value) ? resolution.value.toFixed(3) : '—', unit: 'Å' },
  {
    label: '相机常数 Lλ',
    value: Number.isFinite(cameraConst.value) ? cameraConst.value.toFixed(3) : '—',
    unit: 'mm·Å',
  },
  { label: '景深', value: Number.isFinite(dof.value) ? (dof.value / 10).toFixed(2) : '—', unit: 'nm' },
  { label: '相干长度', value: Number.isFinite(coherence.value) ? coherence.value.toFixed(0) : '—', unit: 'nm' },
])

const electronRows = computed(() => {
  const s = state.value
  if (!s) return []
  return [
    ['加速电压', `${s.kV}`, 'kV'],
    ['波长 λ', s.wavelength.toFixed(6), 'Å'],
    ['相对论因子 γ', s.gamma.toFixed(6), ''],
    ['速度 v', (s.velocity / 1e8).toFixed(5), '×10⁸ m/s'],
    ['动能', s.kineticKeV.toFixed(3), 'keV'],
    ['动量 p', s.momentumKeVC.toFixed(5), 'keV/c'],
    ['静止能量 m₀c²', s.restKeV.toFixed(1), 'keV'],
    ['γ = 1 + eV/m₀c²', s.gamma.toFixed(6), ''],
  ]
})

const aberrationRows = computed(() => [
  ['球差弥散 r_sph = C_s β³', (aberrations.value.spherical * 1e6).toFixed(4), 'nm'],
  ['色差弥散 r_chr = C_c (ΔE/E) β', (aberrations.value.chromatic * 1e6).toFixed(4), 'nm'],
  ['像散弥散 r_ast = Δf β', aberrations.value.astigmatic.toFixed(4), 'nm'],
])

const wavelengthSeries = computed<ChartSeries[]>(() => {
  const x: number[] = []
  const y: number[] = []
  for (let kv = 20; kv <= 400; kv += 5) {
    x.push(kv)
    try {
      y.push(electronState(kv).wavelength)
    } catch {
      y.push(NaN)
    }
  }
  return [{ label: 'λ(kV)', x, y, color: '#2563eb', width: 1.5 }]
})

const resolutionSeries = computed<ChartSeries[]>(() => {
  if (!state.value) return []
  const x: number[] = []
  const y: number[] = []
  for (let mrad = 1; mrad <= 50; mrad += 1) {
    x.push(mrad)
    y.push(rayleighResolution(state.value.wavelength, mrad * 1e-3))
  }
  return [{ label: 'δ(β)', x, y, color: '#0ea5a4', width: 1.5 }]
})

const reportText = computed(() => {
  const lines = [
    'CrystalToolBox · 电镜参数计算',
    `加速电压 = ${voltageKv.value} kV`,
    `收集半角 β = ${betaMrad.value} mrad`,
    `球差系数 Cs = ${csMm.value} mm; 色差系数 Cc = ${ccMm.value} mm; ΔE = ${energySpreadEv.value} eV`,
    `相机长度 L = ${cameraLengthMm.value} mm`,
    '',
    '【电子光学】',
    ...electronRows.value.map((row) => `${row[0]}\t${row[1]} ${row[2]}`),
    '',
    '【分辨率与相干性】',
    `瑞利分辨率 δ = ${Number.isFinite(resolution.value) ? resolution.value.toFixed(6) : '—'} Å`,
    `景深 ≈ ${Number.isFinite(dof.value) ? (dof.value / 10).toFixed(6) : '—'} nm`,
    `时间相干长度 λc = ${Number.isFinite(coherence.value) ? coherence.value.toFixed(3) : '—'} nm`,
    '',
    '【像差弥散】',
    ...aberrationRows.value.map((row) => `${row[0]}\t${row[1]} ${row[2]}`),
    '',
    '【磁透镜】',
    `I·N = ${excitation.value.toFixed(3)} A·turns`,
    `f = K·U/(I·N)² = ${Number.isFinite(lensF.value) ? lensF.value.toFixed(6) : '—'} mm`,
    '',
    '【衍射标定】',
    `相机常数 Lλ = ${Number.isFinite(cameraConst.value) ? cameraConst.value.toFixed(6) : '—'} mm·Å`,
    `R = ${radiusMm.value} mm → d = ${Number.isFinite(dFromR.value) ? dFromR.value.toFixed(6) : '—'} Å`,
    `d = 3.14 Å → R = ${Number.isFinite(rFromD.value) ? rFromD.value.toFixed(6) : '—'} mm`,
    '',
    '【电子枪】',
    `亮度 β = ${Number.isFinite(brightness.value) ? brightness.value.toExponential(4) : '—'} A·m⁻²·sr⁻¹`,
    '',
    '【CTF】',
    `离焦 Δf = ${ctfDefocusNm.value.toFixed(3)} nm`,
    `Scherzer 离焦 = ${Number.isFinite(ctf.value?.scherzerDefocus ?? NaN) ? (ctf.value!.scherzerDefocus / 10).toFixed(3) : '—'} nm`,
    `第一零 = ${Number.isFinite(ctf.value?.firstZero ?? NaN) ? ctf.value!.firstZero.toFixed(5) : '—'} Å⁻¹`,
    `点分辨率 = ${Number.isFinite(ctf.value?.pointResolution ?? NaN) ? ctf.value!.pointResolution.toFixed(3) : '—'} Å`,
    `Scherzer 点分辨率 = ${Number.isFinite(ctf.value?.scherzerResolution ?? NaN) ? ctf.value!.scherzerResolution.toFixed(3) : '—'} Å`,
  ]
  return lines.join('\r\n')
})

function exportCsv() {
  const lines = [
    'quantity,value,unit',
    `voltage,${voltageKv.value},kV`,
    `wavelength,${state.value?.wavelength.toFixed(8) ?? ''},A`,
    `gamma,${state.value?.gamma.toFixed(8) ?? ''},`,
    `velocity,${state.value ? (state.value.velocity / 1e8).toFixed(8) : ''},1e8 m/s`,
    `rayleigh_resolution,${Number.isFinite(resolution.value) ? resolution.value.toFixed(8) : ''},A`,
    `depth_of_field,${Number.isFinite(dof.value) ? (dof.value / 10).toFixed(8) : ''},nm`,
    `coherence_length,${Number.isFinite(coherence.value) ? coherence.value.toFixed(8) : ''},nm`,
    `camera_constant,${Number.isFinite(cameraConst.value) ? cameraConst.value.toFixed(8) : ''},mm*A`,
    `d_from_R,${Number.isFinite(dFromR.value) ? dFromR.value.toFixed(8) : ''},A`,
    `spherical_disc,${(aberrations.value.spherical * 1e6).toFixed(8)},nm`,
    `chromatic_disc,${(aberrations.value.chromatic * 1e6).toFixed(8)},nm`,
    `astigmatic_disc,${aberrations.value.astigmatic.toFixed(8)},nm`,
    `focal_length,${Number.isFinite(lensF.value) ? lensF.value.toFixed(8) : ''},mm`,
    `brightness,${Number.isFinite(brightness.value) ? brightness.value.toExponential(8) : ''},A/m2/sr`,
  ]
  downloadText(
    '\uFEFF' + lines.join('\r\n'),
    safeFilename(`tem_${voltageKv.value}kV_${timestamp()}`, 'csv'),
    'text/csv;charset=utf-8',
  )
  ElMessage.success('已导出电镜参数 CSV')
}

async function copyReport() {
  try {
    await navigator.clipboard.writeText(reportText.value)
    ElMessage.success('已复制参数报告')
  } catch {
    ElMessage.error('复制失败，请重试')
  }
}
</script>

<template>
  <ToolPage
    tool-id="tem"
    title="电镜参数计算"
    subtitle="由加速电压、光阑半角与透镜参数计算电子波长、瑞利分辨率、CTF、景深、相干长度、像差弥散、磁透镜焦距与相机常数。"
    eyebrow="显微分析 · 02"
    doc="/docs/userguide/tem"
    v-model:result-state="drawer"
    result-title="电镜参数报告"
    :result-tabs="resultTabs"
  >
    <template #run>
      <button type="button" class="btn btn--primary btn--lg" @click="drawer = 'half'">查看参数报告</button>
      <button type="button" class="btn" @click="exportCsv"><Download /> CSV</button>
      <button type="button" class="btn" @click="copyReport"><Copy /> 复制</button>
    </template>

    <template #source>
      <PanelCard title="电子束" :icon="ScanLine">
        <NumberField v-model="voltageKv" label="加速电压" unit="kV" :min="1" :max="1500" :precision="1" />
        <NumberField v-model="betaMrad" label="收集半角 β" unit="mrad" :min="0.01" :max="100" :precision="2" />
        <NumberField v-model="energySpreadEv" label="能量展宽 ΔE" unit="eV" :min="0.001" :max="50" :precision="3" />
        <div class="kv-list">
          <div class="kv">
            <span>电子波长</span><span>{{ state?.wavelength.toFixed(5) }} Å</span>
          </div>
          <div class="kv">
            <span>相对论因子 γ</span><span>{{ state?.gamma.toFixed(5) }}</span>
          </div>
          <div class="kv">
            <span>速度</span><span>{{ state ? (state.velocity / 1e8).toFixed(4) : '—' }} ×10⁸ m/s</span>
          </div>
        </div>
      </PanelCard>
    </template>

    <template #config>
      <PanelCard title="透镜与像差" :icon="Magnet">
        <div class="grid-2">
          <NumberField v-model="csMm" label="球差 Cs" unit="mm" :min="0" :precision="4" />
          <NumberField v-model="ccMm" label="色差 Cc" unit="mm" :min="0" :precision="4" />
        </div>
        <NumberField v-model="defocusNm" label="离焦 Δf" unit="nm" :precision="3" />
        <div class="grid-3">
          <NumberField v-model="lensK" label="透镜常数 K" :min="0.001" :precision="2" />
          <NumberField v-model="lensI" label="励磁电流 I" unit="A" :min="0.001" :precision="3" />
          <NumberField v-model="lensN" label="线圈匝数 N" unit="turns" :min="1" :precision="0" />
        </div>
        <div class="kv-list">
          <div class="kv">
            <span>I·N</span><span>{{ excitation.toFixed(1) }} A·turns</span>
          </div>
          <div class="kv">
            <span>焦距 f</span><span>{{ Number.isFinite(lensF) ? lensF.toFixed(5) : '—' }} mm</span>
          </div>
        </div>
        <MathText tex="f = K\frac{U}{(IN)^2}" block />
      </PanelCard>

      <PanelCard title="电子枪亮度" :icon="Gauge">
        <div class="grid-3">
          <NumberField v-model="beamCurrentUa" label="束流 i" unit="µA" :min="0.0001" :precision="4" />
          <NumberField v-model="spotDiameterNm" label="束斑 d₀" unit="nm" :min="0.01" :precision="2" />
          <NumberField v-model="alphaMrad" label="发射角 α" unit="mrad" :min="0.01" :precision="2" />
        </div>
        <div class="big-result">
          <span class="big-result__value mono">{{
            Number.isFinite(brightness) ? brightness.toExponential(3) : '—'
          }}</span>
          <span class="big-result__unit">A·m⁻²·sr⁻¹</span>
        </div>
        <MathText tex="\beta = \frac{i_e}{\pi(d_0/2)^2\cdot\pi\alpha_0^2}" block />
      </PanelCard>
    </template>

    <template #params>
      <PanelCard title="衍射标定" :icon="Camera">
        <NumberField v-model="cameraLengthMm" label="相机长度 L" unit="mm" :min="1" :precision="2" />
        <NumberField v-model="radiusMm" label="测得半径 R" unit="mm" :min="0.001" :precision="4" />
        <div class="kv-list">
          <div class="kv">
            <span>Lλ</span><span>{{ Number.isFinite(cameraConst) ? cameraConst.toFixed(4) : '—' }} mm·Å</span>
          </div>
          <div class="kv">
            <span>d = Lλ / R</span><span>{{ Number.isFinite(dFromR) ? dFromR.toFixed(5) : '—' }} Å</span>
          </div>
          <div class="kv">
            <span>d = 3.14 Å 时 R</span><span>{{ Number.isFinite(rFromD) ? rFromD.toFixed(4) : '—' }} mm</span>
          </div>
        </div>
        <MathText tex="R = L\lambda\,|g| = \frac{L\lambda}{d}" block />
        <p class="tiny dim">相机常数也可用已知标样（如 Au、Si）的衍射环标定：Lλ = R·d。</p>
      </PanelCard>
    </template>

    <div class="summary-grid">
      <div v-for="item in summary" :key="item.label" class="metric">
        <span class="metric__label">{{ item.label }}</span>
        <span class="metric__value mono">{{ item.value }}</span>
        <span class="metric__unit">{{ item.unit }}</span>
      </div>
    </div>

    <div class="two-col">
      <PanelCard title="波长随加速电压" :icon="Activity" hint="20–400 kV，相对论修正">
        <SciChart
          :series="wavelengthSeries"
          x-label="加速电压"
          x-unit="kV"
          y-label="λ"
          y-unit="Å"
          :height="260"
          :show-legend="false"
        />
      </PanelCard>
      <PanelCard title="瑞利分辨率随收集半角" :icon="Ruler" :hint="`λ = ${state?.wavelength.toFixed(4) ?? '—'} Å`">
        <SciChart
          :series="resolutionSeries"
          x-label="β"
          x-unit="mrad"
          y-label="δ"
          y-unit="Å"
          :height="260"
          :show-legend="false"
        />
      </PanelCard>
    </div>

    <div class="two-col">
      <PanelCard title="CTF 衬度传递函数" :icon="Activity" hint="弱相位物体近似">
        <SciChart
          v-if="ctfSeries.length"
          :series="ctfSeries"
          x-label="空间频率 u"
          x-unit="Å⁻¹"
          y-label="CTF"
          :height="280"
          :include-zero="false"
          :show-legend="true"
        />
        <div v-else class="small dim">需要有效的加速电压与 Cs。</div>
        <p class="tiny dim" style="margin-top: 6px">
          CTF(u) = −sin[πλu²(Δf + ½Csλ²u²)]；负离焦为欠焦。第一零之后的振荡会反转衬度。
        </p>
      </PanelCard>

      <PanelCard title="Scherzer 离焦与点分辨率" :icon="Ruler">
        <NumberField v-model="ctfDefocusNm" label="CTF 离焦 Δf" unit="nm" :precision="3" />
        <button type="button" class="btn btn--quiet" style="margin-top: 6px" @click="ctfDefocusNm = scherzerNm">
          使用 Scherzer 离焦
        </button>
        <div class="kv-list">
          <div class="kv">
            <span>Scherzer 离焦</span><span>{{ Number.isFinite(scherzerNm) ? scherzerNm.toFixed(3) : '—' }} nm</span>
          </div>
          <div class="kv">
            <span>第一零 u₁</span
            ><span>{{ Number.isFinite(ctf?.firstZero ?? NaN) ? ctf!.firstZero.toFixed(5) : '—' }} Å⁻¹</span>
          </div>
          <div class="kv">
            <span>点分辨率 1/u₁</span
            ><span>{{ Number.isFinite(ctf?.pointResolution ?? NaN) ? ctf!.pointResolution.toFixed(3) : '—' }} Å</span>
          </div>
          <div class="kv">
            <span>Scherzer 点分辨率</span
            ><span
              >{{ Number.isFinite(ctf?.scherzerResolution ?? NaN) ? ctf!.scherzerResolution.toFixed(3) : '—' }} Å</span
            >
          </div>
        </div>
        <MathText tex="\Delta f_{\mathrm{Sch}}=-\sqrt{\frac{4}{3}C_s\lambda}" block />
        <p class="tiny dim">Cs 以 mm 输入，程序内部换算为 Å；点分辨率是 CTF 第一零的倒数，不是信息极限。</p>
      </PanelCard>
    </div>

    <div class="two-col">
      <PanelCard title="电子态与相对论量" :icon="Sparkles">
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>量</th>
                <th class="num">数值</th>
                <th>单位</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in electronRows" :key="row[0]">
                <td class="text">{{ row[0] }}</td>
                <td class="num">{{ row[1] }}</td>
                <td>{{ row[2] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="formula-line">
          <MathText tex="\lambda = \frac{h}{\sqrt{2m_0eV(1+eV/2m_0c^2)}}" block />
          <MathText tex="\delta = \frac{0.61\lambda}{\mu\sin\beta}" block />
        </div>
      </PanelCard>

      <PanelCard title="像差弥散与景深" :icon="Gauge">
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>量</th>
                <th class="num">数值</th>
                <th>单位</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in aberrationRows" :key="row[0]">
                <td class="text">{{ row[0] }}</td>
                <td class="num">{{ row[1] }}</td>
                <td>{{ row[2] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="kv-list" style="margin-top: 10px">
          <div class="kv">
            <span>景深 2λ/β²</span><span>{{ Number.isFinite(dof) ? (dof / 10).toFixed(3) : '—' }} nm</span>
          </div>
          <div class="kv">
            <span>时间相干长度 vh/ΔE</span><span>{{ Number.isFinite(coherence) ? coherence.toFixed(1) : '—' }} nm</span>
          </div>
        </div>
      </PanelCard>
    </div>

    <template #text>
      <pre class="code-surface"><code>{{ reportText }}</code></pre>
    </template>

    <template #download>
      <div class="btn-row">
        <button type="button" class="btn" @click="exportCsv"><Download /> 参数 CSV</button>
      </div>
    </template>

    <template #copy>
      <div class="btn-row">
        <button type="button" class="btn" @click="copyReport"><Copy /> 复制报告</button>
      </div>
      <pre class="code-surface" style="margin-top: 10px"><code>{{ reportText }}</code></pre>
    </template>
  </ToolPage>
</template>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.metric__label {
  font-size: 9.5px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.metric__value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.metric__unit {
  font-size: 9.5px;
  color: var(--text-3);
}

.two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  align-items: start;
}

.kv-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 8px;
  font-size: 10.5px;
}

.kv {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--text-2);
}

.kv span:first-child {
  color: var(--text-3);
}

.formula-line {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
}

.big-result {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 10px 0;
}

.big-result__value {
  font-size: 24px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.02em;
}

.big-result__unit {
  font-size: 9.5px;
  color: var(--text-3);
}

@media (max-width: 1180px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .two-col {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
