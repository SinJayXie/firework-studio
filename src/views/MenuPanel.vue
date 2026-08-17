<template>
  <AppDialog :show="open" :title="t('menu.title')" width="500px" max-height="76vh" @close="$emit('close')">
    <div class="ios-settings">
      <!-- 烟花 -->
      <div class="ios-settings__section">
        <div class="ios-settings__section-title">{{ t('menu.sectionFirework') }}</div>
        <div class="ios-settings__group">
          <AppSelect
            :label="t('menu.shellType')"
            :model-value="config.shell"
            :groups="shellGroups"
            @update:model-value="$emit('update:config', { shell: $event })"
          />
          <AppSelect
            :label="t('menu.shellSize')"
            :model-value="config.size"
            :options="sizeOptions"
            @update:model-value="$emit('update:config', { size: $event })"
          />
        </div>
      </div>

      <!-- 显示 -->
      <div class="ios-settings__section">
        <div class="ios-settings__section-title">{{ t('menu.sectionDisplay') }}</div>
        <div class="ios-settings__group">
          <AppSelect
            :label="t('menu.quality')"
            :model-value="config.quality"
            :options="qualityOptions"
            @update:model-value="$emit('update:config', { quality: $event })"
          />
          <AppSelect
            :label="t('menu.skyLighting')"
            :model-value="config.skyLighting"
            :options="skyLightingOptions"
            @update:model-value="$emit('update:config', { skyLighting: $event })"
          />
          <AppSelect
            :label="t('menu.scale')"
            :model-value="String(config.scaleFactor)"
            :options="scaleFactorOptions"
            @update:model-value="$emit('update:config', { scaleFactor: +$event })"
          />
          <AppSelect
            :label="t('menu.renderer')"
            :model-value="config.renderer"
            :options="rendererOptions"
            @update:model-value="$emit('update:config', { renderer: ($event as 'webgl' | 'canvas2d') })"
          />
          <AppSelect
            :label="t('menu.fps')"
            :model-value="String(config.fps)"
            :options="fpsOptions"
            @update:model-value="$emit('update:config', { fps: +$event })"
          />
          <AppSelect
            :label="t('menu.speed')"
            :model-value="String(config.speed)"
            :options="speedOptions"
            @update:model-value="$emit('update:config', { speed: +$event })"
          />
        </div>
      </div>

      <!-- 行为 -->
      <div class="ios-settings__section">
        <div class="ios-settings__section-title">{{ t('menu.sectionBehavior') }}</div>
        <div class="ios-settings__group">
          <AppSwitch
            :label="t('menu.autoLaunch')"
            :model-value="config.autoLaunch"
            @update:model-value="$emit('update:config', { autoLaunch: $event })"
          />
          <AppSwitch
            :label="t('menu.finaleMode')"
            :model-value="config.finale"
            @update:model-value="$emit('update:config', { finale: $event })"
          />
          <div class="ios-settings__row">
            <span class="ios-settings__row-label">{{ t('menu.launchPlanEntry') }}</span>
            <AppButton variant="link" @click="launchPlanOpen = true">{{ t('menu.launchPlanConfigure') }}</AppButton>
          </div>
        </div>
      </div>

      <!-- 界面 -->
      <div class="ios-settings__section">
        <div class="ios-settings__section-title">{{ t('menu.sectionInterface') }}</div>
        <div class="ios-settings__group">
          <AppSwitch
            :label="t('menu.hideControls')"
            :model-value="config.hideControls"
            @update:model-value="$emit('update:config', { hideControls: $event })"
          />
          <AppSwitch
            :label="t('menu.fullscreen')"
            :model-value="fullscreen"
            @update:model-value="$emit('toggle-fullscreen')"
          />
          <AppSwitch
            :label="t('menu.longExposure')"
            :model-value="config.longExposure"
            @update:model-value="$emit('update:config', { longExposure: $event })"
          />
          <AppSwitch
            :label="t('menu.debug')"
            :model-value="config.debug"
            @update:model-value="$emit('update:config', { debug: $event })"
          />
        </div>
      </div>

      <!-- 脚本 -->
      <div class="ios-settings__section">
        <div class="ios-settings__section-title">{{ t('menu.sectionScript') }}</div>
        <div class="ios-settings__group">
          <div class="ios-settings__row">
            <span class="ios-settings__row-label">{{ t('menu.loadScript') }}</span>
            <AppButton variant="link" @click="pickFile">{{ t('menu.selectFile') }}</AppButton>
          </div>
          <div class="ios-settings__row">
            <span class="ios-settings__row-label">{{ t('menu.editScript') }}</span>
            <AppButton variant="link" @click="goEditor">{{ t('menu.openEditor') }}</AppButton>
          </div>
        </div>
      </div>

      <!-- 通用 -->
      <div class="ios-settings__section">
        <div class="ios-settings__section-title">{{ t('menu.sectionGeneral') }}</div>
        <div class="ios-settings__group">
          <AppSelect
            :label="t('settings.language')"
            :model-value="locale"
            :options="localeOptions"
            @update:model-value="changeLocale"
          />
        </div>
      </div>
    </div>
  </AppDialog>

  <LaunchPlanDialog
    :show="launchPlanOpen"
    :model-value="config.launchPlan"
    @update:model-value="$emit('update:config', { launchPlan: $event })"
    @close="launchPlanOpen = false"
  />
</template>

<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useRouter } from "vue-router"
import AppDialog from "../components/AppDialog.vue"
import AppSelect from "../components/AppSelect.vue"
import AppSwitch from "../components/AppSwitch.vue"
import AppButton from "../components/AppButton.vue"
import LaunchPlanDialog from "../components/LaunchPlanDialog.vue"
import {
  shellNames, shellNameMap,
  QUALITY_LOW, QUALITY_NORMAL, QUALITY_HIGH,
  SKY_LIGHT_NONE, SKY_LIGHT_DIM, SKY_LIGHT_NORMAL,
} from "../libs/firework-engine"
import type { EngineConfig } from "../libs/firework-engine"

const props = defineProps<{
  open: boolean
  config: EngineConfig
  fullscreen: boolean
  shellRefreshKey: number
  customShells: string[]
}>()

const { t, locale } = useI18n({ useScope: "global" })

const localeOptions = [
  { label: "中文", value: "zh-CN" },
  { label: "English", value: "en" },
]

function changeLocale(lang: string) {
  locale.value = lang as "zh-CN" | "en"
  localStorage.setItem("firework-locale", lang)
}

const emit = defineEmits<{
  "update:config": [partial: Partial<EngineConfig>]
  "toggle-fullscreen": []
  "load-shell-file": [file: File | undefined]
  close: []
}>()

const launchPlanOpen = ref(false)

const shellGroups = computed(() => {
  void props.shellRefreshKey
  const customSet = new Set(props.customShells)
  const builtin: { label: string; value: string }[] = []
  const custom: { label: string; value: string }[] = []
  for (const n of shellNames) {
    const opt = { label: shellNameMap[n] || n, value: n }
    if (customSet.has(n)) custom.push(opt)
    else builtin.push(opt)
  }
  const groups: { label: string; options: { label: string; value: string }[] }[] = []
  if (builtin.length) groups.push({ label: t("menu.builtin"), options: builtin })
  if (custom.length) groups.push({ label: t("menu.custom"), options: custom })
  return groups
})

const sizeOptions = [
  { label: '3"', value: "0" }, { label: '4"', value: "1" },
  { label: '6"', value: "2" }, { label: '8"', value: "3" },
  { label: '12"', value: "4" }, { label: '16"', value: "5" },
]

const qualityOptions = computed(() => [
  { label: t("menu.qualityOptions.low"), value: String(QUALITY_LOW) },
  { label: t("menu.qualityOptions.normal"), value: String(QUALITY_NORMAL) },
  { label: t("menu.qualityOptions.high"), value: String(QUALITY_HIGH) },
])

const skyLightingOptions = computed(() => [
  { label: t("menu.skyLightingOptions.off"), value: String(SKY_LIGHT_NONE) },
  { label: t("menu.skyLightingOptions.dim"), value: String(SKY_LIGHT_DIM) },
  { label: t("menu.skyLightingOptions.normal"), value: String(SKY_LIGHT_NORMAL) },
])

const scaleFactorOptions = [0.5, 0.62, 0.75, 0.9, 1.0, 1.5, 2.0]
  .map(v => ({ label: `${v * 100}%`, value: v.toFixed(2) }))

const rendererOptions = [
  { label: "WebGL", value: "webgl" },
  { label: "Canvas2D", value: "canvas2d" },
]

const fpsOptions = [15, 30, 60, 90, 120, 180]
  .map(v => ({ label: `${v} FPS`, value: String(v) }))

const speedOptions = [0.25, 0.5, 0.75, 1]
  .map(v => ({ label: `${v}x`, value: String(v) }))

const router = useRouter()

function goEditor() {
  router.push("/editor")
}

function pickFile() {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = ".shell"
  input.onchange = () => {
    const file = input.files?.[0]
    if (file) emit("load-shell-file", file)
    input.remove()
  }
  input.click()
}
</script>

<style scoped lang="scss">
.ios-settings {
  width: 100%;

  &__section {
    margin-bottom: 20px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  &__section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--ios-label-secondary);
    letter-spacing: var(--letter-spacing);
    text-transform: uppercase;
    padding: 0 4px;
    margin-bottom: 8px;
  }

  &__group {
    background: var(--ios-fill-secondary);
    border-radius: var(--ios-radius);
    overflow: hidden;

    :deep(.ios-select),
    :deep(.ios-toggle),
    > .ios-settings__row {
      &:not(:last-child) {
        border-bottom: 1px solid var(--ios-separator);
      }
    }
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 44px;
    padding: 0 16px;
  }

  &__row-label {
    font-size: 17px;
    color: var(--ios-label-primary);
    letter-spacing: var(--letter-spacing);
  }
}
</style>
