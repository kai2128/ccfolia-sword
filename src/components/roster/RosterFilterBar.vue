<script setup lang="ts">
import type { TickPrompt } from '@/ccfolia/writers/tick-buff-turns'
import { nextTick, ref } from 'vue'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import TickPromptDialog from '@/components/combat/TickPromptDialog.vue'
import BatchApplySheet from '@/components/roster/BatchApplySheet.vue'
import { PopConfirm } from '@/components/ui'
import { extractParts } from '@/core/character/parts'
import { formatActorRef } from '@/core/encounter/actor-ref'
import { useEncounterStore } from '@/stores/encounter'
import { useRosterSelectionStore } from '@/stores/roster-selection'
import { useRosterViewStore } from '@/stores/roster-view'
import { useSettingsStore } from '@/stores/settings'

const view = useRosterViewStore()
const encounter = useEncounterStore()
const chars = useRoomCharactersStore()
const settings = useSettingsStore()
const selection = useRosterSelectionStore()

function toggleSelectionMode() {
  if (selection.selectionMode)
    selection.exit()
  else
    selection.enter()
}

// 战斗回合控制和 BattleTab 行为完全一致(同一 store);此处只是把"开战 / 下一回合 / 结束战斗"
// 的常用动作搬到 roster 顶栏,GM 不必为推回合切 tab。
const promptsOpen = ref(false)
const lastPrompts = ref<TickPrompt[]>([])
const batchOpsOpen = ref(false)

function startCombat() {
  // 把每个 char 展开成它所有 part 的 actorRef,多部位会出现多个 slot
  const refs = chars.all.flatMap(c =>
    extractParts(c, settings.statusLabelMap).map(p => formatActorRef(c._id, p.partKey)),
  )
  encounter.beginCombat(refs)
}

async function nextTurn() {
  const prompts = await encounter.nextTurn()
  if (prompts.length > 0) {
    lastPrompts.value = prompts
    promptsOpen.value = true
  }
}

function endCombat() {
  encounter.endCombat()
}

// 回合数字 click-to-edit:不走 NumberEdit,因为不想要 -/+ 和 min/max 浮层。
const turnEditing = ref(false)
const turnDraft = ref('')
const turnInputEl = ref<HTMLInputElement | null>(null)

function startTurnEdit() {
  turnDraft.value = String(encounter.shared.turn)
  turnEditing.value = true
  nextTick(() => {
    turnInputEl.value?.focus()
    turnInputEl.value?.select()
  })
}

function commitTurnEdit() {
  // Enter 会先 commit 关闭 → input 被 v-if 卸 → blur 又 fire → 再进 commit。
  // 同 CellEdit 的双触发问题,用 editing flag 挡掉第二次。
  if (!turnEditing.value)
    return
  turnEditing.value = false
  const n = Number.parseInt(turnDraft.value, 10)
  if (Number.isFinite(n))
    encounter.setTurn(n)
}

function onTurnKey(ev: KeyboardEvent) {
  if (ev.key === 'Enter')
    commitTurnEdit()
  else if (ev.key === 'Escape')
    turnEditing.value = false
}
</script>

<template>
  <div class="flex flex-col gap-1 pb-1">
    <div class="flex items-center gap-1.5">
      <button
        type="button"
        class="h-6 flex items-center gap-1 border rounded px-2 text-xs transition-colors"
        :class="view.onCanvasOnly
          ? 'border-accent bg-accent/20 text-white'
          : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
        :title="view.onCanvasOnly ? '当前仅显示画布上的角色,点击关闭' : '仅显示画布上的角色'"
        @click="view.toggleOnCanvasOnly()"
      >
        <span class="i-lucide-map-pin text-3" />
        只看画布上
      </button>

      <button
        type="button"
        class="h-6 flex items-center gap-1 border rounded px-2 text-xs transition-colors"
        :class="view.sortMode === 'position'
          ? 'border-accent bg-accent/20 text-white'
          : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
        :title="view.sortMode === 'position'
          ? '当前按画布位置排序(上→下、左→右),点击切回按名称'
          : '按画布位置排序(上→下、左→右),仍保留 tag 分组'"
        @click="view.toggleSortMode()"
      >
        <span :class="view.sortMode === 'position' ? 'i-lucide-layout-grid' : 'i-lucide-arrow-down-a-z'" class="text-3" />
        {{ view.sortMode === 'position' ? '位置' : '名称' }}
      </button>

      <span class="mx-1 h-4 w-px bg-white/20" />

      <button
        type="button"
        class="h-6 flex items-center gap-1 border rounded px-2 text-xs transition-colors"
        :class="selection.selectionMode
          ? 'border-accent bg-accent/20 text-white'
          : 'border-white/20 bg-black/30 text-white/70 hover:bg-white/10'"
        :title="selection.selectionMode ? '退出多选模式' : '进入多选模式:在 roster 内勾选角色快速做 HP/MP / 移动'"
        @click="toggleSelectionMode"
      >
        <span class="i-lucide-check-square text-3" />
        多选
      </button>

      <button
        type="button"
        class="h-6 flex items-center gap-1 border border-white/20 rounded bg-black/30 px-2 text-xs text-white/70 transition-colors hover:bg-white/10"
        title="批量操作抽屉:HP/MP · Buff · Tag · 场景指示(与 roster 选择模式共享已选)"
        @click="batchOpsOpen = true"
      >
        <span class="i-lucide-layers text-3" />
        批量操作
      </button>

      <div class="ml-auto flex items-center gap-1">
        <template v-if="!encounter.shared.inCombat">
          <button
            type="button"
            class="h-6 flex items-center gap-1 border border-accent/60 rounded bg-accent/15 px-2 text-xs text-white transition-colors hover:bg-accent/30"
            title="开始战斗(把房间内 active 角色全部加入)"
            @click="startCombat"
          >
            <span class="i-lucide-swords text-3" />
            开始战斗
          </button>
        </template>
        <template v-else>
          <span
            class="h-6 flex items-center gap-1 border border-white/15 rounded bg-black/30 px-2 text-xs text-white"
            :title="encounter.local.pendingIds.length > 0
              ? `回合 ${encounter.shared.turn} · 还 ${encounter.local.pendingIds.length} 人未行动 · 点击数字可手动改`
              : `回合 ${encounter.shared.turn} · 全员已行动 · 点击数字可手动改`"
          >
            回合
            <!-- 手动改回合,不走 nextTurn(不 tick buff、不重置 pending) -->
            <input
              v-if="turnEditing"
              ref="turnInputEl"
              v-model="turnDraft"
              type="text"
              inputmode="numeric"
              class="h-4 w-8 border border-accent rounded bg-black/40 px-0.5 text-center text-xs text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-accent"
              @keydown="onTurnKey"
              @blur="commitTurnEdit"
            >
            <button
              v-else
              type="button"
              class="text-xs text-white tabular-nums hover:underline"
              @click="startTurnEdit"
            >
              {{ encounter.shared.turn }}
            </button>
          </span>
          <!-- 还有人未行动才弹气泡确认;全员已行动直接 bypass 推进 -->
          <PopConfirm
            :message="`还有 ${encounter.local.pendingIds.length} 人未行动,确认推进回合?`"
            :bypass="encounter.local.pendingIds.length === 0"
            confirm-text="推进"
            @confirm="nextTurn"
          >
            <button
              type="button"
              class="h-6 w-6 flex items-center justify-center border border-white/20 rounded bg-black/30 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              :title="encounter.local.pendingIds.length > 0
                ? `下一回合(还 ${encounter.local.pendingIds.length} 人未行动)`
                : '下一回合'"
            >
              <span class="i-lucide-skip-forward text-3.5" />
            </button>
          </PopConfirm>
          <PopConfirm
            message="确认结束战斗?"
            confirm-text="结束"
            @confirm="endCombat"
          >
            <button
              type="button"
              class="h-6 w-6 flex items-center justify-center border border-white/20 rounded bg-black/30 text-white/60 transition-colors hover:bg-debuff/20 hover:text-debuff"
              title="结束战斗"
            >
              <span class="i-lucide-square text-3.5" />
            </button>
          </PopConfirm>
        </template>
      </div>

      <TickPromptDialog v-model:open="promptsOpen" :prompts="lastPrompts" />
      <BatchApplySheet v-model:open="batchOpsOpen" />
    </div>

    <!-- 按名搜索:大小写不敏感子串匹配 -->
    <div class="relative">
      <span class="i-lucide-search pointer-events-none absolute left-2 top-1/2 text-3 text-white/40 -translate-y-1/2" />
      <input
        :value="view.nameQuery"
        type="text"
        placeholder="按名称搜索"
        class="h-6 w-full border border-white/20 rounded bg-black/30 pl-7 pr-7 text-xs text-white focus:border-accent placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-accent"
        @input="view.setNameQuery(($event.target as HTMLInputElement).value)"
      >
      <button
        v-if="view.nameQuery"
        type="button"
        class="absolute right-1 top-1/2 h-4 w-4 flex items-center justify-center rounded text-white/40 -translate-y-1/2 hover:bg-white/10 hover:text-white"
        title="清除搜索"
        @click="view.clearNameQuery()"
      >
        <span class="i-lucide-x text-3" />
      </button>
    </div>
  </div>
</template>
