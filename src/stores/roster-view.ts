import { defineStore } from 'pinia'
import { gmStorage } from '@/infra/pinia-persist-adapter'

interface RosterViewState {
  onCanvasOnly: boolean
  offCanvasOnly: boolean
  nameQuery: string
  batchNameQuery: string
}

export const useRosterViewStore = defineStore('rosterView', {
  state: (): RosterViewState => ({
    onCanvasOnly: false,
    offCanvasOnly: false,
    nameQuery: '',
    batchNameQuery: '',
  }),
  actions: {
    setNameQuery(value: string) {
      this.nameQuery = value
    },
    clearNameQuery() {
      this.nameQuery = ''
    },
    setBatchNameQuery(value: string) {
      this.batchNameQuery = value
    },
    clearBatchNameQuery() {
      this.batchNameQuery = ''
    },
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
