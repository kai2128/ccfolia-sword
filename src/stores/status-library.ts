// 状态效果库:builtin(硬编码,不可删改)+ custom(GM 自定义,持久化)
// 只持久化 custom —— builtin 每次启动从源码重建,避免老快照卡住升级

import type { StatusEffectDefinition } from '@/types/buff-v3'
import { defineStore } from 'pinia'
import { BUILTIN_STATUS_EFFECTS } from '@/core/buff/builtin'
import { gmStorage } from '@/infra/pinia-persist-adapter'

interface StatusLibraryState {
  custom: Record<string, StatusEffectDefinition>
}

export const useStatusLibraryStore = defineStore('statusLibrary', {
  state: (): StatusLibraryState => ({
    custom: {},
  }),
  getters: {
    builtin(): StatusEffectDefinition[] {
      return BUILTIN_STATUS_EFFECTS
    },
    all(state): StatusEffectDefinition[] {
      return [...BUILTIN_STATUS_EFFECTS, ...Object.values(state.custom)]
    },
    byId: state => (id: string): StatusEffectDefinition | undefined => {
      return BUILTIN_STATUS_EFFECTS.find(d => d.id === id) ?? state.custom[id]
    },
  },
  actions: {
    upsertCustom(def: StatusEffectDefinition) {
      if (BUILTIN_STATUS_EFFECTS.some(b => b.id === def.id))
        throw new Error(`cannot override builtin status: ${def.id}`)
      this.custom[def.id] = { ...def, builtin: false }
    },
    removeCustom(id: string) {
      delete this.custom[id]
    },
    resetCustom() {
      this.custom = {}
    },
  },
  persist: {
    storage: gmStorage,
    key: 'ccs:store:status-library:v4',
  },
})
