import { describe, expect, it } from 'vitest'
import { resistLabels } from './resist-text'

describe('resistLabels', () => {
  it('returns 命中/未命中 for evasion', () => {
    expect(resistLabels('evasion')).toEqual({
      successLabel: '未命中',
      failureLabel: '命中',
    })
  })

  it('returns 抵抗成功/失败 for mental', () => {
    expect(resistLabels('mental')).toEqual({
      successLabel: '抵抗成功',
      failureLabel: '抵抗失败',
    })
  })

  it('returns 抵抗成功/失败 for life', () => {
    expect(resistLabels('life')).toEqual({
      successLabel: '抵抗成功',
      failureLabel: '抵抗失败',
    })
  })

  it('returns null for none', () => {
    expect(resistLabels('none')).toBeNull()
  })
})
