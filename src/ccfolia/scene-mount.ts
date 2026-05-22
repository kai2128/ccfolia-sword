import type { Pinia } from 'pinia'
import type { App } from 'vue'
import { createApp } from 'vue'
import { PortalTargetKey } from '@/components/ui/portal'
import { createLogger } from '@/infra/log'
import { setupShadowRoot } from '@/infra/shadow-mount'

const log = createLogger('scene-mount')

// 一层 = 一个独立 Vue app + 自己的 host(各带 zIndex)。
// 之所以分多层:网格要落在棋子(z=101)之下,而 HP/MP 条等要在棋子之上,
// 单一 host 的 z-index 没法同时满足,于是拆成高 z(overlay)+低 z(grid)两层。
export interface SceneLayerSpec {
  component: unknown
  zIndex: number
}

interface MountedLayer {
  spec: SceneLayerSpec
  host: HTMLDivElement
  app: App
}

let mounted: MountedLayer[] = []
let observer: MutationObserver | null = null

// 找 ccfolia 画布容器:所有 .movable 的最深公共祖先。
// 实测该节点是 transform: scale(...) 的 camera/zoom 层。
// 没有 .movable(进房间前 / 房间还在 loading)时返 null,交给 caller 重试。
export function findCanvasContainer(): HTMLElement | null {
  const movables = document.querySelectorAll<HTMLElement>('.movable')
  if (movables.length === 0)
    return null
  let common = ancestorChain(movables[0])
  for (let i = 1; i < movables.length; i++) {
    const set = new Set(ancestorChain(movables[i]))
    common = common.filter(el => set.has(el))
    if (common.length === 0)
      return null
  }
  // common 包含 movable 自己 + 它全部祖先;我们要最深的公共祖先而不是 movable 自身,跳过所有 .movable。
  for (const el of common) {
    if (!el.classList.contains('movable'))
      return el
  }
  return null
}

function ancestorChain(el: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = []
  let cur: HTMLElement | null = el
  while (cur) {
    out.push(cur)
    cur = cur.parentElement
  }
  return out
}

// 硬约束:overlay 是独立 Vue app,必须把主 app 的 pinia 实例 + portalTarget 注进来:
//   - pinia:两个 app 共用同一 store 单例,否则派生 usePiecesStore 看不到数据。
//   - portalTarget:scene 组件里的 Tooltip/Popover 等 Reka Portal 需要一个挂载点;
//     传主 app 的 portalTarget(来自 createShadowMount())让所有 portal 渲染到同一处,
//     避免 scene 的 overlay 自己再造一个 Shadow 导致事件/样式割裂。
export function startSceneMount(
  layers: SceneLayerSpec[],
  pinia: Pinia,
  portalTarget: HTMLElement,
): void {
  if (mounted.length > 0 || observer)
    return
  tryMount(layers, pinia, portalTarget)

  // 不要 disconnect:ccfolia 切房间 / 切场景 / 画布重建 会把 host 连窝端走,
  // 这里永久监听 body,每次 mutation 核对每层 host 还在不在 DOM,掉线就重新定位 canvas 再 append 回去。
  // host 和 ShadowRoot + Vue app 不动,保留 overlay 内部状态。
  observer = new MutationObserver(() => {
    if (mounted.length === 0) {
      tryMount(layers, pinia, portalTarget)
      return
    }
    const canvas = findCanvasContainer()
    if (!canvas)
      return
    for (const layer of mounted) {
      if (!layer.host.isConnected) {
        canvas.appendChild(layer.host)
        // 不再自动校准:settings.grid 持久化,用户手动在 Settings tab 点校准即可。
        log.info('overlay host re-appended after canvas remount')
      }
    }
  })
  observer.observe(document.body, { subtree: true, childList: true })
}

function tryMount(layers: SceneLayerSpec[], pinia: Pinia, portalTarget: HTMLElement): void {
  const canvas = findCanvasContainer()
  if (!canvas)
    return
  // 不再在 mount 时自动校准。settings.grid 持久化,用户刷新后保留上次的值;
  // 第一次进入房间 / 房间尺寸变化时,去 Settings tab 点「校准」手动触发。
  mounted = layers.map(spec => mountLayer(spec, canvas, pinia, portalTarget))
  log.info('overlay layers mounted in canvas')
}

function mountLayer(
  spec: SceneLayerSpec,
  canvas: HTMLElement,
  pinia: Pinia,
  portalTarget: HTMLElement,
): MountedLayer {
  const host = document.createElement('div')
  host.setAttribute('data-ccs-overlay-root', '')
  Object.assign(host.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    pointerEvents: 'none',
    zIndex: String(spec.zIndex),
    width: '0',
    height: '0',
  })
  canvas.appendChild(host)

  // 复用 Panel 的 Shadow 引导(HOST_RESET + UnoCSS 注入);Scene 不自建 portal,复用主 app 的。
  const { mountPoint } = setupShadowRoot(host, { withPortalTarget: false })

  const app = createApp(spec.component as any)
  app.use(pinia) // 同主 app 的 pinia 单例
  app.provide(PortalTargetKey, portalTarget) // 同主 app 的 portal 目标,Reka Portal 有家可归
  app.mount(mountPoint)

  return { spec, host, app }
}

export function stopSceneMount(): void {
  observer?.disconnect()
  observer = null
  for (const layer of mounted) {
    layer.app.unmount()
    layer.host.remove()
  }
  mounted = []
}
