import type { TagDefinition } from '@/types/tag'
import { defineStore } from 'pinia'
import { BUILTIN_TAGS } from '@/core/tag'
import { gmStorage } from '@/infra/pinia-persist-adapter'
import { isBuiltinTagId } from '@/types/tag'

type BuiltinOverrides = Record<string, Partial<Pick<TagDefinition, 'label' | 'color' | 'icon' | 'order'>>>

interface TagLibraryState {
  custom: Record<string, TagDefinition>
  builtinOverrides: BuiltinOverrides
}

function normalizeOrder(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value))
    return value
  return Number.MAX_SAFE_INTEGER
}

function sortDefinitions(definitions: TagDefinition[]): TagDefinition[] {
  return [...definitions].sort((a, b) => {
    if (a.order !== b.order)
      return a.order - b.order
    return a.id.localeCompare(b.id)
  })
}

function normalizeCustomDef(raw: unknown): TagDefinition | null {
  if (!raw || typeof raw !== 'object')
    return null

  const value = raw as Partial<TagDefinition>
  if (typeof value.id !== 'string' || !value.id)
    return null

  return {
    id: value.id,
    label: typeof value.label === 'string' ? value.label : '(未命名)',
    color: typeof value.color === 'string' ? value.color : '#4b6ef7',
    icon: typeof value.icon === 'string' ? value.icon : undefined,
    order: normalizeOrder(value.order),
    builtin: false,
  }
}

function normalizeOverride(raw: unknown): BuiltinOverrides[string] {
  if (!raw || typeof raw !== 'object')
    return {}

  const value = raw as BuiltinOverrides[string]
  const out: BuiltinOverrides[string] = {
    order: normalizeOrder(value.order),
  }

  if (typeof value.label === 'string')
    out.label = value.label
  if (typeof value.color === 'string')
    out.color = value.color
  if (typeof value.icon === 'string')
    out.icon = value.icon

  return out
}

function applyOverride(base: TagDefinition, override?: BuiltinOverrides[string]): TagDefinition {
  if (!override)
    return base

  return {
    ...base,
    label: override.label ?? base.label,
    color: override.color ?? base.color,
    icon: override.icon ?? base.icon,
    order: override.order ?? base.order,
  }
}

function uuid(): string {
  const cryptoValue = (globalThis as { crypto?: Crypto }).crypto
  if (cryptoValue?.randomUUID)
    return cryptoValue.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const useTagLibraryStore = defineStore('tagLibrary', {
  state: (): TagLibraryState => ({
    custom: {},
    builtinOverrides: {},
  }),
  getters: {
    all(state): TagDefinition[] {
      const builtins = BUILTIN_TAGS.map(tag => applyOverride(tag, state.builtinOverrides[tag.id]))
      const customs = Object.values(state.custom)
      return sortDefinitions([...builtins, ...customs])
    },
    byId(state) {
      return (id: string): TagDefinition | undefined => {
        if (isBuiltinTagId(id)) {
          const base = BUILTIN_TAGS.find(tag => tag.id === id)
          if (!base)
            return undefined
          return applyOverride(base, state.builtinOverrides[id])
        }
        return state.custom[id]
      }
    },
  },
  actions: {
    createCustom(input: Omit<TagDefinition, 'id' | 'builtin'>): TagDefinition {
      const id = `custom.${uuid()}`
      const definition: TagDefinition = { ...input, id, builtin: false }
      this.custom[id] = definition
      return definition
    },
    updateCustom(id: string, patch: Partial<Omit<TagDefinition, 'id' | 'builtin'>>) {
      const existing = this.custom[id]
      if (!existing)
        throw new Error(`custom tag not found: ${id}`)
      this.custom[id] = {
        ...existing,
        ...patch,
        order: patch.order ?? existing.order,
      }
    },
    removeCustom(id: string) {
      if (isBuiltinTagId(id))
        throw new Error(`cannot remove builtin tag: ${id}`)
      delete this.custom[id]
    },
    overrideBuiltin(id: string, patch: BuiltinOverrides[string]) {
      if (!isBuiltinTagId(id))
        throw new Error(`not a builtin tag: ${id}`)
      this.builtinOverrides[id] = {
        ...this.builtinOverrides[id],
        ...patch,
        order: normalizeOrder(patch.order),
      }
    },
    resetBuiltin(id: string) {
      delete this.builtinOverrides[id]
    },
  },
  persist: {
    storage: gmStorage,
    key: 'ccs:store:tag-library',
    afterHydrate: ({ store }) => {
      const tagStore = store as ReturnType<typeof useTagLibraryStore>
      const fixedCustom: Record<string, TagDefinition> = {}
      for (const [id, raw] of Object.entries(tagStore.custom)) {
        const definition = normalizeCustomDef(raw)
        if (definition)
          fixedCustom[id] = definition
      }
      tagStore.custom = fixedCustom

      const fixedOverrides: BuiltinOverrides = {}
      for (const [id, raw] of Object.entries(tagStore.builtinOverrides))
        fixedOverrides[id] = normalizeOverride(raw)
      tagStore.builtinOverrides = fixedOverrides
    },
  },
})
