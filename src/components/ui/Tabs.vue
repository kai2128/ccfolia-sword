<script setup lang="ts">
// Reka Tabs 的 shadcn 风格封装。用 slots 把 List/Trigger/Content 直接透出,
// 这样 PanelShell 这种需要自定义横条的地方不用另造一套。
import { TabsContent, TabsIndicator, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

const model = defineModel<string>()
</script>

<template>
  <TabsRoot v-model="model" class="flex flex-1 flex-col min-h-0">
    <slot />
  </TabsRoot>
</template>

<script lang="ts">
// 再导出 reka 原语,让调用方可以直接 <Tabs.List> / <Tabs.Trigger> 之类
export { TabsContent, TabsIndicator, TabsList, TabsRoot, TabsTrigger }
</script>
