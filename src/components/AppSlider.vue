<template>
  <div class="ios-slider">
    <div class="ios-slider__head">
      <span class="ios-slider__label">{{ label }}</span>
      <span class="ios-slider__value">{{ displayValue }}{{ suffix }}</span>
    </div>
    <input
      type="range"
      class="ios-slider__input"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :style="trackStyle"
      @input="$emit('update:modelValue', +($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"

const props = withDefaults(defineProps<{
  label?: string
  modelValue: number
  min: number
  max: number
  step?: number
  suffix?: string
}>(), {
  step: 1,
  suffix: "",
})

defineEmits<{
  "update:modelValue": [value: number]
}>()

const displayValue = computed(() => {
  if (props.step < 1) return props.modelValue.toFixed(1)
  return String(Math.round(props.modelValue))
})

const trackStyle = computed(() => {
  const pct = ((props.modelValue - props.min) / (props.max - props.min)) * 100
  return { "--pct": `${Math.max(0, Math.min(100, pct))}%` } as Record<string, string>
})
</script>

<style scoped lang="scss">
.ios-slider {
  width: 100%;
  padding: 8px 16px 12px;

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  &__label {
    font-size: 15px;
    color: var(--ios-label-primary);
    letter-spacing: var(--letter-spacing);
  }

  &__value {
    font-size: 13px;
    font-weight: 600;
    color: var(--ios-tint);
    font-variant-numeric: tabular-nums;
  }

  &__input {
    width: 100%;
    height: 4px;
    appearance: none;
    -webkit-appearance: none;
    border-radius: 2px;
    background: linear-gradient(to right, var(--ios-tint) var(--pct), var(--ios-bg-quaternary) var(--pct));
    outline: none;
    cursor: pointer;

    &::-webkit-slider-thumb {
      appearance: none;
      -webkit-appearance: none;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #fff;
      box-shadow:
        0 2px 6px rgba(0, 0, 0, 0.2),
        0 0 0 1px rgba(0, 0, 0, 0.04);
      cursor: grab;

      &:active {
        cursor: grabbing;
      }
    }

    &::-moz-range-thumb {
      width: 22px;
      height: 22px;
      border: none;
      border-radius: 50%;
      background: #fff;
      box-shadow:
        0 2px 6px rgba(0, 0, 0, 0.2),
        0 0 0 1px rgba(0, 0, 0, 0.04);
      cursor: grab;
    }
  }
}
</style>
