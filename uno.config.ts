import { defineConfig, presetIcons, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [
    presetWind3(),
    presetIcons({
      scale: 1.2,
      collections: {
        lucide: () => import('@iconify-json/lucide/icons.json').then(i => i.default),
        mdi: () => import('@iconify-json/mdi/icons.json').then(i => i.default),
      },
    }),
  ],
  theme: {
    colors: {
      hp: '#e74c3c',
      mp: '#3498db',
      buff: '#f1c40f',
      debuff: '#9b59b6',
      accent: '#4b6ef7e6',
      surface: '#2a2a2a',
      bg: '#1e1e1e',
    },
  },
  shortcuts: {
    card: 'bg-surface rounded p-3',
    chip: 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs',
  },
  // tag 图标通过 :class="tag.icon" 动态绑定;字面量只落在 TS/store 里,
  // 默认 extractor 偶发抓不到(shield 抓到了但 swords 没抓到就是此症),
  // 所以 builtin tag 用到的图标全列 safelist。自定义 tag 的图标也建议列这里。
  safelist: [
    'i-lucide-shield',
    'i-lucide-swords',
    'i-lucide-circle',
    'i-lucide-tag',
    'i-lucide-map-pin',
  ],
})
