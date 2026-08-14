import { defineConfig, presetIcons, presetUno } from "unocss"

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({
      scale: 1.2,
      extraProperties: {
        display: "inline-block",
        "vertical-align": "middle",
      },
    }),
  ],
  shortcuts: {
    "btn-base":
      "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md cursor-pointer border-none transition-colors duration-150",
    "btn-ghost": "btn-base bg-transparent text-[#ccc] hover:bg-[#3c3c3c]",
    "btn-primary": "btn-base bg-[#0e639c] text-white hover:bg-[#1177bb]",
    "btn-danger": "btn-base bg-transparent text-[#888] hover:bg-[#3c3c3c] hover:text-[#ccc]",
    "panel-header":
      "flex items-center justify-between px-3 py-2 text-13px text-[#ccc] border-b border-[#3c3c3c] shrink-0",
    "panel-card":
      "flex flex-col bg-[#252526] rounded-10px overflow-hidden",
  },
})
