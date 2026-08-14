<template>
  <div :class="['control-bar', { 'control-bar--hidden': hidden }]">
    <AppButton variant="control" @click="$emit('toggle-pause')">
      <AppIcon :name="paused ? 'play' : 'pause'" :size="22" />
    </AppButton>
    <AppButton variant="control" @click="$emit('toggle-menu')">
      <AppIcon name="settings" :size="22" />
    </AppButton>
  </div>
</template>

<script setup lang="ts">
import AppButton from "../components/AppButton.vue"
import AppIcon from "../components/AppIcon.vue"

defineProps<{
  paused: boolean
  hidden: boolean
}>()

defineEmits<{
  "toggle-pause": []
  "toggle-menu": []
}>()
</script>

<style scoped lang="scss">
.control-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 4px 6px;
  transition: opacity 0.3s;
  z-index: 10;
  pointer-events: none;

  > * {
    pointer-events: auto;
  }

  &--hidden {
    opacity: 0;

    &:hover {
      opacity: 1;
    }
  }
}
</style>
