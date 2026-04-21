// 每个角色在场景上的 HP/MP pill 是否显示。默认可见,只持久化被隐藏的 charId。
// 与 ccfolia 的 invisible / hideStatus 解耦:我们只管自己这一层,
// 最终渲染过滤要同时满足 ccfolia 可见 && 本 store 未隐藏。
import { defineStore } from 'pinia'
import { gmStorage } from '@/infra/pinia-persist-adapter'

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
    key: 'ccs:store:overlay-visibility',
  },
})
