/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { matchesHotkey } from './hotkey'

describe('matchesHotkey', () => {
  it('matches Alt+S', () => {
    const ev = new KeyboardEvent('keydown', { key: 's', altKey: true })
    expect(matchesHotkey(ev, { alt: true, key: 's' })).toBe(true)
  })

  it('case-insensitive key', () => {
    const ev = new KeyboardEvent('keydown', { key: 'S', altKey: true })
    expect(matchesHotkey(ev, { alt: true, key: 's' })).toBe(true)
  })

  it('rejects without alt', () => {
    const ev = new KeyboardEvent('keydown', { key: 's' })
    expect(matchesHotkey(ev, { alt: true, key: 's' })).toBe(false)
  })

  it('rejects with extra modifier when binding says no ctrl', () => {
    const ev = new KeyboardEvent('keydown', { key: 's', altKey: true, ctrlKey: true })
    expect(matchesHotkey(ev, { alt: true, key: 's' })).toBe(false)
  })

  it('accepts ctrl+shift+s when binding asks for it', () => {
    const ev = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, shiftKey: true })
    expect(matchesHotkey(ev, { ctrl: true, shift: true, key: 's' })).toBe(true)
  })
})
