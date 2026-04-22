import { defineStore } from 'pinia'
import { gmStorage } from '@/infra/pinia-persist-adapter'

interface RosterViewState {
  onCanvasOnly: boolean
}

export const useRosterViewStore = defineStore('rosterView', {
  state: (): RosterViewState => ({
    onCanvasOnly: false,
  }),
  actions: {
    toggleOnCanvasOnly() {
      this.onCanvasOnly = !this.onCanvasOnly
    },
    setOnCanvasOnly(value: boolean) {
      this.onCanvasOnly = value
    },
  },
  persist: {
    storage: gmStorage,
    key: 'ccs:store:roster-view',
  },
})
