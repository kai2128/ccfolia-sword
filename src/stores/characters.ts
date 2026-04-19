// 角色模板库 store。state 是 Record,getters 提供 runtime 视图,
// persist 把整个 templates 映射序列化到单个 GM 键。

import type { RuntimeCharacter, StoredCharacter } from '@/types/character'
import { defineStore } from 'pinia'
import { denormalizeCharacter, normalizeCharacter } from '@/core/character/normalize'
import { gmStorage } from '@/infra/pinia-persist-adapter'

interface CharactersState {
  templates: Record<string, StoredCharacter>
}

export const useCharactersStore = defineStore('characters', {
  state: (): CharactersState => ({
    templates: {},
  }),
  getters: {
    all: state => Object.values(state.templates),
    byId: state => (id: string): StoredCharacter | undefined => state.templates[id],
    asRuntimeList(state): RuntimeCharacter[] {
      return Object.values(state.templates).map(normalizeCharacter)
    },
  },
  actions: {
    upsert(character: StoredCharacter) {
      this.templates[character.id] = character
    },
    upsertRuntime(runtime: RuntimeCharacter) {
      const stored = denormalizeCharacter(runtime)
      this.templates[stored.id] = stored
    },
    remove(id: string) {
      delete this.templates[id]
    },
    clear() {
      this.templates = {}
    },
    importJson(json: string): number {
      // 接受两种:单对象 或 数组。返回导入条数。
      // 先全部校验,再整体应用 — 校验失败时 store 不留半成品
      const parsed = JSON.parse(json) as StoredCharacter | StoredCharacter[]
      const list = Array.isArray(parsed) ? parsed : [parsed]
      for (const c of list) {
        if (!isValidStoredCharacter(c))
          throw new Error(`invalid character payload: ${c && (c as { id?: unknown }).id}`)
      }
      for (const c of list)
        this.templates[c.id] = c
      return list.length
    },
    exportJson(): string {
      return JSON.stringify(Object.values(this.templates), null, 2)
    },
  },
  persist: {
    storage: gmStorage,
    key: 'ccs:store:characters',
  },
})

// 最小校验 —— 不做字段全覆盖,只拦明显格式错误的 JSON
function isValidStoredCharacter(c: unknown): c is StoredCharacter {
  if (!c || typeof c !== 'object')
    return false
  const o = c as Record<string, unknown>
  return typeof o.id === 'string'
    && typeof o.name === 'string'
    && (o.faction === 'friendly' || o.faction === 'enemy' || o.faction === 'neutral')
    && (o.control === 'pc' || o.control === 'gm')
}
