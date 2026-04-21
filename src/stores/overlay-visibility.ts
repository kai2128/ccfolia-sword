// 每个角色在场景上的 HP/MP pill 是否显示。默认可见,只持久化被隐藏的 charId。
// 与 ccfolia 的 invisible / hideStatus 解耦:我们只管自己这一层,
// 最终渲染过滤要同时满足 ccfolia 可见 && 本 store 未隐藏。
//
// 跨 tab 同步:GM_setValue 在 Tampermonkey 里本就跨 tab 共享值,
// 再挂一个 GM_addValueChangeListener,别的 tab 改了就整体替换 state.hidden。
// remote=false 是自己这个 tab 写的,跳过避免自触发环。
import { defineStore } from 'pinia'
import { gmStorage } from '@/infra/pinia-persist-adapter'

const PERSIST_KEY = 'ccs:store:overlay-visibility'

interface OverlayVisibilityState {
  hidden: Record<string, true>
}

export const useOverlayVisibilityStore = defineStore('overlay-visibility', {
  state: (): OverlayVisibilityState => ({
    hidden: {},
  }),
  getters: {
    isHidden: state => (charId: string): boolean => state.hidden[charId] === true,
    isVisible() {
      return (charId: string): boolean => !this.isHidden(charId)
    },
  },
  actions: {
    toggle(charId: string) {
      if (this.hidden[charId])
        delete this.hidden[charId]
      else
        this.hidden[charId] = true
    },
    show(charId: string) {
      if (this.hidden[charId])
        delete this.hidden[charId]
    },
    hide(charId: string) {
      this.hidden[charId] = true
    },
  },
  persist: {
    storage: gmStorage,
    key: PERSIST_KEY,
    afterHydrate: ({ store }) => {
      if (typeof GM_addValueChangeListener !== 'function') {
        // 没拿到 GM_addValueChangeListener:userscript 的 @grant 没有这个函数,
        // 常见于 vite.config 改了但 Tampermonkey 里安装的脚本还没更新。
        console.warn('[ccs] overlay-visibility: GM_addValueChangeListener 不可用,跨 tab 同步关闭。请在 Tampermonkey 重新安装/更新脚本。')
        return
      }
      const s = store as ReturnType<typeof useOverlayVisibilityStore>
      GM_addValueChangeListener(PERSIST_KEY, (_k, _old, newValue, remote) => {
        if (!remote)
          return
        // 不能用 store.$hydrate():它内部是 $patch(obj) 深合并,
        // 另一个 tab 删 key 时本 tab 合并不到 delete,所以直接整体替换 state.hidden。
        try {
          const parsed = typeof newValue === 'string' ? JSON.parse(newValue) : newValue
          const nextHidden = (parsed && typeof parsed === 'object' && parsed.hidden && typeof parsed.hidden === 'object')
            ? parsed.hidden as Record<string, true>
            : {}
          s.$patch((state) => {
            state.hidden = nextHidden
          })
        }
        catch (e) {
          console.warn('[ccs] overlay-visibility: failed to apply remote change', e)
        }
      })
    },
  },
})
