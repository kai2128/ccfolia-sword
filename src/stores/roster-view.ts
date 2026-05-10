import { defineStore } from 'pinia'
import { gmStorage } from '@/infra/pinia-persist-adapter'

interface RosterViewState {
  onCanvasOnly: boolean
  offCanvasOnly: boolean
}

export const useRosterViewStore = defineStore('rosterView', {
  state: (): RosterViewState => ({
    onCanvasOnly: false,
    offCanvasOnly: false,
  }),
  actions: {
    // 两个过滤互斥:打开一个就关掉另一个,避免并存出"全空"
    toggleOnCanvasOnly() {
      this.onCanvasOnly = !this.onCanvasOnly
      if (this.onCanvasOnly)
        this.offCanvasOnly = false
    },
    setOnCanvasOnly(value: boolean) {
      this.onCanvasOnly = value
      if (value)
        this.offCanvasOnly = false
    },
    toggleOffCanvasOnly() {
      this.offCanvasOnly = !this.offCanvasOnly
      if (this.offCanvasOnly)
        this.onCanvasOnly = false
    },
    setOffCanvasOnly(value: boolean) {
      this.offCanvasOnly = value
      if (value)
        this.onCanvasOnly = false
    },
  },
  persist: {
    storage: gmStorage,
    key: 'ccs:store:roster-view',
  },
})
