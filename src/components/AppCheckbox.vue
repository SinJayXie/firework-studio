<template>
  <label
    :class="['app-checkbox', { 'app-checkbox--disabled': disabled }]"
    @click.prevent="onClick"
  >
    <input
      tabindex="-1"
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      class="app-checkbox__input sr-only"
    />
    <span class="app-checkbox__box">
      <MdiIcon v-if="modelValue" icon="i-mdi-check" size="14" />
    </span>
    <span v-if="$slots.default" class="app-checkbox__label"><slot /></span>
  </label>
</template>

<script setup lang="ts">
import MdiIcon from "./MdiIcon.vue"

const props = defineProps<{
  modelValue: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  "update:modelValue": [value: boolean]
}>()

function onClick() {
  if (props.disabled) return
  emit("update:modelValue", !props.modelValue)
}
</script>

<style scoped lang="scss">
.app-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  user-select: none;

  &--disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  &__box {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 3px;
    border: 1.5px solid #555;
    background: #2d2d2d;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  &__input:checked + &__box {
    background: #0e639c;
    border-color: #0e639c;
  }

  &__input {
    pointer-events: none;
  }

  &__label {
    font-size: 12px;
    color: #ccc;
  }

  &:hover &__box {
    border-color: #777;
  }

  &:hover &__input:checked + &__box {
    border-color: #1177bb;
  }
}
</style>
