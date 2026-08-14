<template>
  <div :class="[variant === 'dark' ? 'dark-select' : 'ios-select']" ref="rootRef">
    <button :class="[variant === 'dark' ? 'dark-select__trigger' : 'ios-select__trigger']" @click="toggle">
      <span :class="[variant === 'dark' ? 'dark-select__label' : 'ios-select__label']">{{ label }}</span>
      <span :class="[variant === 'dark' ? 'dark-select__value' : 'ios-select__value']">{{ selectedLabel }}</span>
      <svg :class="[variant === 'dark' ? 'dark-select__chevron' : 'ios-select__chevron', { 'dark-select__chevron--open': open, 'ios-select__chevron--open': open }]" width="12" height="8" viewBox="0 0 12 8">
        <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <teleport to="body">
      <transition name="select-popover">
        <div v-if="open" class="ios-select__overlay" @click="open = false" />
      </transition>
      <transition name="select-popover">
        <div v-if="open" :class="[variant === 'dark' ? 'dark-select__popover' : 'ios-select__popover glass-heavy']" :style="popoverStyle">
          <!-- grouped mode -->
          <template v-if="groups">
            <div v-for="(group, gi) in groups" :key="gi">
              <div v-if="group.label" :class="[variant === 'dark' ? 'dark-select__group-header' : 'ios-select__group-header']">{{ group.label }}</div>
              <div
                v-for="opt in group.options"
                :key="opt.value"
                :class="[variant === 'dark' ? 'dark-select__option' : 'ios-select__option', { 'dark-select__option--active': modelValue === opt.value && variant === 'dark', 'ios-select__option--active': modelValue === opt.value && variant !== 'dark' }]"
                @click="select(opt.value)"
              >
                <span>{{ opt.label }}</span>
                <svg v-if="modelValue === opt.value" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8.5L6.5 12L13 5" :stroke="variant === 'dark' ? '#0e639c' : 'var(--ios-tint)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </div>
              <div v-if="gi < groups.length - 1" :class="[variant === 'dark' ? 'dark-select__divider' : 'ios-select__divider']" />
            </div>
          </template>
          <!-- flat mode -->
          <template v-else>
            <div
              v-for="opt in options"
              :key="opt.value"
              :class="[variant === 'dark' ? 'dark-select__option' : 'ios-select__option', { 'dark-select__option--active': modelValue === opt.value && variant === 'dark', 'ios-select__option--active': modelValue === opt.value && variant !== 'dark' }]"
              @click="select(opt.value)"
            >
              <span>{{ opt.label }}</span>
              <svg v-if="modelValue === opt.value" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8.5L6.5 12L13 5" :stroke="variant === 'dark' ? '#0e639c' : 'var(--ios-tint)'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
          </template>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from "vue"

const props = defineProps<{
  label?: string
  modelValue: string
  options?: { label: string; value: string }[]
  groups?: { label: string; options: { label: string; value: string }[] }[]
  variant?: "ios" | "dark"
}>()

const emit = defineEmits<{
  "update:modelValue": [value: string]
}>()

const open = ref(false)
const rootRef = ref<HTMLElement>()
const popoverStyle = ref<Record<string, string>>({})

const selectedLabel = computed(() => {
  const all = props.options ?? (props.groups?.flatMap(g => g.options) ?? [])
  return all.find(o => o.value === props.modelValue)?.label ?? props.modelValue
})

function toggle() {
  open.value = !open.value
  if (open.value) {
    nextTick(updatePosition)
  }
}

function select(value: string) {
  open.value = false
  emit("update:modelValue", value)
}

function updatePosition() {
  if (!rootRef.value) return
  const rect = rootRef.value.getBoundingClientRect()
  const popoverHeight = 280 // max-height of popover
  const popoverWidth = Math.max(rect.width, 180)
  const gap = 4

  // 垂直方向：放得下就往下，放不下往上
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top
  const showBelow = spaceBelow >= popoverHeight

  // 水平方向：如果右侧空间不足，靠右对齐
  const spaceRight = window.innerWidth - rect.left
  const showRight = spaceRight >= popoverWidth

  const style: Record<string, string> = {
    position: "fixed",
    minWidth: `${popoverWidth}px`,
    maxHeight: `${Math.min(popoverHeight, (showBelow ? spaceBelow : spaceAbove) - gap)}px`,
  }

  if (showBelow) {
    style.top = `${rect.bottom + gap}px`
  } else {
    style.bottom = `${window.innerHeight - rect.top + gap}px`
  }

  if (showRight) {
    style.left = `${rect.left}px`
  } else {
    style.right = `${window.innerWidth - rect.right}px`
  }

  popoverStyle.value = style
}

function onWindowKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && open.value) {
    open.value = false
  }
}

watch(open, (val) => {
  if (val) {
    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, true)
    nextTick(updatePosition)
  } else {
    window.removeEventListener("resize", updatePosition)
    window.removeEventListener("scroll", updatePosition, true)
  }
})

onMounted(() => {
  window.addEventListener("keydown", onWindowKeydown)
})

onUnmounted(() => {
  window.removeEventListener("keydown", onWindowKeydown)
  window.removeEventListener("resize", updatePosition)
  window.removeEventListener("scroll", updatePosition, true)
})
</script>

<style scoped lang="scss">
.ios-select {
  position: relative;
  width: 100%;
  min-height: 44px;

  &__trigger {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 44px;
    padding: 0 16px;
    background: transparent;
    border: none;
    font-family: inherit;
    font-size: 17px;
    letter-spacing: var(--letter-spacing);
    color: var(--ios-label-primary);
    cursor: pointer;
    transition: background 0.15s;

    &:active {
      background: var(--ios-fill-tertiary);
    }
  }

  &__label {
    color: var(--ios-label-primary);
    flex-shrink: 0;
  }

  &__value {
    margin-left: auto;
    color: var(--ios-tint);
    text-align: right;
  }

  &__chevron {
    margin-left: 6px;
    color: var(--ios-tint);
    flex-shrink: 0;
    transition: transform 0.2s ease;

    &--open {
      transform: rotate(180deg);
    }
  }

  &__overlay {
    position: fixed;
    inset: 0;
    z-index: 150;
  }

  &__popover {
    z-index: 160;
    border-radius: var(--ios-radius);
    overflow: hidden;
    padding: 4px 0;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
    max-height: 320px;
    overflow-y: auto;
  }

  &__group-header {
    padding: 6px 16px 4px;
    font-size: 13px;
    font-weight: 600;
    color: var(--ios-label-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  &__divider {
    height: 1px;
    margin: 4px 12px;
    background: var(--ios-separator);
  }

  &__option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    min-height: 44px;
    font-size: 17px;
    letter-spacing: var(--letter-spacing);
    color: var(--ios-label-primary);
    cursor: pointer;
    transition: background 0.15s;
    gap: 10px;

    &:hover {
      background: var(--ios-fill-primary);
    }

    &:active {
      background: var(--ios-fill-secondary);
    }

    &--active {
      color: var(--ios-tint);
    }
  }
}

.select-popover-enter-active,
.select-popover-leave-active {
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.2, 0.8, 0.4, 1);
}

.select-popover-enter-from,
.select-popover-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}

// ── Dark variant (for editor/designer) ──
.dark-select {
  position: relative;
  width: 100%;

  &__trigger {
    display: flex;
    align-items: center;
    width: 100%;
    height: 32px;
    padding: 0 10px;
    background: #3c3c3c;
    border: 1px solid #454545;
    border-radius: 4px;
    font-family: inherit;
    font-size: 13px;
    color: #d4d4d4;
    cursor: pointer;
    transition: border-color 0.15s;

    &:hover { border-color: #555; }
    &:focus { border-color: #0e639c; outline: none; }
  }

  &__label {
    color: #888;
    flex-shrink: 0;
    margin-right: 8px;
  }

  &__value {
    flex: 1;
    color: #d4d4d4;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__chevron {
    margin-left: 6px;
    color: #888;
    flex-shrink: 0;
    transition: transform 0.2s ease;

    &--open {
      transform: rotate(180deg);
      color: #aaa;
    }
  }

  &__popover {
    z-index: 160;
    border-radius: 6px;
    overflow: hidden;
    padding: 4px 0;
    background: #2d2d2d;
    border: 1px solid #454545;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    max-height: 280px;
    overflow-y: auto;
  }

  &__group-header {
    padding: 4px 12px 2px;
    font-size: 11px;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  &__divider {
    height: 1px;
    margin: 2px 8px;
    background: #3c3c3c;
  }

  &__option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    min-height: 30px;
    font-size: 13px;
    color: #ccc;
    cursor: pointer;
    transition: background 0.1s;
    gap: 10px;

    &:hover {
      background: #3c3c3c;
    }

    &:active {
      background: #454545;
    }

    &--active {
      color: #4fc1ff;
      background: rgba(14, 99, 156, 0.15);
    }
  }
}
</style>
