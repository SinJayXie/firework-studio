<template>
  <div class="panel-card">
    <div v-if="title" class="panel-card__header">
      <span class="panel-card__title">
        <MdiIcon v-if="icon" :icon="icon" />
        <span class="panel-card__title-text">{{ title }}</span>
      </span>
      <slot name="actions" />
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import MdiIcon from "./MdiIcon.vue"

defineProps<{
  title?: string
  icon?: string
}>()
</script>

<style scoped lang="scss">
.panel-card {
  display: flex;
  flex-direction: column;
  background: #252526;
  border-radius: 10px;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 12px;
    font-size: 13px;
    color: #ccc;
    border-bottom: 1px solid #3c3c3c;
    flex-shrink: 0;

    :slotted(*) {
      flex-shrink: 0;
    }
  }

  &__title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1;
  }

  &__title-text {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}
</style>
