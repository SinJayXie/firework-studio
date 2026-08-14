<template>
  <label class="ios-toggle" :class="{ 'ios-toggle--on': modelValue }">
    <span class="ios-toggle__track">
      <span class="ios-toggle__thumb" />
    </span>
    <span v-if="label" class="ios-toggle__label">{{ label }}</span>
    <input
      type="checkbox"
      :checked="modelValue"
      class="ios-toggle__input"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
  </label>
</template>

<script setup lang="ts">
defineProps<{
  label?: string
  modelValue: boolean
}>()

defineEmits<{
  "update:modelValue": [value: boolean]
}>()
</script>

<style scoped lang="scss">
.ios-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 44px;
  padding: 0 16px;
  cursor: pointer;
  transition: background 0.15s;

  &:active {
    background: var(--ios-fill-tertiary);
  }

  &__track {
    order: 1;
    position: relative;
    width: 51px;
    height: 31px;
    border-radius: 16px;
    background: var(--ios-bg-quaternary);
    transition: background 0.25s ease;
    flex-shrink: 0;
  }

  &__thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 27px;
    height: 27px;
    border-radius: 50%;
    background: #fff;
    box-shadow:
      0 3px 8px rgba(0, 0, 0, 0.15),
      0 1px 1px rgba(0, 0, 0, 0.06),
      0 0 0 1px rgba(0, 0, 0, 0.04);
    transition: transform 0.25s cubic-bezier(0.2, 0.85, 0.32, 1.2);
  }

  &--on {
    .ios-toggle__track {
      background: var(--ios-green);
    }

    .ios-toggle__thumb {
      transform: translateX(20px);
    }
  }

  &__label {
    font-size: 17px;
    color: var(--ios-label-primary);
    letter-spacing: var(--letter-spacing);
  }

  &__input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }
}
</style>
