<script setup lang="ts">
import { computed } from 'vue'
import { useRoomCharactersStore } from '@/ccfolia/room-characters-store'
import ActionForm from '@/components/combat/ActionForm.vue'
import ActorQuickSwitcher from '@/components/combat/ActorQuickSwitcher.vue'
import { useEncounterStore } from '@/stores/encounter'

const encounter = useEncounterStore()
const chars = useRoomCharactersStore()

const pendingChars = computed(() =>
  encounter.local.pendingIds
    .map(id => chars.byId(id))
    .filter(char => !!char),
)

const actedChars = computed(() =>
  encounter.local.actedIds
    .map(id => chars.byId(id))
    .filter(char => !!char),
)

const currentActor = computed(() =>
  encounter.local.currentActorId ? chars.byId(encounter.local.currentActorId) ?? null : null,
)

function startCombat() {
  encounter.beginCombat(chars.all.map(char => char._id))
}

function selectActor(id: string) {
  encounter.selectActor(id)
}

function finishActor() {
  if (encounter.local.currentActorId)
    encounter.finishActor(encounter.local.currentActorId)
}

function nextTurn() {
  // 这里需要同步确认框,允许 GM 在还有未行动者时强行推进回合。
  // eslint-disable-next-line no-alert
  if (encounter.local.pendingIds.length > 0 && !window.confirm('还有人未行动,确认推进回合?'))
    return
  encounter.nextTurn()
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

      <section class="flex flex-col gap-2 border border-white/10 rounded-md bg-white/3 p-3">
        <div>
          <h4 class="text-xs text-white/60">
            未行动
          </h4>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="char in pendingChars"
              :key="char!._id"
              type="button"
              class="border border-accent/30 rounded bg-accent/10 px-2 py-1 text-xs text-white transition-colors hover:bg-accent/20"
              @click="selectActor(char!._id)"
            >
              {{ char!.name }}
            </button>
            <span v-if="pendingChars.length === 0" class="text-xs text-white/35">
              本回合已全部行动
            </span>
          </div>
        </div>

        <div>
          <h4 class="text-xs text-white/60">
            已行动
          </h4>
          <div class="mt-2 flex flex-wrap gap-2">
            <span
              v-for="char in actedChars"
              :key="char!._id"
              class="rounded bg-white/8 px-2 py-1 text-xs text-white/45 line-through"
            >
              {{ char!.name }}
            </span>
            <span v-if="actedChars.length === 0" class="text-xs text-white/35">
              还没有角色完成行动
            </span>
          </div>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <ActorQuickSwitcher />
      </section>

      <section v-if="currentActor" class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2">
          <h4 class="text-sm text-white">
            当前行动者：{{ currentActor.name }}
          </h4>
          <button
            type="button"
            class="h-7 rounded bg-white/10 px-2 text-xs text-white/80 transition-colors hover:bg-white/15"
            @click="finishActor"
          >
            结束该角色回合
          </button>
        </div>
        <ActionForm :key="currentActor._id" :actor-id="currentActor._id" />
      </section>
      <section v-else class="border border-white/10 rounded-md border-dashed px-3 py-4 text-xs text-white/40">
        从未行动池或下方快速切换 chip 选择角色。
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
  </section>
</template>
