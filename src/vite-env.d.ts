/// <reference types="vite/client" />
/// <reference types="vite-plugin-monkey/client" />
/// <reference types="vite-plugin-monkey/global" />
/// <reference types="@types/tampermonkey" />
/// <reference types="unocss/reset" />

declare module 'virtual:uno.css?inline' {
  const css: string
  export default css
}
