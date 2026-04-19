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
      accent: '#2ecc71',
      surface: '#2a2a2a',
      bg: '#1e1e1e',
    },
  },
  shortcuts: {
    card: 'bg-surface rounded p-3',
    chip: 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs',
  },
})
