// 用户偏好 store。MVP 占位,字段按需扩充。

import { defineStore } from 'pinia'
import { setRingSize } from '@/infra/log'
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
      // log.setRingSize 自己会夹紧范围,这里只存原值
      this.logMaxLines = n
      setRingSize(n)
    },
    // 启动时由使用方调一次,把持久化的值推到日志环;避免 log.ts 反向依赖 store
    applyLogMaxLines() {
      setRingSize(this.logMaxLines)
    },
  },
  persist: {
    storage: gmStorage,
    key: 'ccs:store:settings',
  },
})
