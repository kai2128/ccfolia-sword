// 纯运行时 UI 状态,不持久化。刷新后回到默认值。
// activeTab 用字符串而非 enum —— 新 Tab 以后加起来没迁移成本。
import { defineStore } from 'pinia'

interface UiState {
  activeTab: string
}

export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    activeTab: 'characters',
  }),
  actions: {
    setTab(tab: string) {
      this.activeTab = tab
    },
  },
})
