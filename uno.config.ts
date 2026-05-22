import { defineConfig, presetIcons, presetWebFonts, presetWind3 } from 'unocss'

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
    // Capsule HP/MP 指示器要的字体栈;@font-face 经 cssSideEffects 进 Shadow DOM。
    presetWebFonts({
      provider: 'google',
      fonts: {
        serif: ['Cinzel:400,700', 'Noto Serif SC:600,700'],
        mono: ['JetBrains Mono:700'],
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
      // Capsule 系列 — 单一来源在 src/styles/tokens.css,这里走 var() 引用便于 utility 用。
      capsule: {
        hp: { 1: 'var(--cap-hp-1)', 2: 'var(--cap-hp-2)' },
        mp: { 1: 'var(--cap-mp-1)', 2: 'var(--cap-mp-2)' },
        sp: { 1: 'var(--cap-sp-1)', 2: 'var(--cap-sp-2)' },
        shield: { 1: 'var(--cap-shield-1)', 2: 'var(--cap-shield-2)' },
        danger: { 1: 'var(--cap-danger-1)', 2: 'var(--cap-danger-2)' },
        bg: { top: 'var(--cap-bg-top)', bot: 'var(--cap-bg-bot)' },
        rim: { top: 'var(--cap-rim-top)', mid: 'var(--cap-rim-mid)', bot: 'var(--cap-rim-bot)' },
        name: 'var(--cap-multipart-name)',
        label: 'var(--cap-part-label)',
      },
    },
  },
  shortcuts: {
    card: 'bg-surface rounded p-3',
    chip: 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs',
  },
  // tag / buff 图标通过 :class="icon" 动态绑定,字面量只落在 TS/store/Firestore 里,
  // 默认 extractor 抓不到。builtin 用到的图标全列 safelist;
  // 自定义 buff 的图标也建议补这里(否则只在用户机器上没生成 css)。
  safelist: [
    // tag
    'i-lucide-shield',
    'i-lucide-swords',
    'i-lucide-circle',
    'i-lucide-tag',
    'i-lucide-map-pin',
    // builtin buff
    'i-mdi-star',
    'i-mdi-fire',
    'i-mdi-shield',
    'i-mdi-flash',
    'i-mdi-sleep',
    'i-mdi-ghost',
    'i-mdi-eye-off',
    'i-mdi-heart',
    'i-mdi-heart-broken',
    'i-mdi-cube',
    'i-mdi-biohazard',
    'i-mdi-close-octagon',
    'i-mdi-lightning-bolt',
    'i-mdi-help-circle',
    // 常用候选(GM 现场新建 buff 时常用)
    'i-mdi-snowflake',
    'i-mdi-water',
    'i-mdi-leaf',
    'i-mdi-sword',
    'i-mdi-shield-cross',
    'i-mdi-bandage',
    'i-mdi-skull',
    'i-mdi-spider',
    'i-mdi-pill',
    'i-mdi-flask',
    'i-mdi-magic-staff',
    'i-mdi-meditation',
    'i-mdi-run-fast',
    'i-mdi-shoe-print',
    'i-mdi-eye',
    'i-mdi-ear-hearing',
    'i-mdi-brain',
    'i-mdi-hand-back-right',
    'i-mdi-arm-flex',
    'i-mdi-feather',
    'i-mdi-anchor',
    'i-mdi-chain',
    'i-mdi-lock',
    'i-mdi-bell',
    'i-mdi-alert',
    'i-mdi-plus-circle',
    'i-mdi-minus-circle',
    'i-mdi-arrow-up-bold',
    'i-mdi-arrow-down-bold',
  ],
})
