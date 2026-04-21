<script setup lang="ts">
// 战斗 Tab:ccfolia 房间内的角色列表,Phase 2 的按钮(HP -1 / 挂测试 buff / 清 buff)
// 原地从 App.vue 迁过来,逻辑不变。
import type { CcfoliaCharacter } from '@/types/ccfolia'
import { computed, ref } from 'vue'
import { adjustStatusValue, attachBuff, detachBuff, listBuffs } from '@/ccfolia/firestore-writer'
import { useCcfoliaCharacters } from '@/composables/useCcfoliaCharacters'
import { useFirestoreReady } from '@/composables/useFirestoreReady'

const { characters, usingFallback } = useCcfoliaCharacters(1000)
const { ready: sessionReady } = useFirestoreReady()

function primaryHp(char: CcfoliaCharacter) {
  const hp = char.status.find(s => /hp|ＨＰ/i.test(s.label)) ?? char.status[0]
  return hp ? `${hp.value}/${hp.max}` : '—'
}

function primaryHpIndex(char: CcfoliaCharacter) {
  const idx = char.status.findIndex(s => /hp|ＨＰ/i.test(s.label))
  return idx >= 0 ? idx : 0
}

const busyId = ref<string | null>(null)
const lastError = ref<string | null>(null)
let errorTimer: number | null = null

function setError(msg: string | null) {
  lastError.value = msg
  if (errorTimer !== null) {
    window.clearTimeout(errorTimer)
    errorTimer = null
  }
  if (msg) {
    errorTimer = window.setTimeout(() => {
      lastError.value = null
      errorTimer = null
    }, 5000)
  }
}

async function runWriting(char: CcfoliaCharacter, fn: () => Promise<unknown>) {
  if (!sessionReady.value || busyId.value)
    return
  busyId.value = char._id
  setError(null)
  try {
    await fn()
  }
  catch (e) {
    setError(e instanceof Error ? e.message : String(e))
  }
  finally {
    busyId.value = null
  }
}

function onDamage(char: CcfoliaCharacter) {
  return runWriting(char, () => adjustStatusValue(char, primaryHpIndex(char), -1))
}

function onAttachTestBuff(char: CcfoliaCharacter) {
  return runWriting(char, () => attachBuff(char, {
    name: '测试 buff',
    category: 'buff',
    lifecycle: { kind: 'manual' },
    modifiers: [],
  }))
}

function onClearBuffs(char: CcfoliaCharacter) {
  return runWriting(char, async () => {
    for (const b of listBuffs(char))
      await detachBuff(char, b.id)
  })
}

function buffCount(char: CcfoliaCharacter) {
  return listBuffs(char).length
}

const empty = computed(() => characters.value.length === 0)
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <span class="text-xs opacity-60">
        ccfolia · {{ characters.length }}
        <span v-if="usingFallback" class="text-buff">(fallback)</span>
      </span>
    </div>

    <div v-if="!sessionReady" class="text-xs text-buff">
      等待 Firebase SDK 挂钩…
    </div>

    <div v-if="empty" class="text-xs opacity-60">
      未读到角色(打开含角色立绘的房间)
    </div>

    <ul v-else class="flex flex-col gap-1">
      <li
        v-for="char in characters"
        :key="char._id"
        class="w-full flex chip items-center gap-2 bg-surface/50 text-xs"
      >
        <span class="flex-1 truncate">{{ char.name }}</span>
        <span class="text-hp font-mono">{{ primaryHp(char) }}</span>
        <button
          class="rounded bg-debuff/20 px-1.5 py-0.5 text-debuff font-mono disabled:opacity-30"
          :disabled="!sessionReady || busyId === char._id"
          :title="sessionReady ? 'HP -1' : '等 Firebase SDK'"
          @click="onDamage(char)"
        >
          -1
        </button>
        <button
          class="rounded bg-buff/20 px-1.5 py-0.5 text-buff font-mono disabled:opacity-30"
          :disabled="!sessionReady || busyId === char._id"
          :title="`挂测试 buff(当前 ${buffCount(char)} 个)`"
          @click="onAttachTestBuff(char)"
        >
          +B
        </button>
        <button
          v-if="buffCount(char) > 0"
          class="rounded bg-surface/80 px-1.5 py-0.5 font-mono opacity-70 disabled:opacity-30"
          :disabled="!sessionReady || busyId === char._id"
          :title="`清空 ${buffCount(char)} 个 buff`"
          @click="onClearBuffs(char)"
        >
          ×{{ buffCount(char) }}
        </button>
      </li>
    </ul>

    <div v-if="lastError" class="text-xs text-debuff">
      {{ lastError }}
    </div>
  </div>
</template>
