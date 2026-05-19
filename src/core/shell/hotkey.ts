export interface HotkeyBinding {
  alt?: boolean
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  // 物理键标识,如 'KeyS' / 'KeyZ' / 'Enter'。Mac 上 Option 修饰会把 ev.key 合成
  // 成 'ß' / 'Ω' 等字符,只有 ev.code 是稳定的;含 Alt 的快捷键必须用 code。
  code?: string
  // 字符键标识(大小写不敏感)。仅在未提供 code 时回退使用。
  key?: string
}

export function matchesHotkey(ev: KeyboardEvent, bind: HotkeyBinding): boolean {
  if (bind.code !== undefined) {
    if (ev.code !== bind.code)
      return false
  }
  else if (bind.key !== undefined) {
    if (ev.key.toLowerCase() !== bind.key.toLowerCase())
      return false
  }
  else {
    return false
  }
  if (Boolean(ev.altKey) !== Boolean(bind.alt))
    return false
  if (Boolean(ev.ctrlKey) !== Boolean(bind.ctrl))
    return false
  if (Boolean(ev.metaKey) !== Boolean(bind.meta))
    return false
  if (Boolean(ev.shiftKey) !== Boolean(bind.shift))
    return false
  return true
}

export function bindHotkey(
  bind: HotkeyBinding,
  handler: (ev: KeyboardEvent) => void,
): () => void {
  const onKey = (ev: KeyboardEvent) => {
    if (matchesHotkey(ev, bind)) {
      ev.preventDefault()
      handler(ev)
    }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}
