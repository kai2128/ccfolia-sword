import type { ActionDraft, Resolution, Target } from '@/core/resolver/types'
import { defineStore } from 'pinia'
import { resolve } from '@/core/resolver/resolve'
import { makeBlankDraft, makeBlankTarget } from '@/core/resolver/types'
import { usePowerTablesStore } from './power-tables'

interface ResolverState {
  draft: ActionDraft | null
}

export const useResolverStore = defineStore('resolver', {
  state: (): ResolverState => ({
    draft: null,
  }),
  getters: {
    isOpen: state => state.draft !== null,
    resolution(state): Resolution | null {
      if (!state.draft)
        return null
      return resolve(state.draft, usePowerTablesStore().tables)
    },
  },
  actions: {
    open() {
      if (!this.draft)
        this.draft = makeBlankDraft()
    },
    close() {
      this.draft = null
    },
    reset() {
      this.draft = makeBlankDraft()
    },
    patchDraft(patch: Partial<ActionDraft>) {
      if (!this.draft)
        return
      this.draft = { ...this.draft, ...patch }
    },
    addTarget() {
      if (!this.draft)
        return
      this.draft.targets.push(makeBlankTarget())
    },
    removeTarget(id: string) {
      if (!this.draft)
        return
      this.draft.targets = this.draft.targets.filter(target => target.id !== id)
    },
    patchTarget(id: string, patch: Partial<Target>) {
      if (!this.draft)
        return
      const index = this.draft.targets.findIndex(target => target.id === id)
      if (index < 0)
        return
      this.draft.targets[index] = { ...this.draft.targets[index], ...patch }
    },
    addCritRoll(pair: [number, number]) {
      if (!this.draft)
        return
      this.draft.critDice.push(pair)
    },
    updateCritRoll(index: number, pair: [number, number]) {
      if (!this.draft || !this.draft.critDice[index])
        return
      this.draft.critDice[index] = pair
    },
    removeCritRoll(index: number) {
      if (!this.draft)
        return
      this.draft.critDice.splice(index, 1)
    },
  },
})
