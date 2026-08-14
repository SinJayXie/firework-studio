<template>
  <button
    :class="['tool-btn', `tool-btn--${variant}`]"
    :disabled="disabled"
    :title="title"
    @click="$emit('click')"
  >
    <MdiIcon v-if="icon" :icon="icon" :size="size" />
    <span v-if="$slots.default"><slot /></span>
  </button>
</template>

<script setup lang="ts">
import MdiIcon from "./MdiIcon.vue"

withDefaults(
  defineProps<{
    icon?: string
    variant?: "ghost" | "primary" | "danger"
    disabled?: boolean
    title?: string
    size?: number | string
  }>(),
  {
    variant: "ghost",
    disabled: false,
  },
)

defineEmits<{
  click: []
}>()
</script>

<style scoped lang="scss">
.tool-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  font-size: 12px;
  font-family: inherit;
  letter-spacing: var(--letter-spacing);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &__icon {
    font-size: 14px;
  }

  &--ghost {
    background: #3c3c3c;
    color: #ccc;

    &:hover:not(:disabled) {
      background: #505050;
    }
  }

  &--primary {
    background: #0e639c;
    color: #fff;

    &:hover:not(:disabled) {
      background: #1177bb;
    }
  }

  &--danger {
    background: transparent;
    color: #888;

    &:hover:not(:disabled) {
      background: #3c3c3c;
      color: #ccc;
    }
  }
}
</style>
