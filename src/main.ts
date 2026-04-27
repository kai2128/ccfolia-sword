import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import { createApp } from 'vue'
import App from './App.vue'
import { usePiecesStore } from './ccfolia/pieces-store'
import { startRoomCharactersSync, useRoomCharactersStore } from './ccfolia/room-characters-store'
import { startSceneMount } from './ccfolia/scene-mount'
import { initWebpackHook } from './ccfolia/webpack-hook'
import SceneOverlayRoot from './components/scene/SceneOverlayRoot.vue'
import { PortalTargetKey } from './components/ui/portal'
import { bindHotkey } from './core/shell/hotkey'
import { installLogPanel } from './infra/log'
import { createShadowMount } from './infra/shadow-mount'
import { bindSharedCrossTabSync, persistLocal, persistShared, useEncounterStore } from './stores/encounter'
import { useSettingsStore } from './stores/settings'
// 先 reset(p/h1-h6/blockquote/ul/ol/figure/pre 等 UA 边距清零,button/input 字体 / 颜色继承),
// 再 UnoCSS utilities。两者都经 cssSideEffects 收进 __CCS_CSS__,shadow-mount 注入 Shadow DOM。
// 顺序重要:同特异度时后来者胜,reset 在前可让 .m-4 等 utility 覆盖通用边距。
import '@unocss/reset/tailwind-compat.css'
import 'virtual:uno.css'
// Capsule HP/MP token + keyframes;放在 uno 之后,utility 仍可覆盖动效以外的样式。
import './styles/tokens.css'

declare const unsafeWindow: Window & typeof globalThis

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

  const encounter = useEncounterStore()
  encounter.$subscribe((_mutation, state) => {
    persistShared(state.shared)
    persistLocal(state.local)
  })
  bindSharedCrossTabSync(encounter)

  // pinia 挂完,把持久化的 logMaxLines 推到日志环
  const settings = useSettingsStore()
  settings.applyLogMaxLines()

  // Alt+S 切面板显隐
  bindHotkey({ alt: true, key: 's' }, () => settings.togglePanel())

  app.mount(mountPoint)

  // 启动 ccfolia Redux 订阅 + scene overlay(共享主 app 的 pinia + portalTarget,
  // 否则派生 store 看不到数据 / Reka Portal 无家可归)。
  startRoomCharactersSync()
  startSceneMount(SceneOverlayRoot, pinia, portalTarget)

  // devtools 验收桥;生产里只是几个对象引用,无运行时开销。
  // 必须走 unsafeWindow —— userscript 的 window 是沙箱,页面 console 里看不到。
  // 必须 merge 而不是整体赋值 —— startSceneMount() 里 tryMount 是同步的,
  // overlay 的 SceneOverlayRoot 会先一步把 overlayPieces / overlayRoomCharacters
  // 写进 __CCS_STORES__,这里若直接 = { ... } 会把 overlay 写好的字段抹掉。
  try {
    const dbg = unsafeWindow as unknown as { __CCS_STORES__?: Record<string, unknown> }
    dbg.__CCS_STORES__ = {
      ...(dbg.__CCS_STORES__ ?? {}),
      roomCharacters: useRoomCharactersStore(),
      pieces: usePiecesStore(),
      encounter,
      settings,
    }
  }
  catch { /* ignore */ }
}

if (document.readyState === 'complete')
  mount()
else
  window.addEventListener('load', mount)
