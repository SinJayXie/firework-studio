<template>
    <i :class="['mdi-icon', icon]" :style="{ '--SIZE': size + 'px' }"></i>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
    icon: string,
    size?: number | string
}>(), {
    size: 16
})
</script>

<style scoped lang="scss">
.mdi-icon {
    display: inline-block;
    width: var(--SIZE, 16px);
    height: var(--SIZE, 16px);
    font-size: var(--SIZE, 16px);
}
</style>
