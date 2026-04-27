// Actor 复合 ID:`${charId}::${partKey}`(单部位 partKey='' 时即 'xxx::')。
// 持久化(encounter store / sessionStorage)用字符串;运行时拆成 charId + partKey。

const SEP = '::'

export function formatActorRef(charId: string, partKey: string): string {
  return `${charId}${SEP}${partKey}`
}

export function parseActorRef(ref: string): { charId: string, partKey: string } {
  const idx = ref.indexOf(SEP)
  if (idx < 0)
    return { charId: ref, partKey: '' }
  return { charId: ref.slice(0, idx), partKey: ref.slice(idx + SEP.length) }
}

export function formatActorDisplayName(charName: string, partKey: string): string {
  return partKey ? `${charName} · ${partKey}` : charName
}
