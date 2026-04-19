// 威力表 store。CRUD + 薄封装 lookup 函数。k 语法解析是 Phase 5 M5 的事。

import type { PowerTable } from '@/types/power-table'
import { defineStore } from 'pinia'
import { lookupPowerDamage } from '@/core/power-table/lookup'
import { gmStorage } from '@/infra/pinia-persist-adapter'

interface PowerTablesState {
  tables: Record<string, PowerTable>
}

export const usePowerTablesStore = defineStore('powerTables', {
  state: (): PowerTablesState => ({
    tables: {},
  }),
  getters: {
    all: state => Object.values(state.tables),
    byId: state => (id: string): PowerTable | undefined => state.tables[id],
  },
  actions: {
    upsert(table: PowerTable) {
      this.tables[table.id] = table
    },
    remove(id: string) {
      delete this.tables[id]
    },
    clear() {
      this.tables = {}
    },
    lookup(tableId: string, power: number, dice2d6Total: number): number {
      const t = this.tables[tableId]
      if (!t)
        throw new Error(`power table not found: ${tableId}`)
      return lookupPowerDamage(t, power, dice2d6Total)
    },
    importJson(json: string): number {
      // 先全部校验再整体应用 — 校验失败时 store 不留半成品
      const parsed = JSON.parse(json) as PowerTable | PowerTable[]
      const list = Array.isArray(parsed) ? parsed : [parsed]
      for (const t of list) {
        if (!isValidPowerTable(t))
          throw new Error(`invalid power table payload: ${t && (t as { id?: unknown }).id}`)
      }
      for (const t of list)
        this.tables[t.id] = t
      return list.length
    },
    exportJson(): string {
      return JSON.stringify(Object.values(this.tables), null, 2)
    },
  },
  persist: {
    storage: gmStorage,
    key: 'ccs:store:powertables',
  },
})

function isValidPowerTable(t: unknown): t is PowerTable {
  if (!t || typeof t !== 'object')
    return false
  const o = t as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.name !== 'string' || !Array.isArray(o.entries))
    return false
  return o.entries.every((e) => {
    if (!e || typeof e !== 'object')
      return false
    const row = e as Record<string, unknown>
    return typeof row.power === 'number'
      && Array.isArray(row.rolls)
      && row.rolls.length === 11
      && row.rolls.every(n => typeof n === 'number')
  })
}
