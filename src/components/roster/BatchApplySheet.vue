<script setup lang="ts">
import type { SelectedActor } from './batch-apply/types'
import type { CharacterPartView } from '@/core/character/parts'
import type { CcfoliaCharacter } from '@/types/ccfolia'
import type { TagDefinition } from '@/types/tag'
import { computed, reactive, ref, watch } from 'vue'
import { usePiecesStore } from '@/ccfolia/pieces-store'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import { writeStatusValue } from '@/ccfolia/writers/write-status-value'
import RosterSectionHeader from '@/components/roster/RosterSectionHeader.vue'
import { Button, Checkbox, NumberEdit, Sheet, Tabs, TabsContent, TabsList, TabsTrigger, TagChip } from '@/components/ui'
import { useOnCanvasIds } from '@/composables/useOnCanvasIds'
import { usePartsByCharId } from '@/composables/usePartsByCharId'
import { formatActorRef, parseActorRef } from '@/core/encounter/actor-ref'
import { groupRoster } from '@/core/roster/group'
import { readStatusSlot } from '@/core/status-slot'
import { readTagInstances } from '@/core/tag'
import { useOverlayVisibilityStore } from '@/stores/overlay-visibility'
import { useRosterViewStore } from '@/stores/roster-view'
import { useSettingsStore } from '@/stores/settings'
import { useTagLibraryStore } from '@/stores/tag-library'
import BuffPanel from './batch-apply/BuffPanel.vue'
import HpMpPanel from './batch-apply/HpMpPanel.vue'
import MovePanel from './batch-apply/MovePanel.vue'
import OverlayPanel from './batch-apply/OverlayPanel.vue'
import TagPanel from './batch-apply/TagPanel.vue'

const open = defineModel<boolean>('open', { required: true })

const chars = useRoomCharactersStore()
const settings = useSettingsStore()
const view = useRosterViewStore()
const lib = useTagLibraryStore()
const overlayVis = useOverlayVisibilityStore()

const onCanvasIds = useOnCanvasIds()
const partsByCharId = usePartsByCharId()
const pieces = usePiecesStore()

// 同 RosterList:用 pxToCell 的 anchor + origin 公式量化 y,
// 避免 Math.round 边界把同一行内的 piece 翻进上/下一行。
function positionOf(charId: string) {
  const p = pieces.byCharacterId(charId)
  if (!p)
    return null
  const grid = settings.grid
  const cell = grid.cellSizePx || 1
  const anchorY = grid.pieceAnchor === 'center' ? p.y - cell / 2 : p.y
  const row = Math.floor((anchorY - grid.originPx.y) / cell)
  return { x: p.x, y: row }
}

// --- 选中集合(actorRef = `${charId}::${partKey}`,与 RosterPartRow 一致) ---
const selected = reactive(new Set<string>())

// --- 分组(同 BatchAssignTagsDialog) ---
// batchNameQuery 独立持久化(与 roster 面板的 nameQuery 不共享),关 sheet 也保留
const groups = computed(() => groupRoster({
  chars: chars.all,
  isOnCanvas: id => onCanvasIds.value.has(id),
  byTagId: lib.byId,
  onCanvasOnly: view.onCanvasOnly,
  offCanvasOnly: view.offCanvasOnly,
  nameQuery: view.batchNameQuery,
  sortMode: view.sortMode,
  positionOf,
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
  // 清空所有选中(含搜索/过滤视图外的),与 selectedCount 的全集口径保持一致
  selected.clear()
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

// --- 选中 actor 解析助手:把 selected ref 串解出成 char + part,喂给各 panel ---
const selectedActors = computed<SelectedActor[]>(() => {
  const out: SelectedActor[] = []
  for (const ref of selected) {
    const { charId, partKey } = parseActorRef(ref)
    const char = chars.byId(charId)
    if (!char)
      continue
    const part = partsOf(charId).find(p => p.partKey === partKey) ?? null
    out.push({ ref, char, part })
  }
  return out
})

// 搜索/过滤只影响列表视图,不应丢掉视图外已选中的 actor。
// selectedCount 走 selectedActors 全集,避免「搜索后选中数归零」。
const selectedCount = computed(() => selectedActors.value.length)

// Tag / Move 面板:角色级去重(多部位 actor 合并到一个 char)
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

const opTab = ref<'hpmp' | 'buff' | 'tag' | 'overlay' | 'move'>('hpmp')

// 关 sheet 只清父级管的选中集;各 panel 自己 watch sheetOpen 清局部输入
watch(open, (v) => {
  if (!v)
    selected.clear()
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
  <Sheet v-model:open="open" title="批量操作">
    <!-- Sheet 是右侧全高抽屉(w-[min(95vw,34rem)] · h-full),内容区直接占满剩余高度。
         长 buff 名等横向溢出由 overflow-x-auto 兜底;
         操作面板与目标列表分别独立纵向滚动,但都不再设额外封顶 -->
    <div class="min-h-0 w-full flex flex-1 flex-col gap-3 overflow-x-auto overflow-y-hidden">
      <!-- 操作面板:hug content(用 !flex-none 压掉 Tabs 内置的 flex-1,
           否则会把空高度撑满 sheet 一半);Buff tab 的 BuffPicker 较高时由 max-h + overflow 兜底 -->
      <Tabs v-model="opTab" class="max-h-[45vh] overflow-auto !flex-none">
        <TabsList class="h-8 flex border-b border-white/10">
          <TabsTrigger
            value="hpmp"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            HP / MP
          </TabsTrigger>
          <TabsTrigger
            value="move"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            移动
          </TabsTrigger>
          <TabsTrigger
            value="overlay"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            场景指示
          </TabsTrigger>
          <TabsTrigger
            value="tag"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            Tag
          </TabsTrigger>
          <TabsTrigger
            value="buff"
            class="h-8 px-3 text-xs text-white/60 data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white"
          >
            Buff
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hpmp">
          <HpMpPanel
            :selected-actors="selectedActors"
            :selected-count="selectedCount"
            :sheet-open="open"
          />
        </TabsContent>

        <TabsContent value="move">
          <MovePanel
            :unique-selected-chars="uniqueSelectedChars"
            :sheet-open="open"
          />
        </TabsContent>

        <TabsContent value="overlay">
          <OverlayPanel :selected-actors="selectedActors" />
        </TabsContent>

        <TabsContent value="tag">
          <TagPanel :unique-selected-chars="uniqueSelectedChars" />
        </TabsContent>

        <TabsContent value="buff">
          <BuffPanel
            :selected-actors="selectedActors"
            :selected-count="selectedCount"
            :sheet-open="open"
          />
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
          <button
            type="button"
            class="h-5 flex items-center gap-1 border rounded px-1.5 text-xs transition-colors"
            :class="view.sortMode === 'position' ? 'border-accent bg-accent/20 text-white' : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
            :title="view.sortMode === 'position'
              ? '当前按画布位置排序(上→下、左→右),点击切回按名称'
              : '按画布位置排序(上→下、左→右),仍保留 tag 分组'"
            @click="view.toggleSortMode()"
          >
            <span :class="view.sortMode === 'position' ? 'i-lucide-layout-grid' : 'i-lucide-arrow-down-a-z'" class="text-3" />
            {{ view.sortMode === 'position' ? '位置' : '名称' }}
          </button>
          <span class="ml-auto text-xs text-white/50">已选 {{ selectedCount }} / {{ totalCount }}</span>
        </div>

        <!-- 按名搜索:持久化在 roster-view store(与 roster 面板独立) -->
        <div class="pb-1.5">
          <div class="relative">
            <span class="i-lucide-search pointer-events-none absolute left-2 top-1/2 text-3 text-white/40 -translate-y-1/2" />
            <input
              :value="view.batchNameQuery"
              type="text"
              placeholder="按名称搜索"
              class="h-6 w-full border border-white/20 rounded bg-black/30 pl-7 pr-7 text-xs text-white focus:border-accent placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-accent"
              @input="view.setBatchNameQuery(($event.target as HTMLInputElement).value)"
            >
            <button
              v-if="view.batchNameQuery"
              type="button"
              class="absolute right-1 top-1/2 h-4 w-4 flex items-center justify-center rounded text-white/40 -translate-y-1/2 hover:bg-white/10 hover:text-white"
              title="清除搜索"
              @click="view.clearBatchNameQuery()"
            >
              <span class="i-lucide-x text-3" />
            </button>
          </div>
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
  </Sheet>
</template>
