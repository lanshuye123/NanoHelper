<script setup lang="ts">
import { ArrowLeft, Compass } from 'lucide-vue-next'
</script>

<template>
  <div class="page notfound">
    <div class="notfound__code mono">404</div>
    <Compass class="notfound__icon" />
    <h1>这个页面不在倒易空间里</h1>
    <p>链接可能已过期，或页面地址有误。</p>
    <div class="btn-row">
      <el-button type="primary" @click="$router.push('/')"> <ArrowLeft class="btn-icon" /> 返回首页 </el-button>
      <el-button plain @click="$router.push('/docs/userguide/getting-started')">用户指南</el-button>
    </div>
  </div>
</template>

<style scoped>
.notfound {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  text-align: center;
  gap: 8px;
}

.notfound__code {
  font-size: 72px;
  font-weight: 800;
  letter-spacing: -0.05em;
  line-height: 1;
  color: var(--accent);
  opacity: 0.9;
}

.notfound__icon {
  width: 26px;
  height: 26px;
  color: var(--text-3);
  margin-top: 6px;
}

.notfound h1 {
  font-size: 20px;
  margin-top: 4px;
}

.notfound p {
  color: var(--text-3);
  font-size: 12px;
  margin-bottom: 8px;
}

.btn-icon {
  width: 13px;
  height: 13px;
  margin-right: 4px;
}
</style>
