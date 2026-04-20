<script setup lang="ts">
// UI 原子组件手测面板。仅用于开发期验证行为,不进正式面板。
import { ref } from 'vue'
import { Button, Checkbox, Dialog, Field, Input, Label, Switch } from './ui'

const name = ref('')
const hp = ref<number>(10)
const agree = ref(false)
const triState = ref<boolean | 'indeterminate'>('indeterminate')
const darkMode = ref(true)
const dialogOpen = ref(false)

const nameError = ref<string | null>(null)

function validateName() {
  nameError.value = name.value.trim() ? null : '必填'
}
</script>

<template>
  <div class="w-80 flex flex-col gap-3 card">
    <div class="flex items-center gap-2">
      <div class="i-lucide-flask-conical text-4 text-accent" />
      <span class="text-sm font-medium">UI 原子组件手测</span>
    </div>

    <Field label="角色名" :error="nameError" hint="失焦时校验">
      <template #default="{ id }">
        <Input :id="id" v-model="name" placeholder="输入名字…" @blur="validateName" />
      </template>
    </Field>

    <Field label="HP 上限">
      <template #default="{ id }">
        <Input :id="id" v-model.number="hp" type="number" min="0" />
      </template>
    </Field>

    <div class="flex items-center gap-2">
      <Checkbox id="agree" v-model="agree" />
      <Label for="agree">同意挨打</Label>
    </div>

    <div class="flex items-center gap-2">
      <Checkbox id="tri" v-model="triState" />
      <Label for="tri">三态:{{ triState }}</Label>
    </div>

    <div class="flex items-center gap-2">
      <Switch id="dark" v-model="darkMode" />
      <Label for="dark">夜间模式({{ darkMode ? '开' : '关' }})</Label>
    </div>

    <div class="flex flex-wrap gap-2">
      <Button size="sm" @click="dialogOpen = true">
        打开 Dialog
      </Button>
      <Button variant="ghost" size="sm">
        幽灵
      </Button>
      <Button variant="danger" size="sm">
        危险
      </Button>
      <Button size="sm" disabled>
        禁用
      </Button>
    </div>

    <Dialog v-model:open="dialogOpen" title="Shadow Portal 测试" description="如果这个弹层样式/层级正常,说明 Portal 正确挂在 Shadow DOM 里。">
      <div class="text-xs text-white/70">
        当前值:
      </div>
      <ul class="text-xs text-white/90 font-mono">
        <li>name = {{ JSON.stringify(name) }}</li>
        <li>hp = {{ hp }}</li>
        <li>agree = {{ agree }}</li>
        <li>triState = {{ JSON.stringify(triState) }}</li>
        <li>darkMode = {{ darkMode }}</li>
      </ul>
      <div class="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" @click="dialogOpen = false">
          取消
        </Button>
        <Button size="sm" @click="dialogOpen = false">
          确定
        </Button>
      </div>
    </Dialog>
  </div>
</template>
