export interface HotkeyBinding {
  alt?: boolean
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  key: string // 区分大小写不敏感
}

export function matchesHotkey(ev: KeyboardEvent, bind: HotkeyBinding): boolean {
  if (ev.key.toLowerCase() !== bind.key.toLowerCase())
    return false
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
