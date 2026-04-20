import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'
import App from './App.vue'
import { initWebpackHook } from './ccfolia/webpack-hook'
import { PortalTargetKey } from './components/ui/portal'
import { installLogPanel } from './infra/log'
import { createShadowMount } from './infra/shadow-mount'
import { useSettingsStore } from './stores/settings'
// UnoCSS 入口:触发 CSS 生成;vite-plugin-monkey 的 cssSideEffects
// 钩子把生成的 CSS 堆到 window.__CCS_CSS__,在 Shadow DOM 内注入。
import 'virtual:uno.css'

// 日志面板必须最先挂 — webpack-hook 进来就要用
installLogPanel()

// 必须在 ccfolia 主 bundle 加载前:把 webpackChunkccfolia 的 setter 装上,
// 才能在第一次 push 时塞假 chunk 拿到 __webpack_require__。
initWebpackHook()

function mount() {
  const { mountPoint, portalTarget } = createShadowMount()

  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)

  const app = createApp(App)
  app.use(pinia)
  // 所有 Reka Portal 通过 inject 取这个目标,避免 overlay 逃出 Shadow DOM
  app.provide(PortalTargetKey, portalTarget)

  // pinia 挂完,把持久化的 logMaxLines 推到日志环
  useSettingsStore().applyLogMaxLines()

  app.mount(mountPoint)
}

if (document.readyState === 'complete')
  mount()
else
  window.addEventListener('load', mount)
