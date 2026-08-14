import { createI18n } from "vue-i18n"
import zhCN from "./locales/zh-CN"
import en from "./locales/en"

const locale = localStorage.getItem("firework-locale") || "zh-CN"

const i18n = createI18n({
  legacy: false,
  locale,
  fallbackLocale: "zh-CN",
  messages: {
    "zh-CN": zhCN,
    en,
  },
})

export default i18n
export type Locale = "zh-CN" | "en"
