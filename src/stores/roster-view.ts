import type { RosterSortMode } from '@/core/roster/group'
import { defineStore } from 'pinia'
import { gmStorage } from '@/infra/pinia-persist-adapter'

interface RosterViewState {
  onCanvasOnly: boolean
  offCanvasOnly: boolean
  nameQuery: string
  batchNameQuery: string
  sortMode: RosterSortMode
}

export const useRosterViewStore = defineStore('rosterView', {
  state: (): RosterViewState => ({
    onCanvasOnly: false,
    offCanvasOnly: false,
    nameQuery: '',
    batchNameQuery: '',
    sortMode: 'name',
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
    toggleSortMode() {
      this.sortMode = this.sortMode === 'position' ? 'name' : 'position'
    },
    setSortMode(mode: RosterSortMode) {
      this.sortMode = mode
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
