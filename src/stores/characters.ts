// 角色模板库 store。state 是 Record,getters 提供 runtime 视图,
// persist 把整个 templates 映射序列化到单个 GM 键。

import type { RuntimeCharacter, StoredCharacter } from '@/types/character'
import { defineStore } from 'pinia'
import { denormalizeCharacter, normalizeCharacter } from '@/core/character/normalize'
import { validateStoredCharacter } from '@/core/character/validate'
import { gmStorage } from '@/infra/pinia-persist-adapter'

interface CharactersState {
  templates: Record<string, StoredCharacter>
}

export interface ImportResult {
  imported: number // 新增条数
  skipped: number // id 冲突跳过条数
  total: number // 输入总条数
}

export class ImportValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message)
    this.name = 'ImportValidationError'
  }
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
    // 导入策略:id 冲突默认 skip(不覆盖已有)。校验失败抛 ImportValidationError,
    // UI 把 field/message 显示给用户,store 不留半成品。
    importJson(json: string): ImportResult {
      const parsed = JSON.parse(json) as StoredCharacter | StoredCharacter[]
      const list = Array.isArray(parsed) ? parsed : [parsed]
      for (let i = 0; i < list.length; i++) {
        const r = validateStoredCharacter(list[i])
        if (!r.ok)
          throw new ImportValidationError(`[${i}].${r.field}`, r.message)
      }
      let imported = 0
      let skipped = 0
      for (const c of list) {
        if (this.templates[c.id]) {
          skipped++
          continue
        }
        this.templates[c.id] = c
        imported++
      }
      return { imported, skipped, total: list.length }
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
