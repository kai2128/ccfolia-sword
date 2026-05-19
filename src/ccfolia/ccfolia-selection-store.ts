// 镜像 ccfolia 1.35.x 新增的画布多选状态(state.app.state.selectedObjects)到 Pinia。
//
// 只读单向:画布选中变化 -> 我们 store 更新 -> RosterRow / BatchApplySheet 订阅高亮。
// 不写回 ccfolia,避免 appStateMutate dispatch 路径在未来版本变脆。
//
// 字段定位参考 ccfolia-re/bundle/src/stores/modules/app.state/slice.ts:356,
// 路径由 ccfolia-re/bundle/src/stores/index.ts:77 的 combineReducers 锁死。
// SelectedObject 的 selectType 为 'character' 时,id === character._id,与
// room-characters-store 用的 id 完全一致;非角色类型(item/marker/deck/diceItem)在
// getter 里过滤掉。
//
// 1.35.0 以下版本 selector 拿不到字段,兜底空数组,行为退化为"无画布选中联动"。

import { defineStore } from 'pinia'
import { getReduxStore, subscribeSlice } from './redux-store'

export type CcfoliaSelectType = 'character' | 'item' | 'deck' | 'marker' | 'diceItem'

export interface CcfoliaSelectedObject {
  selectType: CcfoliaSelectType
  id: string
}

// 多候选 selector:正常路径 state.app.state.selectedObjects;万一未来 ccfolia 把 app.state
// 重命名成 appState 之类的扁平 slice 也能兜住。再不行就空数组,不抛异常。
function selectSelectedObjects(state: unknown): CcfoliaSelectedObject[] {
  const s = state as {
    app?: { state?: { selectedObjects?: CcfoliaSelectedObject[] } }
    appState?: { selectedObjects?: CcfoliaSelectedObject[] }
  }
  return s?.app?.state?.selectedObjects
    ?? s?.appState?.selectedObjects
    ?? []
}

interface CcfoliaSelectionState {
  selectedObjects: CcfoliaSelectedObject[]
}

export const useCcfoliaSelectionStore = defineStore('ccfoliaSelection', {
  state: (): CcfoliaSelectionState => ({ selectedObjects: [] }),
  getters: {
    // 只取角色类型的选中 id,Set 形态便于 RosterRow O(1) 判断。
    selectedCharacterIds(state): Set<string> {
      const out = new Set<string>()
      for (const o of state.selectedObjects) {
        if (o.selectType === 'character')
          out.add(o.id)
      }
      return out
    },
    hasCharacterSelection(state): boolean {
      for (const o of state.selectedObjects) {
        if (o.selectType === 'character')
          return true
      }
      return false
    },
  },
  actions: {
    replace(list: CcfoliaSelectedObject[]) {
      this.selectedObjects = list ?? []
    },
  },
})

let unsub: (() => void) | null = null
let bootstrapTimer: number | null = null

function stopBootstrap() {
  if (bootstrapTimer !== null) {
    window.clearInterval(bootstrapTimer)
    bootstrapTimer = null
  }
}

function trySubscribe(): boolean {
  if (unsub)
    return true
  const store = getReduxStore()
  if (!store)
    return false
  const pinia = useCcfoliaSelectionStore()
  pinia.replace(selectSelectedObjects(store.getState()))
  unsub = subscribeSlice(
    store,
    selectSelectedObjects,
    (list) => {
      pinia.replace(list)
    },
    { emitInitial: false },
  )
  stopBootstrap()
  return true
}

// 与 startRoomCharactersSync 同款退避轮询,Redux store 上线后立刻订阅、停轮询。
export function startCcfoliaSelectionSync(bootstrapIntervalMs = 1000): void {
  if (unsub || bootstrapTimer !== null)
    return
  if (trySubscribe())
    return
  bootstrapTimer = window.setInterval(() => {
    trySubscribe()
  }, bootstrapIntervalMs)
}

export function stopCcfoliaSelectionSync(): void {
  stopBootstrap()
  unsub?.()
  unsub = null
}
