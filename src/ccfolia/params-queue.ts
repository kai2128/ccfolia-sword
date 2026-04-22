import type { CcfoliaCharacter, CcfoliaParam } from '@/types/ccfolia'
import { commitParams } from './firestore-writer'
import { useRoomCharactersStore } from './room-characters-store'

export type ParamsUpdater = (current: CcfoliaParam[]) => CcfoliaParam[]

export interface SerializedUpdateDeps {
  readChar: (charId: string) => CcfoliaCharacter | undefined
  commit: (char: CcfoliaCharacter, next: CcfoliaParam[]) => Promise<void>
}

export function makeSerializedParamsUpdate(deps: SerializedUpdateDeps) {
  const queues = new Map<string, Promise<void>>()

  return async function serializedParamsUpdate(
    charId: string,
    updater: ParamsUpdater,
  ): Promise<void> {
    const prev = queues.get(charId) ?? Promise.resolve()
    const next = prev.catch(() => undefined).then(async () => {
      const fresh = deps.readChar(charId)
      if (!fresh)
        throw new Error(`character not found: ${charId}`)

      const nextParams = updater(fresh.params)
      if (nextParams === fresh.params)
        return

      await deps.commit(fresh, nextParams)
    })

    queues.set(charId, next)

    try {
      await next
    }
    finally {
      if (queues.get(charId) === next)
        queues.delete(charId)
    }
  }
}

export const serializedParamsUpdate = makeSerializedParamsUpdate({
  readChar: charId => useRoomCharactersStore().byId(charId),
  commit: commitParams,
})
