// 每个角色的 HP/MP 指示器变体覆盖。auto = 跟全局自动判定;C / E = 锁死。
// 默认 auto(不存 key),只持久化被显式锁死的 charId,体积小、过期 key 不会污染。
//
// 跨 tab 同步沿用 overlay-visibility 的整体替换思路 —— $patch 深合并不能传 delete,
// 另一个 tab 把 charId 改回 auto(等于删 key)时,本 tab 必须整体覆盖 overrides。
import type { DisplayMode, VariantOverride } from '@/core/overlay/resolve-display-mode'
import { defineStore } from 'pinia'
import { gmStorage } from '@/infra/pinia-persist-adapter'

const PERSIST_KEY = 'ccs:store:hpmp-variant-override'

interface OverrideState {
  // 不存 'auto' 状态,直接 delete key 即可。这里只放 'C' / 'E'。
  overrides: Record<string, DisplayMode>
}

export const useHpmpVariantOverrideStore = defineStore('hpmp-variant-override', {
  state: (): OverrideState => ({
    overrides: {},
  }),
  getters: {
    get: state => (charId: string): VariantOverride => state.overrides[charId] ?? 'auto',
  },
  actions: {
    set(charId: string, mode: VariantOverride) {
      if (mode === 'auto')
        delete this.overrides[charId]
      else
        this.overrides[charId] = mode
    },
    cycle(charId: string) {
      // auto → C → E → auto
      const stored = this.overrides[charId]
      let next: VariantOverride
      if (!stored)
        next = 'C'
      else if (stored === 'C')
        next = 'E'
      else
        next = 'auto'
      this.set(charId, next)
    },
    clear(charId: string) {
      delete this.overrides[charId]
    },
  },
  persist: {
    storage: gmStorage,
    key: PERSIST_KEY,
    afterHydrate: ({ store }) => {
      if (typeof GM_addValueChangeListener !== 'function') {
        console.warn('[ccs] hpmp-variant-override: GM_addValueChangeListener 不可用,跨 tab 同步关闭。')
        return
      }
      const s = store as ReturnType<typeof useHpmpVariantOverrideStore>
      GM_addValueChangeListener(PERSIST_KEY, (_k, _old, newValue, remote) => {
        if (!remote)
          return
        try {
          const parsed = typeof newValue === 'string' ? JSON.parse(newValue) : newValue
          const raw = (parsed && typeof parsed === 'object' && parsed.overrides && typeof parsed.overrides === 'object')
            ? parsed.overrides as Record<string, unknown>
            : {}
          const next: Record<string, DisplayMode> = {}
          for (const [k, v] of Object.entries(raw)) {
            if (v === 'C' || v === 'E')
              next[k] = v
          }
          s.$patch((state) => {
            state.overrides = next
          })
        }
        catch (e) {
          console.warn('[ccs] hpmp-variant-override: failed to apply remote change', e)
        }
      })
    },
  },
})
