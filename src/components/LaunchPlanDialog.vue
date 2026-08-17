<template>
  <AppDialog :show="show" :title="t('menu.launchPlanTitle')" width="460px" max-height="80vh" @close="$emit('close')">
    <div class="launch-plan">
      <div class="launch-plan__hint">{{ t('menu.launchPlanHint') }}</div>

      <div class="launch-plan__section-title">{{ t('menu.launchPlanWeights') }}</div>
      <div class="launch-plan__group">
        <AppSlider
          :label="t('menu.launchPlanSingle')"
          :model-value="local.single" :min="0" :max="100"
          @update:model-value="local.single = $event"
        />
        <AppSlider
          :label="t('menu.launchPlanDouble')"
          :model-value="local.double" :min="0" :max="100"
          @update:model-value="local.double = $event"
        />
        <AppSlider
          :label="t('menu.launchPlanTriple')"
          :model-value="local.triple" :min="0" :max="100"
          @update:model-value="local.triple = $event"
        />
        <AppSlider
          :label="t('menu.launchPlanPyramid')"
          :model-value="local.pyramid" :min="0" :max="100"
          @update:model-value="local.pyramid = $event"
        />
        <AppSlider
          :label="t('menu.launchPlanBarrage')"
          :model-value="local.barrage" :min="0" :max="100"
          @update:model-value="local.barrage = $event"
        />
        <div class="launch-plan__total">
          <span>{{ t('menu.launchPlanTotal') }}</span>
          <span :class="{ 'launch-plan__total--zero': totalWeight <= 0 }">{{ totalWeight }}</span>
        </div>
      </div>

      <div class="launch-plan__section-title">{{ t('menu.launchPlanAdvanced') }}</div>
      <div class="launch-plan__group">
        <AppSlider
          :label="t('menu.launchPlanCooldown')"
          :model-value="local.barrageCooldown" :min="1" :max="60"
          :suffix="t('menu.seconds')"
          @update:model-value="local.barrageCooldown = $event"
        />
        <AppSlider
          :label="t('menu.launchPlanFinaleCount')"
          :model-value="local.finaleCount" :min="1" :max="100"
          :suffix="t('menu.shots')"
          @update:model-value="local.finaleCount = $event"
        />
        <AppSlider
          :label="t('menu.launchPlanFinaleInterval')"
          :model-value="local.finaleInterval" :min="50" :max="1000" :step="10"
          :suffix="t('menu.ms')"
          @update:model-value="local.finaleInterval = $event"
        />
      </div>
    </div>

    <template #footer>
      <AppButton variant="ghost" @click="reset">{{ t('menu.launchPlanReset') }}</AppButton>
      <AppButton variant="primary" @click="save">{{ t('menu.launchPlanSave') }}</AppButton>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { reactive, computed, watch } from "vue"
import { useI18n } from "vue-i18n"
import AppDialog from "../components/AppDialog.vue"
import AppSlider from "../components/AppSlider.vue"
import AppButton from "../components/AppButton.vue"
import { DEFAULT_LAUNCH_PLAN } from "../libs/firework-engine"
import type { LaunchPlan } from "../libs/firework-engine"

const props = defineProps<{
  show: boolean
  modelValue: LaunchPlan
}>()

const emit = defineEmits<{
  "update:modelValue": [value: LaunchPlan]
  close: []
}>()

const { t } = useI18n()

const local = reactive<LaunchPlan>({ ...DEFAULT_LAUNCH_PLAN })

watch(() => props.show, (show) => {
  if (show) Object.assign(local, { ...props.modelValue })
})

const totalWeight = computed(() =>
  local.single + local.double + local.triple + local.pyramid + local.barrage,
)

function save() {
  emit("update:modelValue", { ...local })
  emit("close")
}

function reset() {
  Object.assign(local, { ...DEFAULT_LAUNCH_PLAN })
}
</script>

<style scoped lang="scss">
.launch-plan {
  width: 100%;

  &__hint {
    font-size: 13px;
    color: var(--ios-label-secondary);
    letter-spacing: var(--letter-spacing);
    line-height: 1.5;
    padding: 0 4px;
    margin-bottom: 14px;
  }

  &__section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--ios-label-secondary);
    letter-spacing: var(--letter-spacing);
    text-transform: uppercase;
    padding: 0 4px;
    margin-bottom: 8px;

    &:not(:first-child) {
      margin-top: 16px;
    }
  }

  &__group {
    background: var(--ios-fill-secondary);
    border-radius: var(--ios-radius);
    overflow: hidden;
  }

  &__total {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px 12px;
    font-size: 13px;
    color: var(--ios-label-secondary);

    &--zero {
      color: var(--ios-red);
    }
  }
}
</style>
