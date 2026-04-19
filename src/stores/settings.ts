// 用户偏好 store。MVP 占位,字段按需扩充。

import { defineStore } from 'pinia'
import { gmStorage } from '@/infra/pinia-persist-adapter'

interface SettingsState {
  defaultPowerTableId: string | null
  logMaxLines: number
  theme: 'light' | 'dark' | 'auto'
}

export const useSettingsStore = defineStore('settings', {
  state: (): SettingsState => ({
    defaultPowerTableId: null,
    logMaxLines: 500,
    theme: 'auto',
  }),
  actions: {
    setDefaultPowerTable(id: string | null) {
      this.defaultPowerTableId = id
    },
    setTheme(theme: SettingsState['theme']) {
      this.theme = theme
    },
    setLogMaxLines(n: number) {
      this.logMaxLines = Math.max(50, Math.min(5000, n))
    },
  },
  persist: {
    storage: gmStorage,
    key: 'ccs:store:settings',
  },
})
