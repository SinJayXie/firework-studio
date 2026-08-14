<template>
  <teleport to="body">
    <transition name="ios-dialog">
      <div v-if="show" class="ios-dialog-overlay" @click.self="$emit('close')">
        <div class="ios-dialog glass-heavy" :style="getStyle">
          <div v-if="title" class="ios-dialog__header">
            <h2 class="ios-dialog__title">{{ title }}</h2>
          </div>
          <div class="ios-dialog__body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="ios-dialog__footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { computed } from "vue"

const props = withDefaults(defineProps<{
  show: boolean
  title?: string
  width?: number | string,
  maxHeight?: number | string
}>(), {
  width: 400,
})

const getStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  maxHeight: typeof props.maxHeight === 'number' ? `${props.maxHeight}px` : props.maxHeight,
}))

defineEmits<{
  close: []
}>()
</script>

<style scoped lang="scss">
.ios-dialog-overlay {
  display: flex;
  justify-content: center;
  align-items: center;
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(4px) saturate(2);
}

.ios-dialog {
  display: flex;
  flex-direction: column;
  width: calc(100vw - 40px);
  max-height: calc(100vh - 80px);
  border-radius: var(--ios-radius-lg);
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.2);

  &__header {
    padding: 20px 20px 0;
    text-align: center;
  }

  &__title {
    font-size: 18px;
    font-weight: 600;
    color: var(--ios-label-primary);
    letter-spacing: var(--letter-spacing);
    text-transform: uppercase;
  }

  &__body {
    padding: 16px 20px;
    overflow-y: auto;
    flex: 1;
    line-height: 1.6;
    color: var(--ios-label-secondary);
  }

  &__footer {
    display: flex;
    justify-content: center;
    gap: 10px;
    padding: 12px 20px 20px;
  }
}

/* Transitions */
.ios-dialog-enter-active,
.ios-dialog-leave-active {
  transition: opacity 0.3s ease;

  .ios-dialog {
    transition:
      opacity 0.3s ease,
      transform 0.3s cubic-bezier(0.2, 0.8, 0.4, 1);
  }
}

.ios-dialog-enter-from,
.ios-dialog-leave-to {
  opacity: 0;

  .ios-dialog {
    opacity: 0;
    transform: scale(0.92) translateY(20px);
  }
}
</style>
