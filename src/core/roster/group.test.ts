import type { CcfoliaCharacter } from '@/types/ccfolia'
import type { TagDefinition } from '@/types/tag'
import { describe, expect, it } from 'vitest'
import { groupRoster } from './group'

const ally: TagDefinition = { id: 'builtin.ally', label: '盟友', color: '#3498db', order: 0, builtin: true }
const enemy: TagDefinition = { id: 'builtin.enemy', label: '敌人', color: '#e74c3c', order: 1, builtin: true }
const tagMap: Record<string, TagDefinition> = { [ally.id]: ally, [enemy.id]: enemy }
const byTagId = (id: string) => tagMap[id]

function ch(id: string, name: string, tagId?: string): CcfoliaCharacter {
  const params = tagId ? [{ label: `cs_tag_${tagId}`, value: '{"attachedAt":0}' }] : []
  return { _id: id, roomId: 'r', name, status: [], params } as CcfoliaCharacter
}

describe('groupRoster', () => {
  it('groups on-canvas first, then off-canvas', () => {
    const chars = [ch('a', 'Glen', ally.id), ch('b', 'Orc', enemy.id), ch('c', 'Stranger')]
    const onCanvas = (id: string) => id === 'a' || id === 'b'
    const groups = groupRoster({ chars, isOnCanvas: onCanvas, byTagId, onCanvasOnly: false })
    expect(groups.map(group => group.location)).toEqual(['on-canvas', 'on-canvas', 'off-canvas'])
  })

  it('sorts groups within same location by tag order; no-tag goes last', () => {
    const chars = [ch('a', 'A'), ch('b', 'B', enemy.id), ch('c', 'C', ally.id)]
    const groups = groupRoster({ chars, isOnCanvas: () => true, byTagId, onCanvasOnly: false })
    expect(groups.map(group => group.primaryTagId)).toEqual([ally.id, enemy.id, null])
  })

  it('filters off-canvas when onCanvasOnly=true', () => {
    const chars = [ch('a', 'Glen', ally.id), ch('b', 'Offline', ally.id)]
    const onCanvas = (id: string) => id === 'a'
    const groups = groupRoster({ chars, isOnCanvas: onCanvas, byTagId, onCanvasOnly: true })
    expect(groups.flatMap(group => group.chars.map(char => char._id))).toEqual(['a'])
  })

  it('sorts chars within a group by name', () => {
    const chars = [ch('a', 'Zed', ally.id), ch('b', 'Anna', ally.id)]
    const groups = groupRoster({ chars, isOnCanvas: () => true, byTagId, onCanvasOnly: false })
    expect(groups[0].chars.map(char => char.name)).toEqual(['Anna', 'Zed'])
  })

  it('filters chars by nameQuery (case-insensitive substring)', () => {
    const chars = [ch('a', 'Glen', ally.id), ch('b', 'Orc', enemy.id), ch('c', 'Goblin', enemy.id)]
    const groups = groupRoster({ chars, isOnCanvas: () => true, byTagId, onCanvasOnly: false, nameQuery: 'g' })
    expect(groups.flatMap(g => g.chars.map(c => c.name)).sort()).toEqual(['Glen', 'Goblin'])
  })

  it('treats blank/whitespace nameQuery as no filter', () => {
    const chars = [ch('a', 'Glen', ally.id), ch('b', 'Orc', enemy.id)]
    const groups = groupRoster({ chars, isOnCanvas: () => true, byTagId, onCanvasOnly: false, nameQuery: '   ' })
    expect(groups.flatMap(g => g.chars.map(c => c._id)).sort()).toEqual(['a', 'b'])
  })

  it('drops tag instance whose definition was removed', () => {
    const chars = [ch('a', 'Ghost', 'custom.removed')]
    const groups = groupRoster({ chars, isOnCanvas: () => true, byTagId, onCanvasOnly: false })
    expect(groups[0].primaryTagId).toBeNull()
  })
})
