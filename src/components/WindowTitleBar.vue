<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue"
import { useI18n } from "vue-i18n"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { useRouter } from "vue-router"

const { t } = useI18n()

const isMaximized = ref(false)
const transparent = ref(false)
const snapActive = ref(false)
let unlisten: (() => void) | undefined
const router = useRouter()


watch(() => router.currentRoute.value.path, (path) => {
  transparent.value = path === "/"
}, { immediate: true })


async function minimize() {
  try { await getCurrentWindow().minimize() } catch { /* ignore */ }
}
async function closeWindow() {
  try { await getCurrentWindow().close() } catch { /* ignore */ }
}

function syncMaximized() {
  getCurrentWindow().isMaximized().then(v => isMaximized.value = v)
}

function onMouseDown(e: MouseEvent) {
  if ((e.target as HTMLElement).id === "snap-btn") {
    snapActive.value = true
  }
}
function onMouseUp() {
  snapActive.value = false
}

onMounted(async () => {
  syncMaximized()
  unlisten = await getCurrentWindow().onResized(() => syncMaximized())
  window.addEventListener("mousedown", onMouseDown)
  window.addEventListener("mouseup", onMouseUp)
})

onUnmounted(() => {
  unlisten?.()
  window.removeEventListener("mousedown", onMouseDown)
  window.removeEventListener("mouseup", onMouseUp)
})
</script>

<template>
  <div class="win-title" :class="{ 'transparent': transparent }">
    <div class="win-title__left">
      <img class="win-title__left--logo"  src="../assets/images/32x32.png" alt="logo" />
      {{ t("window.title") }}
    </div>

    <div class="win-title__btns">
      <button class="win-title__btn win-title__btn--min" :title="t('window.minimize')" @click="minimize" />
      <button
        id="snap-btn"
        class="win-title__btn"
        :class="[
          { 'win-title__btn--active': snapActive },
          isMaximized ? 'win-title__btn--restore' : 'win-title__btn--max',
        ]"
        :title="isMaximized ? t('window.restore') : t('window.maximize')"
      />
      <button class="win-title__btn win-title__btn--close" :title="t('window.close')" @click="closeWindow" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.win-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  flex-shrink: 0;
  user-select: none;
  z-index: 100000;
  background: var(--ios-bg-secondary);

  &.transparent {
    background: transparent;
  }

  &__left {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-left: 12px;
    font-size: 12px;
    font-weight: 600;
    color: var(--ios-label-secondary);
    flex: 1;
    -webkit-app-region: drag;
    height: 100%;
    &--logo {
      width: 16px;
      height: 16px;
    }
  }

  &__btns {
    display: flex;
    height: 100%;
    flex-shrink: 0;
    -webkit-app-region: no-drag;
  }

  &__btn {
    -webkit-app-region: no-drag;
    width: 44px;
    height: 100%;
    border: none;
    background: transparent;
    color: var(--ios-label-secondary);
    cursor: default;
    display: flex;
    align-items: center;
    justify-content: center;
    outline: none;
    transition: background 0.1s;
    font-family: "Segoe Fluent Icons", "Segoe MDL2 Assets", sans-serif;
    font-size: 10px;
    text-rendering: geometricPrecision;
    -webkit-font-smoothing: antialiased;

    &::before {
      display: block;
      line-height: 1;
    }

    &--min::before { content: "\E921"; }
    &--max::before { content: "\E922"; }
    &--restore::before { content: "\E923"; }
    &--close::before { content: "\E8BB"; }

    &--min:hover {
      background: var(--ios-fill-primary);
      color: var(--ios-label-primary);
    }

    &--close:hover {
      background: var(--ios-red);
      color: #fff;
    }

    &#snap-btn.is-hovered {
      background: var(--ios-fill-primary);
      color: var(--ios-label-primary);
    }

    &--active {
      background: var(--ios-fill-secondary);
    }
  }
}
</style>
