// Roster 内"选择模式"共享 store。BatchApplySheet 与 roster tab 内联 selection 模式都用这一份。
// selected 装 part 级 actorRef(`${charId}::${partKey}`),char 级聚合由调用方传 partKeys。
// 故意不持久化:userscript 重载即清空,符合"操作内瞬时状态"语义。
import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'
import { formatActorRef, parseActorRef } from '@/core/encounter/actor-ref'

export const useRosterSelectionStore = defineStore('rosterSelection', () => {
  const selectionMode = ref(false)
  const selected = reactive(new Set<string>())
  // 单向同步:ccfolia 画布选中 → roster 选中(replace 语义,不写回画布)。默认开。
  // 实际的 watch 在 RosterSelectionBar 里(需要 partsByCharId 把 char 展开成 part)。
  const syncFromCanvas = ref(true)

  const size = computed(() => selected.size)

  function enter() {
    selectionMode.value = true
  }
  function exit() {
    selectionMode.value = false
    selected.clear()
  }
  function toggleSyncFromCanvas() {
    syncFromCanvas.value = !syncFromCanvas.value
  }
  // 整体替换(给画布同步用):清空后写入新集合
  function replace(refs: Iterable<string>) {
    selected.clear()
    for (const r of refs)
      selected.add(r)
  }
  function toggle(ref: string) {
    if (selected.has(ref))
      selected.delete(ref)
    else
      selected.add(ref)
  }
  function add(refs: Iterable<string>) {
    for (const r of refs)
      selected.add(r)
  }
  function remove(refs: Iterable<string>) {
    for (const r of refs)
      selected.delete(r)
  }
  function invert(refs: Iterable<string>) {
    for (const r of refs) {
      if (selected.has(r))
        selected.delete(r)
      else
        selected.add(r)
    }
  }
  function clear() {
    selected.clear()
  }
  function has(ref: string): boolean {
    return selected.has(ref)
  }

  // char 级聚合:partKeys 由调用方提供(单部位传 [''],多部位传所有 partKey)
  function charRefs(charId: string, partKeys: string[]): string[] {
    if (partKeys.length === 0)
      return [formatActorRef(charId, '')]
    return partKeys.map(k => formatActorRef(charId, k))
  }

  function charSelectionState(
    charId: string,
    partKeys: string[],
  ): 'all' | 'partial' | 'none' {
    const refs = charRefs(charId, partKeys)
    let hit = 0
    for (const r of refs) {
      if (selected.has(r))
        hit++
    }
    if (hit === 0)
      return 'none'
    if (hit === refs.length)
      return 'all'
    return 'partial'
  }

  function toggleChar(charId: string, partKeys: string[]) {
    const refs = charRefs(charId, partKeys)
    const state = charSelectionState(charId, partKeys)
    if (state === 'all') {
      for (const r of refs)
        selected.delete(r)
    }
    else {
      for (const r of refs)
        selected.add(r)
    }
  }

  // 给 char 级 writer 用(Move / Tag):从 part 级 ref 去重出唯一 charId
  const uniqueSelectedCharIds = computed<string[]>(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const ref of selected) {
      const { charId } = parseActorRef(ref)
      if (seen.has(charId))
        continue
      seen.add(charId)
      out.push(charId)
    }
    return out
  })

  return {
    selectionMode,
    selected,
    syncFromCanvas,
    size,
    uniqueSelectedCharIds,
    enter,
    exit,
    toggleSyncFromCanvas,
    replace,
    toggle,
    add,
    remove,
    invert,
    clear,
    has,
    charRefs,
    charSelectionState,
    toggleChar,
  }
})
