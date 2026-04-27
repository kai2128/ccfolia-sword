// Actor 复合 ID:`${charId}::${partKey}`。
// - 单部位 / 整体角色:partKey=''(序列化为 'xxx::')
// - 多部位:partKey 是 ccfolia status label 的前缀(如 'XX' / 'X1')
// 使用同款 '::' 分隔符,与 BatchAssignTagsDialog 已用的 cell key 风格一致。

const SEP = '::'

export function formatActorRef(charId: string, partKey: string): string {
  return `${charId}${SEP}${partKey}`
}

export function parseActorRef(ref: string): { charId: string, partKey: string } {
  const idx = ref.indexOf(SEP)
  if (idx < 0)
    return { charId: ref, partKey: '' } // 兼容老格式(纯 charId)
  return { charId: ref.slice(0, idx), partKey: ref.slice(idx + SEP.length) }
}
