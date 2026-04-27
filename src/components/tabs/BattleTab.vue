<script setup lang="ts">
import type { TickPrompt } from '@/ccfolia/writers/tick-buff-turns'
import { computed, ref } from 'vue'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import ActionForm from '@/components/combat/ActionForm.vue'
import TargetQuickPicker from '@/components/combat/TargetQuickPicker.vue'
import TickPromptDialog from '@/components/combat/TickPromptDialog.vue'
import { extractParts } from '@/core/character/parts'
import { formatActorDisplayName, formatActorRef, parseActorRef } from '@/core/encounter/actor-ref'
import { useEncounterStore } from '@/stores/encounter'
import { useSettingsStore } from '@/stores/settings'

const encounter = useEncounterStore()
const chars = useRoomCharactersStore()
const settings = useSettingsStore()

interface ActorView {
  ref: string
  displayName: string
}

function buildActorView(actorRef: string): ActorView | null {
  const { charId, partKey } = parseActorRef(actorRef)
  const char = chars.byId(charId)
  if (!char)
    return null
  return {
    ref: actorRef,
    displayName: formatActorDisplayName(char.name, partKey),
  }
}

const pendingChars = computed(() =>
  encounter.local.pendingIds.map(buildActorView).filter((v): v is ActorView => !!v),
)

const actedChars = computed(() =>
  encounter.local.actedIds.map(buildActorView).filter((v): v is ActorView => !!v),
)

const currentActor = computed(() =>
  encounter.local.currentActorId ? buildActorView(encounter.local.currentActorId) : null,
)

function startCombat() {
  // 多部位:每 part 一个 actor slot
  const refs = chars.all.flatMap(c =>
    extractParts(c, settings.statusLabelMap).map(p => formatActorRef(c._id, p.partKey)),
  )
  encounter.beginCombat(refs)
}

function selectActor(actorRef: string) {
  encounter.selectActor(actorRef)
}

function finishActor() {
  if (encounter.local.currentActorId)
    encounter.finishActor(encounter.local.currentActorId)
}

const promptsOpen = ref(false)
const lastPrompts = ref<TickPrompt[]>([])

async function nextTurn() {
  // 这里需要同步确认框,允许 GM 在还有未行动者时强行推进回合。
  // eslint-disable-next-line no-alert
  if (encounter.local.pendingIds.length > 0 && !window.confirm('还有人未行动,确认推进回合?'))
    return
  const prompts = await encounter.nextTurn()
  if (prompts.length > 0) {
    lastPrompts.value = prompts
    promptsOpen.value = true
  }
}

function endCombat() {
  encounter.endCombat()
}
</script>

<template>
  <section class="flex flex-col gap-3">
    <template v-if="!encounter.shared.inCombat">
      <button
        type="button"
        class="h-8 rounded bg-accent/80 px-3 text-sm text-white transition-colors hover:bg-accent"
        @click="startCombat"
      >
        开始战斗
      </button>
      <p class="text-xs text-white/50">
        当前版本会把房间里的 active 角色全部加入战斗。
      </p>
    </template>

    <template v-else>
      <header class="flex items-center justify-between gap-2 border border-white/10 rounded-md bg-white/5 px-3 py-2">
        <span class="text-sm text-white">回合 {{ encounter.shared.turn }}</span>
        <button
          type="button"
          class="h-7 rounded bg-hp/80 px-2 text-xs text-white transition-colors hover:bg-hp"
          @click="endCombat"
        >
          结束战斗
        </button>
      </header>

      <section class="flex flex-col gap-1.5 border border-white/10 rounded-md bg-white/3 px-2 py-1.5">
        <div class="flex flex-col gap-0.5">
          <span class="text-[11px] text-white/50">未行动 · {{ pendingChars.length }}</span>
          <TargetQuickPicker
            :allowed-ids="encounter.local.pendingIds"
            :selected-ids="encounter.local.currentActorId ? [encounter.local.currentActorId] : []"
            empty-text="本回合已全部行动 / 画布上无可选行动者"
            @toggle="selectActor"
          />
        </div>
        <div class="flex flex-wrap items-center gap-1 text-xs">
          <span class="shrink-0 text-[11px] text-white/50">已行动 · {{ actedChars.length }}</span>
          <span
            v-for="actor in actedChars"
            :key="actor.ref"
            class="h-5 flex items-center rounded bg-white/8 px-1.5 text-[11px] text-white/45 line-through"
          >
            {{ actor.displayName }}
          </span>
          <span v-if="actedChars.length === 0" class="text-[11px] text-white/35">
            —
          </span>
        </div>
      </section>

      <section v-if="currentActor" class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <h4 class="text-sm text-white">
            当前行动者：{{ currentActor.displayName }}
          </h4>
          <button
            type="button"
            class="h-7 rounded bg-white/10 px-2 text-xs text-white/80 transition-colors hover:bg-white/15"
            @click="finishActor"
          >
            结束该角色回合
          </button>
        </div>
        <ActionForm :key="currentActor.ref" :actor-ref="currentActor.ref" />
      </section>
      <section v-else class="border border-white/10 rounded-md border-dashed px-3 py-4 text-xs text-white/40">
        从未行动池选择一个角色开始本回合行动。
      </section>

      <footer class="flex justify-end">
        <button
          type="button"
          class="h-8 rounded bg-white/10 px-3 text-sm text-white transition-colors hover:bg-white/15"
          @click="nextTurn"
        >
          下一回合
          <span v-if="encounter.local.pendingIds.length > 0" class="ml-1 text-xs text-white/50">
            (还 {{ encounter.local.pendingIds.length }} 人未行动)
          </span>
        </button>
      </footer>
    </template>

    <TickPromptDialog v-model:open="promptsOpen" :prompts="lastPrompts" />
  </section>
</template>
