<template>
  <div class="input-number" :class="{ 'input-number--disabled': disabled }">
    <input
      ref="inputRef"
      type="text"
      class="input-number__input"
      :value="displayValue"
      :disabled="disabled"
      @blur="onBlur"
      @keydown="onKeydown"
    />
    <div class="input-number__btns">
      <button
        class="input-number__btn"
        :disabled="isUpDisabled"
        @mousedown.prevent="startRepeat('up')"
        @mouseup="stopRepeat"
        @mouseleave="stopRepeat"
      >
        <MdiIcon icon="i-mdi-chevron-up" size="12" />
      </button>
      <button
        class="input-number__btn"
        :disabled="isDownDisabled"
        @mousedown.prevent="startRepeat('down')"
        @mouseup="stopRepeat"
        @mouseleave="stopRepeat"
      >
        <MdiIcon icon="i-mdi-chevron-down" size="12" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from "vue"
import MdiIcon from "./MdiIcon.vue"

const props = withDefaults(defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}>(), {
  step: 1,
  disabled: false,
})

const emit = defineEmits<{
  "update:modelValue": [value: number]
  "change": []
}>()

const inputRef = ref<HTMLInputElement>()

const isUpDisabled = computed(() => {
  if (props.disabled) return true
  if (props.max != null && +props.modelValue >= props.max) return true
  return false
})

const isDownDisabled = computed(() => {
  if (props.disabled) return true
  if (props.min != null && +props.modelValue <= props.min) return true
  return false
})

const displayValue = computed(() => {
  if (props.step > 0 && props.step < 1) return String(props.modelValue)
  return String(Math.round(props.modelValue))
})

let repeatTimer: ReturnType<typeof setInterval> | null = null
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let repeatDir: "up" | "down" | null = null

function clamp(val: number) {
  let result = val
  if (props.min != null) result = Math.max(props.min, result)
  if (props.max != null) result = Math.min(props.max, result)
  return result
}

function apply(v: number) {
  const fixed = precision()
  const rounded = +v.toFixed(fixed)
  const clamped = clamp(rounded)
  emit("update:modelValue", clamped)
}

function precision() {
  const stepStr = String(props.step)
  const dot = stepStr.indexOf(".")
  return dot === -1 ? 0 : stepStr.length - dot - 1
}

function stepOnce(dir: "up" | "down") {
  if (dir === "up") apply(+props.modelValue + props.step)
  else apply(+props.modelValue - props.step)
  emitChange()
}

function emitChange() {
  emit("change")
}

function onBlur() {
  const raw = inputRef.value?.value?.trim() ?? ""
  if (raw === "") {
    if (inputRef.value) inputRef.value.value = String(props.modelValue)
    return
  }
  const num = parseFloat(raw)
  if (!isNaN(num)) {
    apply(num)
    emitChange()
  } else {
    if (inputRef.value) inputRef.value.value = String(props.modelValue)
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "ArrowUp") {
    e.preventDefault()
    if (!isUpDisabled.value) stepOnce("up")
  } else if (e.key === "ArrowDown") {
    e.preventDefault()
    if (!isDownDisabled.value) stepOnce("down")
  }
}

function startRepeat(dir: "up" | "down") {
  const isDisabled = dir === "up" ? isUpDisabled.value : isDownDisabled.value
  if (isDisabled) return

  repeatDir = dir

  longPressTimer = setTimeout(() => {
    longPressTimer = null
    stepOnce(dir)
    repeatTimer = setInterval(() => {
      const disabledNow = dir === "up" ? isUpDisabled.value : isDownDisabled.value
      if (disabledNow) { stopRepeat(); return }
      stepOnce(dir)
    }, 60)
  }, 200)
}

function stopRepeat() {
  // 还没到长按 → 单次点击
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
    if (repeatDir) stepOnce(repeatDir)
    repeatDir = null
    return
  }
  // 已在连发中
  if (repeatTimer) {
    clearInterval(repeatTimer)
    repeatTimer = null
    repeatDir = null
  }
}

onBeforeUnmount(() => {
  stopRepeat()
})
</script>

<style scoped lang="scss">
.input-number {
  display: flex;
  align-items: stretch;
  background: #3c3c3c;
  border: 1px solid #454545;
  border-radius: 4px;
  overflow: hidden;
  transition: border-color 0.15s;
  height: 32px;

  &:focus-within {
    border-color: #0e639c;
  }

  &--disabled {
    opacity: 0.45;
    pointer-events: none;
  }

  &__input {
    flex: 1;
    min-width: 0;
    width: 100%;
    padding: 0 10px;
    font-size: 13px;
    font-family: "Consolas", "Courier New", monospace;
    color: #d4d4d4;
    background: transparent;
    border: none;
    outline: none;

    &::selection {
      background: #0e639c;
    }
  }

  &__btns {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    border-left: 1px solid #454545;
  }

  &__btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 14px;
    padding: 0;
    background: transparent;
    border: none;
    color: #999;
    cursor: pointer;
    transition: all 0.1s;

    &:hover:not(:disabled) {
      color: #fff;
      background: rgba(255, 255, 255, 0.08);
    }

    &:active:not(:disabled) {
      color: #0e639c;
    }

    &:disabled {
      color: #555;
      cursor: not-allowed;
    }
  }
}
</style>
