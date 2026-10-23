import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { tools } from '@/tools/registry'

const toolRoutes: RouteRecordRaw[] = tools.map((tool) => ({
  path: tool.path,
  name: tool.id,
  component: tool.component,
  meta: {
    title: tool.title,
    group: tool.group,
    module: tool.group,
    toolId: tool.id,
    doc: tool.doc,
  },
}))

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: '首页', module: 'home' },
  },
  ...toolRoutes,
  {
    path: '/docs/:section/:slug?',
    name: 'docs',
    component: () => import('@/views/DocsView.vue'),
    meta: { title: '文档中心', module: 'docs' },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/AboutView.vue'),
    meta: { title: '关于', module: 'about' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '页面不存在', module: 'home' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, top: 72, behavior: 'smooth' }
    return { top: 0 }
  },
})

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? '晶体学工具箱'
  document.title = `${title} · CrystalToolBox`
})

export default router
