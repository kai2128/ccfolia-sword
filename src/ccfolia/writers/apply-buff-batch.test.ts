import type { BuffInstance } from '@/types/buff-v3'
import type { CcfoliaCharacter, CcfoliaParam } from '@/types/ccfolia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeBuff } from '@/core/buff/codec'

// --- mocks 必须在动态 import 之前 ---
const commitParamsSpy = vi.fn().mockResolvedValue(undefined)
const characterStore = new Map<string, CcfoliaCharacter>()

vi.mock('../firestore-writer', () => ({
  commitParams: commitParamsSpy,
  getCurrentRoomId: () => 'room-1',
  patchStatus: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../room-characters-store', () => ({
  useRoomCharactersStore: () => ({
    byId: (id: string) => characterStore.get(id),
  }),
}))

const { applyBuffBatch, BuffBatchError } = await import('./apply-buff-batch')

function makeBuff(opts: {
  id: string
  definitionId: string
  characterId: string
  partKey?: string
  kind?: 'single' | 'aoe'
}): BuffInstance {
  const kind = opts.kind ?? 'single'
  const attachedTo = kind === 'single'
    ? { kind: 'single' as const, characterId: opts.characterId, partKey: opts.partKey }
    : { kind: 'aoe' as const, centerCharacterId: opts.characterId, radius: 2 }
  return {
    id: opts.id,
    definitionId: opts.definitionId,
    snapshot: { name: opts.definitionId, icon: '', description: '', modifiers: [], polarity: 'positive' },
    attachedTo,
    lifecycle: 'encounter',
    enabled: true,
    attachedAtTurn: 1,
  }
}

function buffParam(buff: BuffInstance): CcfoliaParam {
  return { label: `cs_buff_${buff.id}`, value: encodeBuff(buff) }
}

function makeChar(id: string, params: CcfoliaParam[] = []): CcfoliaCharacter {
  return {
    _id: id,
    roomId: 'room-1',
    name: id,
    status: [],
    params,
  }
}

beforeEach(() => {
  commitParamsSpy.mockClear()
  characterStore.clear()
})

describe('applyBuffBatch attach', () => {
  it('每个目标各自 buildBuff,buildBuff 收到的 partKey 来自 target', async () => {
    characterStore.set('a', makeChar('a'))
    characterStore.set('b', makeChar('b'))

    const buildBuff = vi.fn(target => makeBuff({
      id: `uuid-${target.characterId}-${target.partKey ?? ''}`,
      definitionId: 'burning',
      characterId: target.characterId,
      partKey: target.partKey,
    }))

    await applyBuffBatch({
      kind: 'attach',
      targets: [
        { characterId: 'a' },
        { characterId: 'b', partKey: 'X1' },
      ],
      buildBuff,
    })

    expect(buildBuff).toHaveBeenCalledTimes(2)
    expect(commitParamsSpy).toHaveBeenCalledTimes(2)
  })

  it('同一角色多部位合并成一次 commitParams', async () => {
    characterStore.set('boss', makeChar('boss'))

    await applyBuffBatch({
      kind: 'attach',
      targets: [
        { characterId: 'boss', partKey: 'X1' },
        { characterId: 'boss', partKey: 'X2' },
      ],
      buildBuff: target => makeBuff({
        id: `${target.characterId}-${target.partKey}`,
        definitionId: 'burning',
        characterId: target.characterId,
        partKey: target.partKey,
      }),
    })

    expect(commitParamsSpy).toHaveBeenCalledTimes(1)
    const newParams = commitParamsSpy.mock.calls[0][1] as CcfoliaParam[]
    // 两个 part 各落一条 buff param
    expect(newParams.find(p => p.label === 'cs_buff_boss-X1')).toBeDefined()
    expect(newParams.find(p => p.label === 'cs_buff_boss-X2')).toBeDefined()
  })

  it('空目标不抛错也不写', async () => {
    await applyBuffBatch({
      kind: 'attach',
      targets: [],
      buildBuff: () => makeBuff({ id: 'x', definitionId: 'd', characterId: 'x' }),
    })
    expect(commitParamsSpy).not.toHaveBeenCalled()
  })
})

describe('applyBuffBatch detach', () => {
  it('严格按 partKey 过滤 single buff,不动其他 part 与 AoE', async () => {
    const onX1 = makeBuff({ id: 'b1', definitionId: 'burning', characterId: 'boss', partKey: 'X1' })
    const onX2 = makeBuff({ id: 'b2', definitionId: 'burning', characterId: 'boss', partKey: 'X2' })
    const aoeOnSelf = makeBuff({ id: 'b3', definitionId: 'burning', characterId: 'boss', kind: 'aoe' })
    const otherDef = makeBuff({ id: 'b4', definitionId: 'shield', characterId: 'boss', partKey: 'X1' })

    characterStore.set('boss', makeChar('boss', [
      buffParam(onX1),
      buffParam(onX2),
      buffParam(aoeOnSelf),
      buffParam(otherDef),
    ]))

    await applyBuffBatch({
      kind: 'detach',
      targets: [{ characterId: 'boss', partKey: 'X1' }],
      definitionId: 'burning',
    })

    expect(commitParamsSpy).toHaveBeenCalledTimes(1)
    const newParams = commitParamsSpy.mock.calls[0][1] as CcfoliaParam[]
    expect(newParams.find(p => p.label === 'cs_buff_b1')).toBeUndefined() // X1 burning 被清
    expect(newParams.find(p => p.label === 'cs_buff_b2')).toBeDefined() // X2 burning 保留
    expect(newParams.find(p => p.label === 'cs_buff_b3')).toBeDefined() // AoE 保留
    expect(newParams.find(p => p.label === 'cs_buff_b4')).toBeDefined() // 不同 def 保留
  })

  it('空 partKey 等同于无前缀的 single buff', async () => {
    const onMain = makeBuff({ id: 'b1', definitionId: 'burning', characterId: 'a', partKey: '' })
    characterStore.set('a', makeChar('a', [buffParam(onMain)]))

    await applyBuffBatch({
      kind: 'detach',
      targets: [{ characterId: 'a' }],
      definitionId: 'burning',
    })

    expect(commitParamsSpy).toHaveBeenCalledTimes(1)
    const newParams = commitParamsSpy.mock.calls[0][1] as CcfoliaParam[]
    expect(newParams.find(p => p.label === 'cs_buff_b1')).toBeUndefined()
  })

  it('没匹配 buff 时跳过该角色,不调用 commitParams', async () => {
    characterStore.set('a', makeChar('a', [
      buffParam(makeBuff({ id: 'x', definitionId: 'shield', characterId: 'a' })),
    ]))
    await applyBuffBatch({
      kind: 'detach',
      targets: [{ characterId: 'a' }],
      definitionId: 'burning',
    })
    expect(commitParamsSpy).not.toHaveBeenCalled()
  })

  it('部分角色失败时聚合抛 BuffBatchError (detach)', async () => {
    characterStore.set('a', makeChar('a', [
      buffParam(makeBuff({ id: 'x', definitionId: 'burning', characterId: 'a' })),
    ]))
    // 'b' 不在 store 里 → 抛 character not found

    await expect(
      applyBuffBatch({
        kind: 'detach',
        targets: [{ characterId: 'a' }, { characterId: 'b' }],
        definitionId: 'burning',
      }),
    ).rejects.toThrow(BuffBatchError)

    expect(commitParamsSpy).toHaveBeenCalledTimes(1)
  })
})

describe('applyBuffBatch clear', () => {
  it('清掉选中 part 上的所有 single buff,跨 definitionId', async () => {
    const a = makeBuff({ id: 'a', definitionId: 'burning', characterId: 'boss', partKey: 'X1' })
    const b = makeBuff({ id: 'b', definitionId: 'shield', characterId: 'boss', partKey: 'X1' })
    const c = makeBuff({ id: 'c', definitionId: 'burning', characterId: 'boss', partKey: 'X2' })
    characterStore.set('boss', makeChar('boss', [buffParam(a), buffParam(b), buffParam(c)]))

    await applyBuffBatch({
      kind: 'clear',
      targets: [{ characterId: 'boss', partKey: 'X1' }],
    })

    const newParams = commitParamsSpy.mock.calls[0][1] as CcfoliaParam[]
    expect(newParams.find(p => p.label === 'cs_buff_a')).toBeUndefined()
    expect(newParams.find(p => p.label === 'cs_buff_b')).toBeUndefined()
    expect(newParams.find(p => p.label === 'cs_buff_c')).toBeDefined() // X2 不动
  })

  it('默认不清 AoE,includeAoe=true 时一并清', async () => {
    const single = makeBuff({ id: 's', definitionId: 'burning', characterId: 'boss', partKey: '' })
    const aoe = makeBuff({ id: 'a', definitionId: 'aura', characterId: 'boss', kind: 'aoe' })
    characterStore.set('boss', makeChar('boss', [buffParam(single), buffParam(aoe)]))

    await applyBuffBatch({ kind: 'clear', targets: [{ characterId: 'boss' }] })
    let newParams = commitParamsSpy.mock.calls[0][1] as CcfoliaParam[]
    expect(newParams.find(p => p.label === 'cs_buff_s')).toBeUndefined()
    expect(newParams.find(p => p.label === 'cs_buff_a')).toBeDefined()

    commitParamsSpy.mockClear()
    // 重新装满
    characterStore.set('boss', makeChar('boss', [buffParam(single), buffParam(aoe)]))

    await applyBuffBatch({ kind: 'clear', targets: [{ characterId: 'boss' }], includeAoe: true })
    newParams = commitParamsSpy.mock.calls[0][1] as CcfoliaParam[]
    expect(newParams.find(p => p.label === 'cs_buff_s')).toBeUndefined()
    expect(newParams.find(p => p.label === 'cs_buff_a')).toBeUndefined()
  })

  it('includeParent=true 时:选中非空 part 也带上 parent partKey="" 的 single buff', async () => {
    const onX1 = makeBuff({ id: 'x', definitionId: 'burning', characterId: 'boss', partKey: 'X1' })
    const onParent = makeBuff({ id: 'p', definitionId: 'shield', characterId: 'boss', partKey: '' })
    const onX2 = makeBuff({ id: 'y', definitionId: 'haste', characterId: 'boss', partKey: 'X2' })
    characterStore.set('boss', makeChar('boss', [buffParam(onX1), buffParam(onParent), buffParam(onX2)]))

    await applyBuffBatch({
      kind: 'clear',
      targets: [{ characterId: 'boss', partKey: 'X1' }],
      includeParent: true,
    })

    const newParams = commitParamsSpy.mock.calls[0][1] as CcfoliaParam[]
    expect(newParams.find(p => p.label === 'cs_buff_x')).toBeUndefined()
    expect(newParams.find(p => p.label === 'cs_buff_p')).toBeUndefined() // parent 也清
    expect(newParams.find(p => p.label === 'cs_buff_y')).toBeDefined() // X2 不动
  })

  it('includeParent=false(默认)只清严格匹配 partKey 的 buff', async () => {
    const onX1 = makeBuff({ id: 'x', definitionId: 'burning', characterId: 'boss', partKey: 'X1' })
    const onParent = makeBuff({ id: 'p', definitionId: 'shield', characterId: 'boss', partKey: '' })
    characterStore.set('boss', makeChar('boss', [buffParam(onX1), buffParam(onParent)]))

    await applyBuffBatch({
      kind: 'clear',
      targets: [{ characterId: 'boss', partKey: 'X1' }],
    })

    const newParams = commitParamsSpy.mock.calls[0][1] as CcfoliaParam[]
    expect(newParams.find(p => p.label === 'cs_buff_x')).toBeUndefined()
    expect(newParams.find(p => p.label === 'cs_buff_p')).toBeDefined() // parent 保留
  })

  it('选中 part 没 buff 时不调用 commitParams', async () => {
    characterStore.set('a', makeChar('a', []))
    await applyBuffBatch({ kind: 'clear', targets: [{ characterId: 'a' }] })
    expect(commitParamsSpy).not.toHaveBeenCalled()
  })
})
