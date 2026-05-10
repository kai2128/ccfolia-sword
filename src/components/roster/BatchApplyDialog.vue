<script setup lang="ts">
import type { StatusChange } from '@/ccfolia/writers/apply-action-batch'
import type { BuffBatchTarget } from '@/ccfolia/writers/apply-buff-batch'
import type { CharacterPartView } from '@/core/character/parts'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import type { TagDefinition } from '@/types/tag'
import { computed, reactive, ref, watch } from 'vue'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { applyStatusChangesBatch } from '@/ccfolia/writers/apply-action-batch'
import { applyBuffBatch } from '@/ccfolia/writers/apply-buff-batch'
import { applyBatchMoveOffBoard, applyBatchMoveToCell, applyBatchShift } from '@/ccfolia/writers/apply-move-batch'
import { writeStatusValue } from '@/ccfolia/writers/write-status-value'
import { attachTag, detachTag } from '@/ccfolia/writers/write-tags'
import BuffPicker from '@/components/buffs/BuffPicker.vue'
import RosterSectionHeader from '@/components/roster/RosterSectionHeader.vue'
import { Button, Checkbox, Dialog, Field, Input, NumberEdit, PopConfirm, Select, Tabs, TabsContent, TabsList, TabsTrigger, TagChip } from '@/components/ui'
import { useOnCanvasIds } from '@/composables/useOnCanvasIds'
import { usePartsByCharId } from '@/composables/usePartsByCharId'
import { collectBuffsForPart } from '@/core/buff/collect'
import { resolveNewValue } from '@/core/combat/adjust-hp-mp'
import { evaluateExpression } from '@/core/combat/eval-expr'
import { formatActorRef, parseActorRef } from '@/core/encounter/actor-ref'
import { formatCellRef, parseCellRef } from '@/core/range'
import { groupRoster } from '@/core/roster/group'
import { readStatusSlot } from '@/core/status-slot'
import { readTagInstances } from '@/core/tag'
import { useEncounterStore } from '@/stores/encounter'
import { useOverlayVisibilityStore } from '@/stores/overlay-visibility'
import { useRosterViewStore } from '@/stores/roster-view'
import { useSettingsStore } from '@/stores/settings'
import { useTagLibraryStore } from '@/stores/tag-library'

const open = defineModel<boolean>('open', { required: true })

const chars = useRoomCharactersStore()
const settings = useSettingsStore()
const view = useRosterViewStore()
const lib = useTagLibraryStore()
const encounter = useEncounterStore()
const overlayVis = useOverlayVisibilityStore()

const onCanvasIds = useOnCanvasIds()
const partsByCharId = usePartsByCharId()

// --- 选中集合(actorRef = `${charId}::${partKey}`,与 RosterPartRow 一致) ---
const selected = reactive(new Set<string>())

// --- 分组(同 BatchAssignTagsDialog) ---
const groups = computed(() => groupRoster({
  chars: chars.all,
  isOnCanvas: id => onCanvasIds.value.has(id),
  byTagId: lib.byId,
  onCanvasOnly: view.onCanvasOnly,
  offCanvasOnly: view.offCanvasOnly,
}))

// 当前过滤下可见的角色
const visibleChars = computed<CcfoliaCharacter[]>(() =>
  groups.value.flatMap(g => g.chars),
)

// 把 char 展开成 part 行(单部位一条,多部位 N 条)
function partsOf(charId: string): CharacterPartView[] {
  return partsByCharId.value.get(charId) ?? []
}

// 所有可见 actorRef(用于全选/反选/统计)
const visibleRefs = computed<string[]>(() => {
  const out: string[] = []
  for (const char of visibleChars.value) {
    const parts = partsOf(char._id)
    if (parts.length === 0) {
      out.push(formatActorRef(char._id, ''))
      continue
    }
    for (const p of parts)
      out.push(formatActorRef(char._id, p.partKey))
  }
  return out
})

const totalCount = computed(() => visibleRefs.value.length)
const selectedCount = computed(() => {
  let n = 0
  for (const ref of visibleRefs.value) {
    if (selected.has(ref))
      n++
  }
  return n
})

function toggle(ref: string) {
  if (selected.has(ref))
    selected.delete(ref)
  else
    selected.add(ref)
}

function selectAll() {
  for (const ref of visibleRefs.value)
    selected.add(ref)
}
function invert() {
  for (const ref of visibleRefs.value) {
    if (selected.has(ref))
      selected.delete(ref)
    else
      selected.add(ref)
  }
}
function clearAll() {
  for (const ref of visibleRefs.value)
    selected.delete(ref)
}

// --- 按 tag 选择 ---
// tag 在 char 级,toggle 时把 char 下的所有 part 一并加/减
interface TagBucket {
  tag: TagDefinition | null
  charIds: string[]
}
const tagBuckets = computed<TagBucket[]>(() => {
  const buckets = new Map<string, TagBucket>()
  for (const tag of lib.all)
    buckets.set(tag.id, { tag, charIds: [] })
  const noneBucket: TagBucket = { tag: null, charIds: [] }

  for (const char of visibleChars.value) {
    const tagIds = readTagInstances(char).map(t => t.definitionId)
    if (tagIds.length === 0) {
      noneBucket.charIds.push(char._id)
      continue
    }
    for (const id of tagIds) {
      const bucket = buckets.get(id)
      if (bucket)
        bucket.charIds.push(char._id)
    }
  }
  const out = [...buckets.values()].filter(b => b.charIds.length > 0)
  if (noneBucket.charIds.length > 0)
    out.push(noneBucket)
  return out
})

function bucketRefs(bucket: TagBucket): string[] {
  const out: string[] = []
  for (const charId of bucket.charIds) {
    const parts = partsOf(charId)
    if (parts.length === 0) {
      out.push(formatActorRef(charId, ''))
      continue
    }
    for (const p of parts)
      out.push(formatActorRef(charId, p.partKey))
  }
  return out
}

function tagBucketState(bucket: TagBucket): 'all' | 'partial' | 'none' {
  const refs = bucketRefs(bucket)
  let hit = 0
  for (const ref of refs) {
    if (selected.has(ref))
      hit++
  }
  if (hit === 0)
    return 'none'
  if (hit === refs.length)
    return 'all'
  return 'partial'
}

function toggleTagBucket(bucket: TagBucket) {
  const state = tagBucketState(bucket)
  const refs = bucketRefs(bucket)
  if (state === 'all') {
    for (const ref of refs)
      selected.delete(ref)
  }
  else {
    for (const ref of refs)
      selected.add(ref)
  }
}

// --- 选中 actor 解析助手 ---
interface SelectedActor {
  ref: string
  char: CcfoliaCharacter
  part: CharacterPartView | null // null = 角色无 status(退化场景),HP/MP 跳过
}
const selectedActors = computed<SelectedActor[]>(() => {
  const out: SelectedActor[] = []
  for (const ref of visibleRefs.value) {
    if (!selected.has(ref))
      continue
    const { charId, partKey } = parseActorRef(ref)
    const char = chars.byId(charId)
    if (!char)
      continue
    const part = partsOf(charId).find(p => p.partKey === partKey) ?? null
    out.push({ ref, char, part })
  }
  return out
})

// --- HP/MP tab ---
type SlotKind = 'hp' | 'mp'
const hpMp = reactive({
  slot: 'hp' as SlotKind,
  input: '',
  // 默认不截顶,与单角色 NumberEdit 行为一致;GM 想避免过量治疗就手动勾上
  clampMax: false,
})
const slotOptions: Array<{ value: SlotKind, label: string }> = [
  { value: 'hp', label: 'HP' },
  { value: 'mp', label: 'MP' },
]

const hpMpBusy = ref(false)

// 解析批量输入,语义与单角色 NumberEdit / applyAdjustment 完全一致:
//   '='          → absolute(允许负)。例:=10 / =-5 / =10+5
//   + - * /      → 在 current 上做算术。例:+5 / -3 / *2 / /2
//   裸数字/表达式 → absolute。例:10 / 2*5 / (1+2)*3
// 解析失败返 null,调用方跳过该 target。截顶/截底走 resolveNewValue。
function resolveBatchInput(read: { value: number, max: number }, raw: string): number | null {
  const s = raw.trim()
  if (!s)
    return null
  const first = s[0]
  let evaluated: number | null
  if (first === '=')
    evaluated = evaluateExpression(s.slice(1))
  else if (first === '+' || first === '-' || first === '*' || first === '/')
    evaluated = evaluateExpression(`${read.value}${s}`)
  else
    evaluated = evaluateExpression(s)
  if (evaluated === null)
    return null
  return resolveNewValue(read.value, { mode: 'absolute', input: evaluated, max: read.max, clampMax: hpMp.clampMax })
}

// 「HP 回满」/「MP 回满」快捷:忽略 input 框,把选中 part 的目标 slot 置 max。
// 已经在 max(或 max 缺失/非有限数)的 part 跳过,避免无意义写。
async function applyRestoreToMax(slot: SlotKind) {
  if (selectedCount.value === 0 || hpMpBusy.value)
    return

  const labelMap = settings.statusLabelMap
  const changes: StatusChange[] = []

  for (const actor of selectedActors.value) {
    if (!actor.part)
      continue
    if (slot === 'mp' && !actor.part.mpLabel)
      continue
    const read = readStatusSlot(actor.char.status, slot, labelMap, actor.part.partKey)
    if (!read)
      continue
    if (!Number.isFinite(read.max))
      continue
    if (read.value === read.max)
      continue
    changes.push({ char: actor.char, slot, newValue: read.max, partPrefix: actor.part.partKey })
  }

  if (changes.length === 0)
    return

  hpMpBusy.value = true
  try {
    await applyStatusChangesBatch(changes, labelMap)
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`回满失败:${(e as Error).message}`)
  }
  finally {
    hpMpBusy.value = false
  }
}

async function applyHpMp() {
  if (selectedCount.value === 0 || hpMpBusy.value)
    return
  if (!hpMp.input.trim()) {
    // eslint-disable-next-line no-alert
    alert('请输入数字或表达式(+5 / -3 / =10 / 2*5)')
    return
  }

  const labelMap = settings.statusLabelMap
  const changes: StatusChange[] = []
  let invalidExpr = false

  for (const actor of selectedActors.value) {
    if (!actor.part)
      continue
    if (hpMp.slot === 'mp' && !actor.part.mpLabel)
      continue
    const read = readStatusSlot(actor.char.status, hpMp.slot, labelMap, actor.part.partKey)
    if (!read)
      continue
    const newValue = resolveBatchInput(read, hpMp.input)
    if (newValue === null) {
      invalidExpr = true
      continue
    }
    changes.push({ char: actor.char, slot: hpMp.slot, newValue, partPrefix: actor.part.partKey })
  }

  if (invalidExpr && changes.length === 0) {
    // eslint-disable-next-line no-alert
    alert(`表达式无法解析:${hpMp.input}`)
    return
  }

  if (changes.length === 0) {
    // eslint-disable-next-line no-alert
    alert('选中的目标没有可写入的 HP/MP slot')
    return
  }

  hpMpBusy.value = true
  try {
    await applyStatusChangesBatch(changes, labelMap)
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`批量写入失败:${(e as Error).message}`)
  }
  finally {
    hpMpBusy.value = false
  }
}

// --- Buff tab ---
type BuffMode = 'attach' | 'detach' | 'clear'
const buffMode = ref<BuffMode>('attach')
const clearIncludeAoe = ref(false)
const picker = ref<InstanceType<typeof BuffPicker> | null>(null)
const buffBusy = ref(false)

const buffTargets = computed<BuffBatchTarget[]>(() =>
  selectedActors.value.map(a => ({
    characterId: a.char._id,
    partKey: a.part?.partKey || undefined,
  })),
)

// detach:从选中 actor 各自的 part-buff 列表里取并集(单体 buff,严格按 part)
const detachDefId = ref('')
interface DetachOption { value: string, label: string }
const detachOptions = computed<DetachOption[]>(() => {
  const seen = new Map<string, { name: string, count: number }>()
  for (const actor of selectedActors.value) {
    if (!actor.part)
      continue
    for (const buff of collectBuffsForPart(actor.char, actor.part.partKey)) {
      const cur = seen.get(buff.definitionId)
      if (cur) {
        cur.count++
      }
      else {
        seen.set(buff.definitionId, { name: buff.snapshot.name, count: 1 })
      }
    }
  }
  const list: DetachOption[] = [{ value: '', label: '请选择 Buff' }]
  for (const [defId, info] of seen)
    list.push({ value: defId, label: `${info.name} · ${info.count} 个实例` })
  return list
})

async function applyBuffOp() {
  if (selectedCount.value === 0 || buffBusy.value)
    return

  const targets = buffTargets.value
  if (targets.length === 0)
    return

  buffBusy.value = true
  try {
    if (buffMode.value === 'attach') {
      // 把 picker 引用一次性钉住:applyBuffBatch 触发 firestore snapshot 后,
      // 选中集合 / 视图重算可能让 v-if 短暂失配把 BuffPicker 卸掉,template ref 变 null,
      // 之后再访问 picker.value.commitSaveToLibrary() 就会爆 "Cannot read of null"。
      const inst = picker.value
      if (!inst)
        return
      const prep = inst.prepare()
      if (!prep.ok) {
        // eslint-disable-next-line no-alert
        alert(prep.error)
        return
      }
      const turn = encounter.shared.turn
      await applyBuffBatch({
        kind: 'attach',
        targets,
        buildBuff: target => inst.buildInstance(
          { kind: 'single', characterId: target.characterId, partKey: target.partKey },
          turn,
        ),
      })
      inst.commitSaveToLibrary()
      inst.reset()
    }
    else if (buffMode.value === 'detach') {
      if (!detachDefId.value) {
        // eslint-disable-next-line no-alert
        alert('请选择要卸下的 Buff')
        return
      }
      await applyBuffBatch({
        kind: 'detach',
        targets,
        definitionId: detachDefId.value,
      })
    }
    else {
      // clear:不需要选 def,直接清掉选中 part 上所有 single buff。
      // 误点保护由按钮外面包裹的 PopConfirm 提供(buffMode='clear' 才弹气泡)。
      await applyBuffBatch({
        kind: 'clear',
        targets,
        includeAoe: clearIncludeAoe.value,
        // 多部位角色挂在 parent(partKey='')上的 single buff 也一起清掉,
        // 否则选了所有 part 仍会有"整体" buff 残留
        includeParent: true,
      })
    }
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`批量 buff 操作失败:${(e as Error).message}`)
  }
  finally {
    buffBusy.value = false
  }
}

// --- 显示开关 tab(per-character,选中的多部位 actor 去重到 charId) ---
const overlayCharIds = computed(() => {
  const ids = new Set<string>()
  for (const actor of selectedActors.value)
    ids.add(actor.char._id)
  return [...ids]
})

function applyOverlay(visible: boolean) {
  for (const id of overlayCharIds.value) {
    if (visible)
      overlayVis.show(id)
    else
      overlayVis.hide(id)
  }
}

// --- Tag tab ---
// 选中角色去重(tag 只能挂角色级,不分 part)
const uniqueSelectedChars = computed<CcfoliaCharacter[]>(() => {
  const seen = new Set<string>()
  const out: CcfoliaCharacter[] = []
  for (const actor of selectedActors.value) {
    if (seen.has(actor.char._id))
      continue
    seen.add(actor.char._id)
    out.push(actor.char)
  }
  return out
})
function charHasTag(char: CcfoliaCharacter, tagId: string): boolean {
  return readTagInstances(char).some(t => t.definitionId === tagId)
}
function tagCoverage(tagId: string): { hit: number, total: number } {
  let hit = 0
  for (const c of uniqueSelectedChars.value) {
    if (charHasTag(c, tagId))
      hit++
  }
  return { hit, total: uniqueSelectedChars.value.length }
}
const tagBusy = reactive(new Set<string>())
async function batchAttachTag(tagId: string) {
  if (tagBusy.has(tagId))
    return
  tagBusy.add(tagId)
  try {
    await Promise.all(uniqueSelectedChars.value.map(async (c) => {
      if (!charHasTag(c, tagId))
        await attachTag(c, tagId)
    }))
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`挂 tag 失败:${(e as Error).message}`)
  }
  finally {
    tagBusy.delete(tagId)
  }
}
async function batchDetachTag(tagId: string) {
  if (tagBusy.has(tagId))
    return
  tagBusy.add(tagId)
  try {
    await Promise.all(uniqueSelectedChars.value.map(async (c) => {
      if (charHasTag(c, tagId))
        await detachTag(c, tagId)
    }))
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`卸 tag 失败:${(e as Error).message}`)
  }
  finally {
    tagBusy.delete(tagId)
  }
}

// --- Move tab ---
// 位置是角色级,选中集是 part 级 → 用 uniqueSelectedChars dedupe 到 charId。
// 板内/板外划分由 onCanvasIds 实时算,各 mode 自行决定要喂哪一份给 batch writer。
type MoveMode = 'enter' | 'exit' | 'shift' | 'set'
const moveMode = ref<MoveMode>('enter')
const enterPlacement = ref<'center' | 'cell'>('center')
const enterCellInput = ref('')
const setCellInput = ref('')
const shift = reactive({ dx: 0, dy: 0 })
const moveBusy = ref(false)

const offBoardCharIds = computed(() =>
  uniqueSelectedChars.value.filter(c => !onCanvasIds.value.has(c._id)).map(c => c._id),
)
const onBoardCharIds = computed(() =>
  uniqueSelectedChars.value.filter(c => onCanvasIds.value.has(c._id)).map(c => c._id),
)
const allSelectedCharIds = computed(() => uniqueSelectedChars.value.map(c => c._id))

async function applyMove() {
  if (moveBusy.value)
    return
  const grid = settings.grid

  let resultPromise: Promise<{ ok: number, failures: Array<{ charId: string, error: Error }> }> | null = null

  if (moveMode.value === 'enter') {
    const cell = enterPlacement.value === 'center'
      ? formatCellRef({ col: Math.floor(grid.cols / 2), row: Math.floor(grid.rows / 2) })
      : enterCellInput.value.trim()
    if (!parseCellRef(cell, grid)) {
      // eslint-disable-next-line no-alert
      alert(`无效格位:${cell || '(空)'}`)
      return
    }
    if (offBoardCharIds.value.length === 0)
      return
    resultPromise = applyBatchMoveToCell({ charIds: offBoardCharIds.value, cellRef: cell, grid })
  }
  else if (moveMode.value === 'exit') {
    if (onBoardCharIds.value.length === 0)
      return
    resultPromise = applyBatchMoveOffBoard(onBoardCharIds.value, grid)
  }
  else if (moveMode.value === 'shift') {
    if (shift.dx === 0 && shift.dy === 0)
      return
    if (onBoardCharIds.value.length === 0)
      return
    resultPromise = applyBatchShift({ charIds: onBoardCharIds.value, dx: shift.dx, dy: shift.dy, grid })
  }
  else {
    const cell = setCellInput.value.trim()
    if (!parseCellRef(cell, grid)) {
      // eslint-disable-next-line no-alert
      alert(`无效格位:${cell || '(空)'}`)
      return
    }
    if (allSelectedCharIds.value.length === 0)
      return
    resultPromise = applyBatchMoveToCell({ charIds: allSelectedCharIds.value, cellRef: cell, grid })
  }

  moveBusy.value = true
  try {
    const result = await resultPromise
    if (result.failures.length > 0) {
      // eslint-disable-next-line no-alert
      alert(`成功 ${result.ok} 个,失败 ${result.failures.length} 个:\n${result.failures.map(f => f.error.message).join('\n')}`)
    }
  }
  finally {
    moveBusy.value = false
  }
}

const opTab = ref<'hpmp' | 'buff' | 'tag' | 'overlay' | 'move'>('hpmp')

// 关对话框时清状态
watch(open, (v) => {
  if (!v) {
    selected.clear()
    hpMp.input = ''
    detachDefId.value = ''
    enterCellInput.value = ''
    setCellInput.value = ''
    shift.dx = 0
    shift.dy = 0
  }
})

// 列表渲染:与 RosterList 一致
//   - 单部位:一行(父 = part)
//   - 多部位:父行(汇总,checkbox 控制全部 part) + N 子行(每 part 自己的 checkbox)
// 选中集合只装 part 的 actorRef,父级状态从子级派生。
function isMultiPart(charId: string): boolean {
  return partsOf(charId).length > 1
}

function charPartRefs(charId: string): string[] {
  const parts = partsOf(charId)
  if (parts.length === 0)
    return [formatActorRef(charId, '')]
  return parts.map(p => formatActorRef(charId, p.partKey))
}

function singleRefOf(charId: string): string {
  // 单部位(或无 status):父行就是唯一一行,直接复用 part 的 ref
  const parts = partsOf(charId)
  return formatActorRef(charId, parts[0]?.partKey ?? '')
}

function charSelectionState(charId: string): 'all' | 'partial' | 'none' {
  const refs = charPartRefs(charId)
  let hit = 0
  for (const ref of refs) {
    if (selected.has(ref))
      hit++
  }
  if (hit === 0)
    return 'none'
  if (hit === refs.length)
    return 'all'
  return 'partial'
}

function toggleChar(charId: string) {
  const refs = charPartRefs(charId)
  const state = charSelectionState(charId)
  if (state === 'all') {
    for (const ref of refs)
      selected.delete(ref)
  }
  else {
    for (const ref of refs)
      selected.add(ref)
  }
}

// --- 行内 NumberEdit:与 RosterRow / RosterList 同款单角色写入路径 ---
function rowHp(char: CcfoliaCharacter, partKey: string) {
  return readStatusSlot(char.status, 'hp', settings.statusLabelMap, partKey)
}
function rowMp(char: CcfoliaCharacter, partKey: string) {
  // 没 mpLabel 的 part 不显示 MP 编辑器(留 invisible 占位保持横向对齐)
  const part = partsOf(char._id).find(p => p.partKey === partKey)
  if (!part?.mpLabel)
    return null
  return readStatusSlot(char.status, 'mp', settings.statusLabelMap, partKey)
}
function singlePartKey(charId: string): string {
  return partsOf(charId)[0]?.partKey ?? ''
}
async function writeRow(
  char: CcfoliaCharacter,
  slot: 'hp' | 'mp',
  newValue: number,
  partKey: string,
) {
  try {
    await writeStatusValue({
      char,
      slot,
      newValue,
      labelMap: settings.statusLabelMap,
      partPrefix: partKey,
    })
  }
  catch (e) {
    // eslint-disable-next-line no-alert
    alert(`写入失败:${(e as Error).message}`)
  }
}
</script>

<template>
  <Dialog v-model:open="open" wide title="批量操作">
    <!-- Dialog 已固定 w-[min(95vw,34rem)],这里 w-full 填满 padding 内的内容区。
         个别子节点超宽(如长 buff 名)时由 overflow-x-auto 兜底横滚;
         同时把操作面板与目标列表各自独立纵向滚动,避免叠加超出屏幕 -->
    <div class="min-h-0 w-full flex flex-1 flex-col gap-3 overflow-x-auto overflow-y-hidden">
      <!-- 操作面板:封顶 + 自滚,内容多(BuffPicker 现场新建)也不会撑爆 dialog -->
      <Tabs v-model="opTab" class="max-h-[45vh] shrink-0 overflow-auto">
        <TabsList class="h-8 flex border-b border-white/10">
          <TabsTrigger
            value="hpmp"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            HP / MP
          </TabsTrigger>
          <TabsTrigger
            value="buff"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            Buff
          </TabsTrigger>
          <TabsTrigger
            value="tag"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            Tag
          </TabsTrigger>
          <TabsTrigger
            value="overlay"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            场景指示
          </TabsTrigger>
          <TabsTrigger
            value="move"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            移动
          </TabsTrigger>
        </TabsList>

        <!-- HP/MP -->
        <TabsContent value="hpmp" class="flex flex-col gap-2 pt-3">
          <div class="grid grid-cols-[100px_1fr_auto] items-end gap-2">
            <Field label="对象">
              <Select v-model="hpMp.slot" :options="slotOptions" />
            </Field>
            <Field label="数值(支持表达式)">
              <Input
                v-model="hpMp.input"
                placeholder="+5 / -3 / =10 / 2*5"
                title="与单角色编辑一致:+5/-3/*2/ 对 current 做算术;=10 absolute(允许负);裸数字/表达式 absolute"
              />
            </Field>
            <Button
              size="md"
              :disabled="selectedCount === 0 || hpMpBusy"
              @click="applyHpMp"
            >
              应用 ({{ selectedCount }})
            </Button>
          </div>
          <label class="flex items-center gap-2 text-xs text-white/70">
            <Checkbox v-model="hpMp.clampMax" />
            不超过上限(开启以阻止过量治疗/伤害)
          </label>
          <div class="flex items-center gap-2 pt-1">
            <span class="text-[11px] text-white/40">快捷:</span>
            <Button
              size="xs"
              :disabled="selectedCount === 0 || hpMpBusy"
              title="把选中 part 的 HP 一次性置为 max(忽略数值输入框)"
              @click="applyRestoreToMax('hp')"
            >
              HP 回满 ({{ selectedCount }})
            </Button>
            <Button
              size="xs"
              :disabled="selectedCount === 0 || hpMpBusy"
              title="把选中 part 的 MP 一次性置为 max(忽略数值输入框);无 MP slot 的 part 跳过"
              @click="applyRestoreToMax('mp')"
            >
              MP 回满 ({{ selectedCount }})
            </Button>
          </div>
          <p class="text-[11px] text-white/40">
            多部位角色按勾选的 part 各自写入;MP 仅写有 MP slot 的 part。
          </p>
        </TabsContent>

        <!-- Buff -->
        <TabsContent value="buff" class="flex flex-col gap-3 pt-3">
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="h-7 border rounded px-2 text-xs transition-colors"
              :class="buffMode === 'attach' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
              @click="buffMode = 'attach'"
            >
              挂载
            </button>
            <button
              type="button"
              class="h-7 border rounded px-2 text-xs transition-colors"
              :class="buffMode === 'detach' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
              @click="buffMode = 'detach'"
            >
              卸下
            </button>
            <button
              type="button"
              class="h-7 border rounded px-2 text-xs transition-colors"
              :class="buffMode === 'clear' ? 'border-debuff bg-debuff/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
              @click="buffMode = 'clear'"
            >
              清空
            </button>
            <span class="ml-auto text-xs text-white/50">已选 {{ selectedCount }} 个 part</span>
          </div>

          <template v-if="buffMode === 'attach'">
            <BuffPicker ref="picker" force-single />
          </template>
          <template v-else-if="buffMode === 'detach'">
            <Field label="选择要卸下的 Buff" hint="按 definitionId,严格匹配选中 part 上的 single buff">
              <Select v-model="detachDefId" :options="detachOptions" placeholder="选择 Buff" />
            </Field>
            <p v-if="detachOptions.length <= 1 && selectedCount > 0" class="text-xs text-white/40">
              选中的 part 上没有可移除的单体 buff
            </p>
          </template>
          <template v-else>
            <p class="text-xs text-white/60">
              清掉选中 part 上的所有单体 buff。点击应用前会再确认一次。
            </p>
            <label class="flex items-center gap-2 text-xs text-white/70">
              <Checkbox v-model="clearIncludeAoe" />
              连同中心在该角色身上的 AoE buff 一并清掉
            </label>
          </template>

          <div class="flex justify-end pt-1">
            <PopConfirm
              :message="`确认清除 ${selectedCount} 个 part 上的全部 buff${clearIncludeAoe ? '(含 AoE)' : ''}?`"
              confirm-text="清空"
              :bypass="buffMode !== 'clear'"
              @confirm="applyBuffOp"
            >
              <Button
                size="md"
                :variant="buffMode === 'clear' ? 'danger' : 'solid'"
                :disabled="
                  selectedCount === 0 || buffBusy
                    || (buffMode === 'attach' && !picker?.state.valid)
                    || (buffMode === 'detach' && !detachDefId)
                "
              >
                应用 ({{ selectedCount }})
              </Button>
            </PopConfirm>
          </div>
        </TabsContent>

        <!-- Tag -->
        <TabsContent value="tag" class="flex flex-col gap-2 pt-3">
          <p class="text-xs text-white/60">
            Tag 挂在角色级,多部位角色去重后操作。每个 tag 显示当前选中里的覆盖度。
          </p>
          <div v-if="uniqueSelectedChars.length === 0" class="py-2 text-center text-xs text-white/40">
            未选中角色
          </div>
          <div v-else-if="lib.all.length === 0" class="py-2 text-center text-xs text-white/40">
            Tag 库为空,先去设置里建几个 tag
          </div>
          <div v-else class="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-2 gap-y-1">
            <template v-for="tag in lib.all" :key="tag.id">
              <TagChip :tag="tag" size="sm" />
              <span class="text-[11px] text-white/50 tabular-nums">
                {{ tagCoverage(tag.id).hit }} / {{ tagCoverage(tag.id).total }}
              </span>
              <Button
                size="xs"
                variant="ghost"
                :disabled="tagBusy.has(tag.id) || tagCoverage(tag.id).hit >= tagCoverage(tag.id).total"
                @click="batchAttachTag(tag.id)"
              >
                + 全部添加
              </Button>
              <Button
                size="xs"
                variant="ghost"
                :disabled="tagBusy.has(tag.id) || tagCoverage(tag.id).hit === 0"
                @click="batchDetachTag(tag.id)"
              >
                − 全部移除
              </Button>
            </template>
          </div>
        </TabsContent>

        <!-- 场景指示 -->
        <TabsContent value="overlay" class="flex flex-col gap-2 pt-3">
          <p class="text-xs text-white/60">
            控制角色在场景上的 HP/MP pill 是否显示。pill 是角色级(非 part 级),
            选中多部位的任一 part 即作用于该角色。
          </p>
          <div class="flex gap-2">
            <Button :disabled="overlayCharIds.length === 0" @click="applyOverlay(true)">
              全部显示 ({{ overlayCharIds.length }})
            </Button>
            <Button variant="ghost" :disabled="overlayCharIds.length === 0" @click="applyOverlay(false)">
              全部隐藏 ({{ overlayCharIds.length }})
            </Button>
          </div>
        </TabsContent>

        <!-- 移动 -->
        <TabsContent value="move" class="flex flex-col gap-3 pt-3">
          <!-- mode 切换:抄 buff tab 那三个按钮的样式 -->
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="h-7 border rounded px-2 text-xs transition-colors"
              :class="moveMode === 'enter' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
              @click="moveMode = 'enter'"
            >
              入板
            </button>
            <button
              type="button"
              class="h-7 border rounded px-2 text-xs transition-colors"
              :class="moveMode === 'exit' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
              @click="moveMode = 'exit'"
            >
              出板
            </button>
            <button
              type="button"
              class="h-7 border rounded px-2 text-xs transition-colors"
              :class="moveMode === 'shift' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
              @click="moveMode = 'shift'"
            >
              位移
            </button>
            <button
              type="button"
              class="h-7 border rounded px-2 text-xs transition-colors"
              :class="moveMode === 'set' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
              @click="moveMode = 'set'"
            >
              定位
            </button>
            <span class="ml-auto text-xs text-white/50">已选 {{ uniqueSelectedChars.length }} 名角色</span>
          </div>

          <!-- 入板 -->
          <template v-if="moveMode === 'enter'">
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="h-7 border rounded px-2 text-xs transition-colors"
                :class="enterPlacement === 'center' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
                @click="enterPlacement = 'center'"
              >
                棋盘中心
              </button>
              <button
                type="button"
                class="h-7 border rounded px-2 text-xs transition-colors"
                :class="enterPlacement === 'cell' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
                @click="enterPlacement = 'cell'"
              >
                指定格
              </button>
            </div>
            <Field v-if="enterPlacement === 'cell'" label="目标格位" hint="如 5J / 12C;全部角色叠到该格,后续 GM 在 ccfolia 里手动拖开">
              <Input v-model="enterCellInput" placeholder="5J" />
            </Field>
            <p v-else class="text-xs text-white/50">
              全部放到棋盘中心格(可重叠)。
            </p>
            <div class="flex justify-end pt-1">
              <Button
                size="md"
                :disabled="moveBusy || offBoardCharIds.length === 0 || (enterPlacement === 'cell' && !enterCellInput.trim())"
                @click="applyMove"
              >
                应用 ({{ offBoardCharIds.length }} 在板外)
              </Button>
            </div>
            <p v-if="uniqueSelectedChars.length > 0 && offBoardCharIds.length === 0" class="text-[11px] text-white/40">
              选中角色全部已在板上,跳过。
            </p>
          </template>

          <!-- 出板 -->
          <template v-else-if="moveMode === 'exit'">
            <p class="text-xs text-white/60">
              把选中且在板上的角色一次性收纳到板外位。带「移出场外自动回满 HP / MP」tag 的角色会自动回满 HP/MP。
            </p>
            <div class="flex justify-end pt-1">
              <Button
                size="md"
                :disabled="moveBusy || onBoardCharIds.length === 0"
                @click="applyMove"
              >
                应用 ({{ onBoardCharIds.length }} 在板上)
              </Button>
            </div>
          </template>

          <!-- 位移 -->
          <template v-else-if="moveMode === 'shift'">
            <p class="text-xs text-white/60">
              对在板上的角色整体按格平移,板外的角色跳过。dx 正方向 = 右,dy 正方向 = 下。
            </p>
            <div class="flex items-center gap-3">
              <Field label="dx (列)">
                <NumberEdit :value="shift.dx" @change="(v: number) => shift.dx = v" />
              </Field>
              <Field label="dy (行)">
                <NumberEdit :value="shift.dy" @change="(v: number) => shift.dy = v" />
              </Field>
            </div>
            <div class="flex justify-end pt-1">
              <Button
                size="md"
                :disabled="moveBusy || onBoardCharIds.length === 0 || (shift.dx === 0 && shift.dy === 0)"
                @click="applyMove"
              >
                应用 ({{ onBoardCharIds.length }} 在板上)
              </Button>
            </div>
          </template>

          <!-- 定位 -->
          <template v-else>
            <p class="text-xs text-white/60">
              覆盖式写入位置:全部选中角色(包括已在板上的)都移到目标格。
            </p>
            <Field label="目标格位">
              <Input v-model="setCellInput" placeholder="5J" />
            </Field>
            <div class="flex justify-end pt-1">
              <Button
                size="md"
                :disabled="moveBusy || allSelectedCharIds.length === 0 || !setCellInput.trim()"
                @click="applyMove"
              >
                应用 ({{ allSelectedCharIds.length }})
              </Button>
            </div>
          </template>
        </TabsContent>
      </Tabs>

      <!-- 目标列表:占满剩余空间,内部独立滚动 -->
      <div class="min-h-0 flex flex-1 flex-col border-t border-white/10 pt-2">
        <!-- 工具按钮行 -->
        <div class="flex flex-wrap items-center gap-1.5 pb-1.5">
          <Button size="xs" variant="ghost" :disabled="totalCount === 0" @click="selectAll">
            全选
          </Button>
          <Button size="xs" variant="ghost" :disabled="totalCount === 0" @click="invert">
            反选
          </Button>
          <Button size="xs" variant="ghost" :disabled="selectedCount === 0" @click="clearAll">
            清空
          </Button>
          <button
            type="button"
            class="h-5 flex items-center gap-1 border rounded px-1.5 text-xs transition-colors"
            :class="view.onCanvasOnly ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
            @click="view.toggleOnCanvasOnly()"
          >
            <span class="i-lucide-map-pin text-3" />
            仅画布上
          </button>
          <button
            type="button"
            class="h-5 flex items-center gap-1 border rounded px-1.5 text-xs transition-colors"
            :class="view.offCanvasOnly ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
            :title="view.offCanvasOnly ? '当前仅显示板外角色,点击关闭' : '仅显示板外角色'"
            @click="view.toggleOffCanvasOnly()"
          >
            <span class="i-lucide-map-pin-off text-3" />
            仅板外
          </button>
          <span class="ml-auto text-xs text-white/50">已选 {{ selectedCount }} / {{ totalCount }}</span>
        </div>

        <!-- tag 快速选择 chip 行 -->
        <div v-if="tagBuckets.length > 0" class="flex flex-wrap items-center gap-1 pb-2">
          <span class="text-[10px] text-white/40">按 tag:</span>
          <button
            v-for="bucket in tagBuckets"
            :key="bucket.tag?.id ?? '__none__'"
            type="button"
            class="h-5 inline-flex items-center gap-1 border rounded px-1.5 text-[10px] transition-colors"
            :class="{
              'border-accent bg-accent/20 text-white': tagBucketState(bucket) === 'all',
              'border-accent/40 bg-accent/5 text-white/80': tagBucketState(bucket) === 'partial',
              'border-white/15 bg-black/30 text-white/60 hover:bg-white/10': tagBucketState(bucket) === 'none',
            }"
            :title="bucket.tag ? `点击切换 ${bucket.tag.label} 下 ${bucket.charIds.length} 人(含全部 part)的选中` : `点击切换无 tag 的 ${bucket.charIds.length} 人`"
            @click="toggleTagBucket(bucket)"
          >
            <TagChip v-if="bucket.tag" :tag="bucket.tag" size="xs" />
            <span v-else>无 tag</span>
            <span class="text-white/50">·{{ bucket.charIds.length }}</span>
          </button>
        </div>

        <!-- 角色列表:吃掉 dialog 剩余空间,内部滚动 -->
        <div class="min-h-0 flex-1 overflow-auto border border-white/5 rounded">
          <template v-if="totalCount === 0">
            <p class="py-4 text-center text-xs text-white/50">
              当前过滤下没有角色
            </p>
          </template>
          <template v-else>
            <section
              v-for="group in groups"
              :key="`${group.location}-${group.primaryTagId ?? 'none'}`"
              class="px-2"
            >
              <RosterSectionHeader
                :location="group.location"
                :primary-tag="group.primaryTag"
                :count="group.chars.length"
              />
              <ul class="m-0 list-none p-0">
                <template v-for="char in group.chars" :key="char._id">
                  <!-- 父行:多部位 = 汇总(部分选中显示半亮);单部位 = 直接绑那唯一 part -->
                  <li
                    class="flex items-center gap-2 border-b border-white/5 px-1 py-1 last:border-b-0 hover:bg-white/5"
                  >
                    <Checkbox
                      v-if="isMultiPart(char._id)"
                      :model-value="charSelectionState(char._id) === 'all'"
                      :class="{ 'opacity-60': charSelectionState(char._id) === 'partial' }"
                      :title="charSelectionState(char._id) === 'partial' ? '部分 part 已选 · 点击切换全部' : ''"
                      @update:model-value="toggleChar(char._id)"
                    />
                    <Checkbox
                      v-else
                      :model-value="selected.has(singleRefOf(char._id))"
                      @update:model-value="toggle(singleRefOf(char._id))"
                    />
                    <span class="min-w-0 flex-1 truncate text-xs text-white">
                      {{ char.name || '(未命名)' }}
                      <span v-if="isMultiPart(char._id)" class="text-white/40">
                        · {{ partsOf(char._id).length }} 部位
                      </span>
                    </span>
                    <!-- 单部位:父行 = 唯一 part,直接挂 NumberEdit;多部位:汇总行不挂,留占位保持横向对齐 -->
                    <template v-if="!isMultiPart(char._id)">
                      <NumberEdit
                        v-if="rowHp(char, singlePartKey(char._id))"
                        :value="rowHp(char, singlePartKey(char._id))!.value"
                        :max="rowHp(char, singlePartKey(char._id))!.max"
                        @change="v => writeRow(char, 'hp', v, singlePartKey(char._id))"
                      />
                      <span v-else aria-hidden="true" class="invisible h-5 w-18 inline-flex shrink-0 items-center" />
                      <NumberEdit
                        v-if="rowMp(char, singlePartKey(char._id))"
                        :value="rowMp(char, singlePartKey(char._id))!.value"
                        :max="rowMp(char, singlePartKey(char._id))!.max"
                        @change="v => writeRow(char, 'mp', v, singlePartKey(char._id))"
                      />
                      <span v-else aria-hidden="true" class="invisible h-5 w-18 inline-flex shrink-0 items-center" />
                    </template>
                    <template v-else>
                      <span aria-hidden="true" class="invisible h-5 w-18 inline-flex shrink-0 items-center" />
                      <span aria-hidden="true" class="invisible h-5 w-18 inline-flex shrink-0 items-center" />
                    </template>
                    <span
                      class="text-3.5"
                      :class="overlayVis.isVisible(char._id) ? 'i-lucide-chart-bar-big text-white/40' : 'i-lucide-chart-bar-big text-white/15'"
                      :title="overlayVis.isVisible(char._id) ? 'pill 显示中' : 'pill 已隐藏'"
                    />
                  </li>
                  <!-- 子行:仅多部位才出;移动 tab 是角色级,部位行只是噪音,直接折掉 -->
                  <template v-if="isMultiPart(char._id) && opTab !== 'move'">
                    <li
                      v-for="part in partsOf(char._id)"
                      :key="formatActorRef(char._id, part.partKey)"
                      class="flex items-center gap-2 border-b border-white/5 py-0.5 pl-6 pr-1 last:border-b-0 hover:bg-white/5"
                    >
                      <Checkbox
                        :model-value="selected.has(formatActorRef(char._id, part.partKey))"
                        @update:model-value="toggle(formatActorRef(char._id, part.partKey))"
                      />
                      <span class="min-w-0 flex-1 truncate text-[11px] text-white/60">
                        {{ part.partKey || '主' }}
                      </span>
                      <NumberEdit
                        v-if="rowHp(char, part.partKey)"
                        :value="rowHp(char, part.partKey)!.value"
                        :max="rowHp(char, part.partKey)!.max"
                        @change="v => writeRow(char, 'hp', v, part.partKey)"
                      />
                      <span v-else aria-hidden="true" class="invisible h-5 w-18 inline-flex shrink-0 items-center" />
                      <NumberEdit
                        v-if="rowMp(char, part.partKey)"
                        :value="rowMp(char, part.partKey)!.value"
                        :max="rowMp(char, part.partKey)!.max"
                        @change="v => writeRow(char, 'mp', v, part.partKey)"
                      />
                      <span v-else aria-hidden="true" class="invisible h-5 w-18 inline-flex shrink-0 items-center" />
                    </li>
                  </template>
                </template>
              </ul>
            </section>
          </template>
        </div>
      </div>
    </div>
  </Dialog>
</template>
