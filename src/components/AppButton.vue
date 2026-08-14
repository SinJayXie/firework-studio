<template>
  <button
    :class="['ios-btn', `ios-btn--${variant}`]"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: "primary" | "ghost" | "control" | "link"
  disabled?: boolean
}>(), {
  variant: "ghost",
  disabled: false,
})

defineEmits<{
  click: []
}>()
</script>

<style scoped lang="scss">
.ios-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: none;
  font-family: inherit;
  font-size: 17px;
  letter-spacing: var(--letter-spacing);
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
  outline: none;
  border-radius: var(--ios-radius);

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.ios-btn--ghost {
  background: var(--ios-bg-tertiary);
  color: var(--ios-tint);
  padding: 8px 20px;

  &:hover:not(:disabled) {
    background: var(--ios-bg-quaternary);
  }
}

.ios-btn--primary {
  background: var(--ios-tint);
  color: #fff;
  padding: 10px 24px;
  font-weight: 600;

  &:hover:not(:disabled) {
    background: #1a8fff;
  }
}

.ios-btn--control {
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: saturate(180%) blur(10px);
  -webkit-backdrop-filter: saturate(180%) blur(10px);
  border: 1px solid var(--ios-glass-border);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  padding: 0;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
  }
}

.ios-btn--link {
  background: transparent;
  color: var(--ios-tint);
  padding: 0;
  border-radius: 0;
  font-size: 17px;

  &:hover:not(:disabled) {
    opacity: 0.7;
  }
}
</style>
