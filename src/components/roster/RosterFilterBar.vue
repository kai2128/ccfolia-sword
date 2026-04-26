<script setup lang="ts">
import type { TickPrompt } from '@/ccfolia/writers/tick-buff-turns'
import { nextTick, ref } from 'vue'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import TickPromptDialog from '@/components/combat/TickPromptDialog.vue'
import { PopConfirm } from '@/components/ui'
import { useEncounterStore } from '@/stores/encounter'
import { useRosterViewStore } from '@/stores/roster-view'

const view = useRosterViewStore()
const encounter = useEncounterStore()
const chars = useRoomCharactersStore()

// 战斗回合控制和 BattleTab 行为完全一致(同一 store);此处只是把"开战 / 下一回合 / 结束战斗"
// 的常用动作搬到 roster 顶栏,GM 不必为推回合切 tab。
const promptsOpen = ref(false)
const lastPrompts = ref<TickPrompt[]>([])

function startCombat() {
  encounter.beginCombat(chars.all.map(c => c._id))
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
  <div class="flex items-center gap-1.5 pb-1">
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
  </div>
</template>
