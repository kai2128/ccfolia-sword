// Shadow DOM 挂载 + CSS 注入
// 详见 docs/design/02-ui-framework.md / 04-styling.md

// :host 边界 reset,防止 ccfolia 全局样式穿透
const HOST_RESET = `
:host {
  all: initial;
  font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 13px;
  line-height: 1.4;
  color: #e0e0e0;
}
*, *::before, *::after { box-sizing: border-box; }
`

export interface MountResult {
  host: HTMLElement
  shadow: ShadowRoot
  mountPoint: HTMLElement
}

export function createShadowMount(): MountResult {
  const host = document.createElement('div')
  host.id = 'ccs-host'
  host.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483647;pointer-events:none;'
  document.body.append(host)

  const shadow = host.attachShadow({ mode: 'open' })

  const resetStyle = document.createElement('style')
  resetStyle.textContent = HOST_RESET
  shadow.append(resetStyle)

  // vite-plugin-monkey 的 cssSideEffects 钩子把所有 CSS(含 UnoCSS)
  // 堆到 window.__CCS_CSS__,这里统一注入 Shadow DOM。
  const cssChunks = (window as unknown as { __CCS_CSS__?: string[] }).__CCS_CSS__ ?? []
  if (cssChunks.length) {
    const unoStyle = document.createElement('style')
    unoStyle.textContent = cssChunks.join('\n')
    shadow.append(unoStyle)
  }

  const mountPoint = document.createElement('div')
  mountPoint.style.pointerEvents = 'auto'
  shadow.append(mountPoint)

  return { host, shadow, mountPoint }
}
