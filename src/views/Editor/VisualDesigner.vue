<template>
  <PanelCard class="visual-designer" :title="t('visualDesigner.title')" icon="i-mdi-palette-swatch">
    <template #actions>
      <div class="visual-designer__actions">
        <ToolButton icon="i-mdi-file-code-outline"
          :title="showCode ? t('visualDesigner.hideCode') : t('visualDesigner.viewCode')" @click="showCode = !showCode">
          {{ showCode ? t('visualDesigner.hideCode') : t('visualDesigner.viewCode') }}
        </ToolButton>
        <ToolButton icon="i-mdi-play" :title="t('visualDesigner.runTitle')" variant="primary"
          @click="$emit('run-firework', blocks[activeIdx].name)">{{ t('visualDesigner.run') }}</ToolButton>
      </div>
    </template>

    <div class="visual-designer__content">
      <!-- 烟花块列表 -->
      <div class="designer-section designer-block-bar">
        <div class="designer-block-bar__scroll">
          <button v-for="(b, idx) in blocks" :key="idx"
            :class="['designer-block-tab', { 'designer-block-tab--active': idx === activeIdx }]"
            @click="activeIdx = idx">
            {{ b.name || `${t('visualDesigner.firework')} ${idx + 1}` }}
          </button>
        </div>
        <div class="designer-block-bar__actions">
          <ToolButton icon="i-mdi-plus" :title="t('visualDesigner.addBlock')" size="14" @click="addBlock" />
          <ToolButton v-if="blocks.length > 1" icon="i-mdi-delete-outline" :title="t('visualDesigner.deleteBlockTitle')"
            size="14" variant="danger" @click="removeBlock" />
        </div>
      </div>

      <!-- 当前块属性 -->
      <div class="designer-section">
        <div class="designer-section__title">{{ t('visualDesigner.basicProps') }} <span class="designer-label__hint">（{{
          activeIdx + 1 }}/{{ blocks.length }}）</span></div>
        <div class="designer-grid">
          <div class="designer-field">
            <label class="designer-label">{{ t('visualDesigner.name') }}</label>
            <input v-model="form.name" class="designer-input" :placeholder="t('visualDesigner.namePlaceholder')"
              @change="emitCode" />
          </div>
          <div class="designer-field">
            <label class="designer-label">{{ t('visualDesigner.size') }}</label>
            <InputNumber v-model="form.size" :min="50" :max="800" :step="10" @change="emitCode" />
          </div>
        </div>
      </div>

      <!-- 颜色 -->
      <div class="designer-section">
        <div class="designer-section__title">
          {{ t('visualDesigner.color') }}
        </div>

        <!-- 模式选择 -->
        <div class="designer-field designer-field--mb">
          <label class="designer-label">{{ t('visualDesigner.colorMode') }}</label>
          <div class="designer-segmented">
            <button v-for="mode in colorModes" :key="mode.value"
              :class="['designer-segmented__btn', { 'designer-segmented__btn--active': form.colorMode === mode.value }]"
              @click="form.colorMode = mode.value; emitCode()">{{ mode.label }}</button>
          </div>
        </div>

        <!-- 单色模式 -->
        <div v-if="form.colorMode === 'single'" class="designer-color-single">
          <div class="designer-color-single__inputs">
            <input type="color" :value="form.color" class="designer-color"
              @change="form.color = ($event.target as HTMLInputElement).value; emitCode()" />
            <input v-model="form.color" class="designer-input designer-input--flex"
              :class="{ 'designer-input--error': !isHexValid(form.color) }" placeholder="#ff0043" @change="emitCode" />
          </div>
        </div>

        <!-- 多色模式 -->
        <div v-if="form.colorMode === 'multi'" class="designer-color-multi">
          <div class="designer-color-chips">
            <div v-for="(c, idx) in form.multiColors" :key="idx" class="designer-color-chip">
              <div class="designer-color-chip__top">
                <input type="color" :value="c" class="designer-color-chip__picker"
                  @change="form.multiColors[idx] = ($event.target as HTMLInputElement).value; emitCode()" />
                <button v-if="form.multiColors.length > 2" class="designer-color-chip__remove"
                  @click="form.multiColors.splice(idx, 1); emitCode()"
                  :title="t('visualDesigner.removeColor')">&times;</button>
              </div>
              <input v-model="form.multiColors[idx]" class="designer-color-chip__hex"
                :class="{ 'designer-input--error': !isHexValid(form.multiColors[idx]) }" placeholder="#ff0043"
                maxlength="7" @change="emitCode" />
            </div>
            <button class="designer-color-chip designer-color-chip--add"
              @click="form.multiColors.push('#ffbf36'); emitCode()">
              <span class="designer-color-chip__plus">+</span>
            </button>
          </div>
        </div>

        <!-- 随机模式 -->
        <div v-if="form.colorMode === 'random'" class="designer-color-random">
          <div class="designer-color-random__bar"></div>
          <span class="designer-color-random__label">{{ t('visualDesigner.randomHint') }}</span>
        </div>

        <!-- 辅助色 -->
        <div class="designer-color-extras">
          <div class="designer-color-extra">
            <label class="designer-label">{{ t('visualDesigner.secondaryColor') }}</label>
            <div class="designer-color-extra__row">
              <span class="designer-color-dot designer-color-dot--sm"
                :style="{ background: form.secondColor || 'transparent' }"
                :class="{ 'designer-color-dot--empty': !form.secondColor }"></span>
              <input v-model="form.secondColor" class="designer-input"
                :class="{ 'designer-input--error': !isHexValid(form.secondColor, true) }"
                :placeholder="t('visualDesigner.emptyForNone')" maxlength="7" @change="emitCode" />
            </div>
          </div>
          <div class="designer-color-extra">
            <label class="designer-label">{{ t('visualDesigner.glitterColor') }}</label>
            <div class="designer-color-extra__row">
              <span class="designer-color-dot designer-color-dot--sm"
                :style="{ background: form.glitterColor || '#ffffff' }"></span>
              <input v-model="form.glitterColor" class="designer-input"
                :class="{ 'designer-input--error': !isHexValid(form.glitterColor, true) }" placeholder="#ffffff"
                maxlength="7" @change="emitCode" />
            </div>
          </div>
        </div>
      </div>

      <!-- 特效开关 -->
      <div class="designer-section">
        <div class="designer-section__title">{{ t('visualDesigner.effects') }}</div>
        <div class="designer-toggle-grid">
          <AppCheckbox v-for="fx in effectToggles" :key="fx.key" :model-value="(form as any)[fx.key]"
            @update:model-value="(v: boolean) => { (form as any)[fx.key] = v; if (!v && fx.key === 'glitter') { form.glitterType = 'medium' } emitCode() }">
            {{ fx.label }}</AppCheckbox>
        </div>
        <!-- 附加色（特效触发时显示） -->
        <div v-if="form.strobe" class="designer-field designer-field--mt">
          <label class="designer-label">{{ t('visualDesigner.strobeColor') }}</label>
          <div class="designer-color-extra__row">
            <span class="designer-color-dot designer-color-dot--sm" :style="{ background: form.strobeColor || '#888' }"
              :class="{ 'designer-color-dot--empty': !form.strobeColor }"></span>
            <input v-model="form.strobeColor" class="designer-input"
              :class="{ 'designer-input--error': !isHexValid(form.strobeColor, true) }"
              :placeholder="t('visualDesigner.emptyForRandom')" @change="emitCode" />
          </div>
        </div>
        <div v-if="form.pistil" class="designer-field designer-field--mt">
          <label class="designer-label">{{ t('visualDesigner.pistilColor') }}</label>
          <div class="designer-color-extra__row">
            <span class="designer-color-dot designer-color-dot--sm"
              :style="{ background: form.pistilColor || '#ffffff' }"></span>
            <input v-model="form.pistilColor" class="designer-input"
              :class="{ 'designer-input--error': !isHexValid(form.pistilColor, true) }" placeholder="#ffffff"
              @change="emitCode" />
          </div>
        </div>
      </div>

      <!-- 闪烁类型 -->
      <div v-if="form.glitter" class="designer-section">
        <div class="designer-section__title">{{ t('visualDesigner.glitterType') }}</div>
        <div class="designer-row">
          <AppSelect v-model="form.glitterType" variant="dark"
            :options="glitterTypes.map(t => ({ label: t.label, value: t.value }))" @update:model-value="emitCode" />
        </div>
      </div>

      <!-- 高级属性 -->
      <div class="designer-section">
        <div class="designer-section__title">{{ t('visualDesigner.advancedProps') }}</div>
        <div class="designer-grid">
          <div class="designer-field">
            <label class="designer-label">{{ t('visualDesigner.life') }}</label>
            <InputNumber v-model="form.life" :min="300" :max="5000" :step="50" @change="emitCode" />
          </div>
          <div class="designer-field">
            <label class="designer-label">{{ t('visualDesigner.lifeVariation') }}</label>
            <InputNumber v-model="form.lifeVariation" :min="0" :max="5" :step="0.1" @change="emitCode" />
          </div>
          <div class="designer-field">
            <label class="designer-label">{{ t('visualDesigner.density') }}</label>
            <InputNumber v-model="form.density" :min="0.05" :max="2" :step="0.05" :disabled="form.starCount > 0"
              @change="emitCode" />
          </div>
          <div class="designer-field">
            <label class="designer-label">{{ t('visualDesigner.starCount') }}</label>
            <InputNumber v-model="form.starCount" :min="0" :max="5000" :step="1" @change="emitCode" />
          </div>
        </div>
      </div>

      <!-- 物理 -->
      <div class="designer-section">
        <div class="designer-section__title">{{ t('visualDesigner.physics') }}</div>
        <div class="designer-grid">
          <div class="designer-field">
            <label class="designer-label">{{ t('visualDesigner.gravity') }}</label>
            <InputNumber v-model="form.gravity" :min="0" :max="5" :step="0.1" @change="emitCode" />
          </div>
          <div class="designer-field">
            <label class="designer-label">{{ t('visualDesigner.fade') }}</label>
            <InputNumber v-model="form.fade" :min="0" :max="2" :step="0.1" @change="emitCode" />
          </div>
        </div>
        <div class="designer-field designer-field--mt">
          <AppCheckbox :model-value="form.launchHeightAuto"
            @update:model-value="(v: boolean) => { form.launchHeightAuto = v; emitCode() }">
            {{ t('visualDesigner.launchHeightAuto') }}
          </AppCheckbox>
        </div>
        <div v-if="!form.launchHeightAuto" class="designer-field designer-field--mt">
          <label class="designer-label">{{ t('visualDesigner.launchHeight') }}</label>
          <InputNumber v-model="form.launchHeight" :min="0" :max="1" :step="0.05" @change="emitCode" />
        </div>
      </div>

      <!-- onDeath -->
      <div class="designer-section">
        <div class="designer-section__title">{{ t('visualDesigner.onDeathTitle') }}</div>

        <div class="designer-death-list">
          <div
            v-for="(effect, idx) in (form as DesignerForm).deathEffects"
            :key="effect.id"
            class="designer-death-item"
          >
            <div class="designer-death-item__header">
              <div class="designer-death-item__order">
                <button class="designer-death-item__order-btn" :disabled="idx === 0" @click="moveDeathEffect(idx, -1)" title="上移">▲</button>
                <button class="designer-death-item__order-btn" :disabled="idx === (form as DesignerForm).deathEffects.length - 1" @click="moveDeathEffect(idx, 1)" title="下移">▼</button>
              </div>
              <span class="designer-death-item__type-tag">{{ deathTypeLabel(effect.type) }}</span>
              <div class="designer-death-item__spacer"></div>
              <button class="designer-death-item__remove" @click="removeDeathEffect(idx)" title="删除">×</button>
            </div>

            <div class="designer-death-fields">
              <!-- burst -->
              <template v-if="effect.type === 'burst'">
                <div class="designer-death-grid">
                  <div class="designer-field">
                    <label class="designer-label">{{ t('visualDesigner.burstCount') }}</label>
                    <InputNumber v-model="effect.count" :min="1" :max="50" @change="emitCode" />
                  </div>
                  <div class="designer-field">
                    <label class="designer-label">{{ t('visualDesigner.burstLife') }}</label>
                    <InputNumber v-model="effect.life" :min="100" :max="3000" :step="50" @change="emitCode" />
                  </div>
                  <div class="designer-field">
                    <label class="designer-label">{{ t('visualDesigner.burstSpeed') }}</label>
                    <InputNumber v-model="effect.speed" :min="0.1" :max="5" :step="0.1" @change="emitCode" />
                  </div>
                  <div class="designer-field">
                    <label class="designer-label">{{ t('visualDesigner.burstColor') }}</label>
                    <AppSelect v-model="effect.colorMode" variant="dark" :options="[
                      { label: t('visualDesigner.colorInherit'), value: 'inherit' },
                      { label: t('visualDesigner.colorRandom'), value: 'random' },
                      { label: t('visualDesigner.colorCustom'), value: 'custom' },
                    ]" @update:model-value="emitCode" />
                  </div>
                </div>
                <div v-if="effect.colorMode === 'custom'" class="designer-field designer-field--mt">
                  <div class="designer-color-extra__row">
                    <span class="designer-color-dot designer-color-dot--sm" :style="{ background: effect.color }"></span>
                    <input v-model="effect.color" class="designer-input" :class="{ 'designer-input--error': !isHexValid(effect.color) }" placeholder="#ff0043" @change="emitCode" />
                  </div>
                </div>
              </template>

              <!-- flash -->
              <template v-if="effect.type === 'flash'">
                <div class="designer-death-grid designer-death-grid--1">
                  <div class="designer-field">
                    <label class="designer-label">{{ t('visualDesigner.flashRadius') }}</label>
                    <InputNumber v-model="effect.radius" :min="10" :max="200" :step="1" @change="emitCode" />
                  </div>
                </div>
              </template>

              <!-- arc -->
              <template v-if="effect.type === 'arc'">
                <div class="designer-death-grid">
                  <div class="designer-field">
                    <label class="designer-label">{{ t('visualDesigner.arcCount') }}</label>
                    <InputNumber v-model="effect.count" :min="1" :max="100" @change="emitCode" />
                  </div>
                  <div class="designer-field">
                    <label class="designer-label">{{ t('visualDesigner.arcAngle') }}</label>
                    <AppSelect :model-value="arcAngleToStr(effect.angle)" variant="dark" :options="[
                      { label: t('visualDesigner.arcFull'), value: 'full' },
                      { label: t('visualDesigner.arcHalf'), value: 'half' },
                      { label: t('visualDesigner.arcQuarter'), value: 'quarter' },
                    ]" @update:model-value="effect.angle = strToArcAngle($event); emitCode()" />
                  </div>
                  <div class="designer-field">
                    <label class="designer-label">{{ t('visualDesigner.arcLife') }}</label>
                    <InputNumber v-model="effect.life" :min="100" :max="3000" :step="50" @change="emitCode" />
                  </div>
                  <div class="designer-field">
                    <label class="designer-label">{{ t('visualDesigner.arcColor') }}</label>
                    <AppSelect v-model="effect.colorMode" variant="dark" :options="[
                      { label: t('visualDesigner.colorInherit'), value: 'inherit' },
                      { label: t('visualDesigner.colorRandom'), value: 'random' },
                      { label: t('visualDesigner.colorCustom'), value: 'custom' },
                    ]" @update:model-value="emitCode" />
                  </div>
                </div>
                <div v-if="effect.colorMode === 'custom'" class="designer-field designer-field--mt">
                  <div class="designer-color-extra__row">
                    <span class="designer-color-dot designer-color-dot--sm" :style="{ background: effect.color }"></span>
                    <input v-model="effect.color" class="designer-input" :class="{ 'designer-input--error': !isHexValid(effect.color) }" placeholder="#ff0043" @change="emitCode" />
                  </div>
                </div>
              </template>

              <!-- spiral -->
              <template v-if="effect.type === 'spiral'">
                <div class="designer-death-grid">
                  <div class="designer-field">
                    <label class="designer-label">{{ t('visualDesigner.spiralCount') }}</label>
                    <InputNumber v-model="effect.count" :min="1" :max="100" @change="emitCode" />
                  </div>
                  <div class="designer-field">
                    <label class="designer-label">{{ t('visualDesigner.spiralTurns') }}</label>
                    <InputNumber v-model="effect.turns" :min="0.1" :max="10" :step="0.5" @change="emitCode" />
                  </div>
                  <div class="designer-field">
                    <label class="designer-label">{{ t('visualDesigner.spiralLife') }}</label>
                    <InputNumber v-model="effect.life" :min="100" :max="3000" :step="50" @change="emitCode" />
                  </div>
                  <div class="designer-field">
                    <label class="designer-label">{{ t('visualDesigner.spiralSpeed') }}</label>
                    <InputNumber v-model="effect.speed" :min="0.1" :max="5" :step="0.1" @change="emitCode" />
                  </div>
                  <div class="designer-field">
                    <label class="designer-label">{{ t('visualDesigner.spiralColor') }}</label>
                    <AppSelect v-model="effect.colorMode" variant="dark" :options="[
                      { label: t('visualDesigner.colorInherit'), value: 'inherit' },
                      { label: t('visualDesigner.colorRandom'), value: 'random' },
                      { label: t('visualDesigner.colorCustom'), value: 'custom' },
                    ]" @update:model-value="emitCode" />
                  </div>
                </div>
                <div v-if="effect.colorMode === 'custom'" class="designer-field designer-field--mt">
                  <div class="designer-color-extra__row">
                    <span class="designer-color-dot designer-color-dot--sm" :style="{ background: effect.color }"></span>
                    <input v-model="effect.color" class="designer-input" :class="{ 'designer-input--error': !isHexValid(effect.color) }" placeholder="#ff0043" @change="emitCode" />
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <div class="designer-death-add">
          <span class="designer-death-add__label">+ {{ t('visualDesigner.addDeathEffect') }}</span>
          <button class="designer-death-add__btn" @click="addDeathEffect('burst')">Burst</button>
          <button class="designer-death-add__btn" @click="addDeathEffect('flash')">Flash</button>
          <button class="designer-death-add__btn" @click="addDeathEffect('arc')">Arc</button>
          <button class="designer-death-add__btn" @click="addDeathEffect('spiral')">Spiral</button>
        </div>
      </div>

      <!-- 代码预览 -->
      <div v-if="showCode" class="designer-section">
        <div class="designer-section__title">{{ t('visualDesigner.generatedCode') }}</div>
        <pre class="designer-code-preview">{{ generatedCode }}</pre>
      </div>
    </div>
  </PanelCard>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch } from "vue"
import { useI18n } from "vue-i18n"
import PanelCard from "../../components/PanelCard.vue"
import ToolButton from "../../components/ToolButton.vue"
import AppCheckbox from "../../components/AppCheckbox.vue"
import AppSelect from "../../components/AppSelect.vue"
import InputNumber from "../../components/InputNumber.vue"

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  "update:modelValue": [value: string]
  "run-firework": [name: string]
}>()

const showCode = ref(false)
const activeIdx = ref(0)

const { t } = useI18n()

const HEX_RE = /^#[0-9a-fA-F]{6}$/
function isHexValid(val: string, allowEmpty = false): boolean {
  if (!val.trim()) return allowEmpty
  return HEX_RE.test(val.trim())
}

let _uid = 0
function uid() { return `d_${++_uid}` }

type DeathColorMode = "inherit" | "random" | "custom"

interface BurstDeath {
  id: string
  type: "burst"
  enabled: boolean
  count: number
  life: number
  speed: number
  colorMode: DeathColorMode
  color: string
}

interface FlashDeath {
  id: string
  type: "flash"
  enabled: boolean
  radius: number
}

interface ArcDeath {
  id: string
  type: "arc"
  enabled: boolean
  count: number
  angle: number
  life: number
  colorMode: DeathColorMode
  color: string
}

interface SpiralDeath {
  id: string
  type: "spiral"
  enabled: boolean
  count: number
  turns: number
  life: number
  speed: number
  colorMode: DeathColorMode
  color: string
}

type DeathEffect = BurstDeath | FlashDeath | ArcDeath | SpiralDeath

function createBurstDeath(): BurstDeath {
  return { id: uid(), type: "burst", enabled: true, count: 6, life: 600, speed: 1.0, colorMode: "inherit", color: "#ff0043" }
}
function createFlashDeath(): FlashDeath {
  return { id: uid(), type: "flash", enabled: true, radius: 46 }
}
function createArcDeath(): ArcDeath {
  return { id: uid(), type: "arc", enabled: true, count: 6, angle: 6.283, life: 600, colorMode: "inherit", color: "#ff0043" }
}
function createSpiralDeath(): SpiralDeath {
  return { id: uid(), type: "spiral", enabled: true, count: 16, turns: 1, life: 600, speed: 1.0, colorMode: "inherit", color: "#ff0043" }
}

interface DesignerForm {
  name: string
  size: number
  colorMode: "single" | "multi" | "random"
  color: string
  multiColors: string[]
  secondColor: string
  glitterColor: string
  life: number
  lifeVariation: number
  density: number
  starCount: number
  gravity: number
  fade: number
  launchHeight: number
  launchHeightAuto: boolean
  glitter: boolean
  glitterType: string
  ring: boolean
  horsetail: boolean
  strobe: boolean
  strobeColor: string
  pistil: boolean
  pistilColor: string
  streamers: boolean
  crossette: boolean
  crackle: boolean
  floral: boolean
  fallingLeaves: boolean
  deathEffects: DeathEffect[]
}

function defaultForm(name = ""): DesignerForm {
  return {
    name,
    size: 300,
    colorMode: "random",
    color: "#ff0043",
    multiColors: ["#ff0043", "#1e7fff"],
    secondColor: "",
    glitterColor: "#ffffff",
    life: 900,
    lifeVariation: 0.125,
    density: 1.0,
    starCount: 0,
    gravity: 1,
    fade: 1,
    launchHeight: 0.5,
    launchHeightAuto: true,
    glitter: false,
    glitterType: "medium",
    ring: false,
    horsetail: false,
    strobe: false,
    strobeColor: "",
    pistil: false,
    pistilColor: "#ffffff",
    streamers: false,
    crossette: false,
    crackle: false,
    floral: false,
    fallingLeaves: false,
    deathEffects: [],
  }
}

const blocks = reactive<DesignerForm[]>([defaultForm()])

const form = computed<DesignerForm>({
  get: () => blocks[activeIdx.value] ?? blocks[0],
  set: () => { },
})

function addBlock() {
  blocks.push(defaultForm(`${t('visualDesigner.firework')}${blocks.length + 1}`))
  activeIdx.value = blocks.length - 1
  emitCode()
}

function removeBlock() {
  if (blocks.length <= 1) return
  blocks.splice(activeIdx.value, 1)
  if (activeIdx.value >= blocks.length) {
    activeIdx.value = blocks.length - 1
  }
  emitCode()
}

const colorModes = computed(() => [
  { value: "random" as const, label: t("visualDesigner.colorModeRandom") },
  { value: "single" as const, label: t("visualDesigner.colorModeSingle") },
  { value: "multi" as const, label: t("visualDesigner.colorModeMulti") },
])

const effectToggles = computed(() => [
  { key: "ring", label: t("visualDesigner.effectLabels.ring") },
  { key: "horsetail", label: t("visualDesigner.effectLabels.horsetail") },
  { key: "strobe", label: t("visualDesigner.effectLabels.strobe") },
  { key: "pistil", label: t("visualDesigner.effectLabels.pistil") },
  { key: "streamers", label: t("visualDesigner.effectLabels.streamers") },
  { key: "crossette", label: t("visualDesigner.effectLabels.crossette") },
  { key: "crackle", label: t("visualDesigner.effectLabels.crackle") },
  { key: "floral", label: t("visualDesigner.effectLabels.floral") },
  { key: "fallingLeaves", label: t("visualDesigner.effectLabels.fallingLeaves") },
  { key: "glitter", label: t("visualDesigner.effectLabels.glitter") },
] as const)

const glitterTypes = computed(() => [
  { value: "light", label: t("visualDesigner.glitterTypes.light") },
  { value: "medium", label: t("visualDesigner.glitterTypes.medium") },
  { value: "heavy", label: t("visualDesigner.glitterTypes.heavy") },
  { value: "thick", label: t("visualDesigner.glitterTypes.thick") },
  { value: "streamer", label: t("visualDesigner.glitterTypes.streamer") },
  { value: "willow", label: t("visualDesigner.glitterTypes.willow") },
])

function formatColorExpr(f: DesignerForm): string {
  if (f.colorMode === "random") return "random"
  if (f.colorMode === "multi") {
    const colors = f.multiColors.filter(c => c && c.trim())
    if (colors.length === 0) return "random"
    return `[${colors.join(", ")}]`
  }
  return f.color || "random"
}

function formatActionColor(mode: string, customColor: string): string {
  if (mode === "inherit") return "inherit"
  if (mode === "random") return "random"
  return customColor || "#ff0043"
}

function generateBlockCode(f: DesignerForm): string {
  const lines: string[] = []
  lines.push(`firework {`)

  const indent = "    "

  lines.push(`${indent}name = "${f.name || t("visualDesigner.unnamed")}"`)
  lines.push(`${indent}size = ${f.size}`)

  // Color
  lines.push(`${indent}color = ${formatColorExpr(f)}`)

  // Second color
  if (f.secondColor && f.secondColor.trim()) {
    lines.push(`${indent}secondColor = ${f.secondColor}`)
  }

  // Life
  if (f.life !== 900) lines.push(`${indent}life = ${f.life}`)
  if (f.lifeVariation !== 0.125) lines.push(`${indent}lifeVariation = ${f.lifeVariation}`)

  // Density / starCount
  if (f.starCount > 0) {
    lines.push(`${indent}starCount = ${f.starCount}`)
  } else if (f.density !== 1.0) {
    lines.push(`${indent}density = ${f.density}`)
  }

  // Glitter
  if (f.glitter) {
    lines.push(`${indent}glitter = ${f.glitterType}`)
    if (f.glitterColor && f.glitterColor.trim()) {
      lines.push(`${indent}glitterColor = ${f.glitterColor}`)
    }
  }

  // Bool effects
  if (f.ring) lines.push(`${indent}ring = true`)
  if (f.horsetail) lines.push(`${indent}horsetail = true`)
  if (f.strobe) {
    lines.push(`${indent}strobe = true`)
    if (f.strobeColor && f.strobeColor.trim()) {
      lines.push(`${indent}strobeColor = ${f.strobeColor}`)
    }
  }
  if (f.pistil) {
    lines.push(`${indent}pistil = true`)
    if (f.pistilColor && f.pistilColor.trim()) {
      lines.push(`${indent}pistilColor = ${f.pistilColor}`)
    }
  }
  if (f.streamers) lines.push(`${indent}streamers = true`)
  if (f.crossette) lines.push(`${indent}crossette = true`)
  if (f.crackle) lines.push(`${indent}crackle = true`)
  if (f.floral) lines.push(`${indent}floral = true`)
  if (f.fallingLeaves) lines.push(`${indent}fallingLeaves = true`)

  // Physics
  if (f.gravity !== 1) lines.push(`${indent}gravity = ${f.gravity}`)
  if (f.fade !== 1) lines.push(`${indent}fade = ${f.fade}`)
  if (!f.launchHeightAuto) lines.push(`${indent}launchHeight = ${f.launchHeight}`)

  // onDeath
  if (f.deathEffects.length > 0) {
    lines.push(``)
    lines.push(`${indent}onDeath {`)
    const dd = "        "

    for (const effect of f.deathEffects) {
      if (effect.type === "burst") {
        const opts: string[] = []
        opts.push(`color = ${formatActionColor(effect.colorMode, effect.color)}`)
        if (effect.life !== 600) opts.push(`life = ${effect.life}`)
        if (effect.speed !== 1.0) opts.push(`speed = ${effect.speed}`)
        lines.push(`${dd}burst ${effect.count} { ${opts.join(", ")} }`)
      } else if (effect.type === "flash") {
        if (effect.radius === 46) {
          lines.push(`${dd}flash`)
        } else {
          lines.push(`${dd}flash(${effect.radius})`)
        }
      } else if (effect.type === "arc") {
        const opts: string[] = []
        opts.push(`color = ${formatActionColor(effect.colorMode, effect.color)}`)
        if (effect.life !== 600) opts.push(`life = ${effect.life}`)
        if (effect.angle === 6.283) {
          lines.push(`${dd}arc ${effect.count} { ${opts.join(", ")} }`)
        } else {
          const angleStr = effect.angle === 3.1415 ? "Math.PI" : effect.angle.toFixed(4)
          lines.push(`${dd}arc ${effect.count} (${angleStr}) { ${opts.join(", ")} }`)
        }
      } else if (effect.type === "spiral") {
        const opts: string[] = []
        opts.push(`color = ${formatActionColor(effect.colorMode, effect.color)}`)
        if (effect.life !== 600) opts.push(`life = ${effect.life}`)
        if (effect.speed !== 1.0) opts.push(`speed = ${effect.speed}`)
        if (effect.turns === 1) {
          lines.push(`${dd}spiral ${effect.count} { ${opts.join(", ")} }`)
        } else {
          lines.push(`${dd}spiral ${effect.count} (${effect.turns}) { ${opts.join(", ")} }`)
        }
      }
    }

    lines.push(`${indent}}`)
  }

  lines.push(`}`)
  return lines.join("\n")
}

const generatedCode = computed(() => {
  const parts: string[] = []
  const codeLines = props.modelValue.split("\n")
  const commentLines = codeLines.filter(l => l.trim().startsWith("//"))

  if (commentLines.length > 0) {
    parts.push(commentLines.join("\n"))
  }

  for (const block of blocks) {
    parts.push(generateBlockCode(block))
  }

  return parts.join("\n\n")
})

function emitCode() {
  emit("update:modelValue", generatedCode.value)
}

const DEATH_TYPE_LABELS: Record<string, string> = { burst: "Burst", flash: "Flash", arc: "Arc", spiral: "Spiral" }
function deathTypeLabel(type: string) {
  return DEATH_TYPE_LABELS[type] ?? type
}

function addDeathEffect(type: DeathEffect["type"]) {
  let effect: DeathEffect
  if (type === "burst") effect = createBurstDeath()
  else if (type === "flash") effect = createFlashDeath()
  else if (type === "arc") effect = createArcDeath()
  else effect = createSpiralDeath()
  form.value.deathEffects.push(effect)
  emitCode()
}

function removeDeathEffect(idx: number) {
  form.value.deathEffects.splice(idx, 1)
  emitCode()
}

function moveDeathEffect(idx: number, delta: number) {
  const effects = form.value.deathEffects
  const target = idx + delta
  if (target < 0 || target >= effects.length) return
  const tmp = effects[idx]
  effects[idx] = effects[target]
  effects[target] = tmp
  emitCode()
}

function arcAngleToStr(angle: number): string {
  if (angle === 6.283) return "full"
  if (angle === 3.1415) return "half"
  return "quarter"
}

function strToArcAngle(val: string): number {
  return { full: 6.283, half: 3.1415, quarter: 1.5708 }[val] ?? 6.283
}

function parseDeathColor(raw: string, eff: BurstDeath | ArcDeath | SpiralDeath) {
  if (raw === "inherit") eff.colorMode = "inherit"
  else if (raw === "random") eff.colorMode = "random"
  else if (/^#[0-9a-fA-F]{6}$/.test(raw)) { eff.colorMode = "custom"; eff.color = raw }
  else eff.colorMode = "inherit"
}

// ---- Parsing ----

function parseColorExpr(raw: string, target: DesignerForm) {
  // Random
  if (raw === "random") {
    target.colorMode = "random"
    return
  }
  // Array: [#ff0043, #1e7fff]
  const arrMatch = raw.match(/^\[(.+)\]$/)
  if (arrMatch) {
    target.colorMode = "multi"
    const colors = arrMatch[1]
      .split(",")
      .map(s => s.trim())
      .filter(s => /^#[0-9a-fA-F]{6}$/.test(s))
    if (colors.length > 0) {
      target.multiColors = colors
      while (target.multiColors.length < 2) target.multiColors.push("#ff0043")
    }
    return
  }
  // Single hex
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
    target.colorMode = "single"
    target.color = raw
    return
  }
  // Default to random
  target.colorMode = "random"
}

function parseBlockCode(blockCode: string, target: DesignerForm) {
  // Reset to defaults first
  Object.assign(target, defaultForm())

  const nameMatch = blockCode.match(/name\s*=\s*"([^"]*)"/)
  if (nameMatch) target.name = nameMatch[1]

  const sizeMatch = blockCode.match(/size\s*=\s*(\d+)/)
  if (sizeMatch) target.size = parseInt(sizeMatch[1])

  const colorMatch = blockCode.match(/color\s*=\s*(\[[^\]]*\]|random|#[a-fA-F0-9]{6})/)
  if (colorMatch) parseColorExpr(colorMatch[1], target)

  const scMatch = blockCode.match(/secondColor\s*=\s*(#[a-fA-F0-9]{6})/)
  if (scMatch) target.secondColor = scMatch[1]
  else target.secondColor = ""

  const gcMatch = blockCode.match(/glitterColor\s*=\s*(#[a-fA-F0-9]{6})/)
  if (gcMatch) target.glitterColor = gcMatch[1]

  const lifeMatch = blockCode.match(/life\s*=\s*([\d.]+)/)
  if (lifeMatch) target.life = parseFloat(lifeMatch[1])

  const lvMatch = blockCode.match(/lifeVariation\s*=\s*([\d.]+)/)
  target.lifeVariation = lvMatch ? parseFloat(lvMatch[1]) : 0.125

  const densityMatch = blockCode.match(/density\s*=\s*([\d.]+)/)
  if (densityMatch) target.density = parseFloat(densityMatch[1])

  const scMatch2 = blockCode.match(/starCount\s*=\s*(\d+)/)
  if (scMatch2) target.starCount = parseInt(scMatch2[1])

  const gravityMatch = blockCode.match(/gravity\s*=\s*([\d.]+)/)
  target.gravity = gravityMatch ? parseFloat(gravityMatch[1]) : 1

  const fadeMatch = blockCode.match(/fade\s*=\s*([\d.]+)/)
  target.fade = fadeMatch ? parseFloat(fadeMatch[1]) : 1

  const lhMatch = blockCode.match(/launchHeight\s*=\s*([\d.]+)/)
  if (lhMatch) {
    target.launchHeight = parseFloat(lhMatch[1])
    target.launchHeightAuto = false
  } else {
    target.launchHeight = 0.5
    target.launchHeightAuto = true
  }

  const boolProps = ["ring", "horsetail", "strobe", "pistil", "streamers", "crossette", "crackle", "floral", "fallingLeaves"]
  for (const prop of boolProps) {
    const m = blockCode.match(new RegExp(`${prop}\\s*=\\s*true`))
      ; (target as any)[prop] = !!m
  }

  const glitterMatch = blockCode.match(/glitter\s*=\s*(\w+)/)
  if (glitterMatch) {
    target.glitter = true
    target.glitterType = glitterMatch[1]
  }

  const sbcCol = blockCode.match(/strobeColor\s*=\s*(#[a-fA-F0-9]{6})/)
  target.strobeColor = sbcCol ? sbcCol[1] : ""

  const pisCol = blockCode.match(/pistilColor\s*=\s*(#[a-fA-F0-9]{6})/)
  target.pistilColor = pisCol ? pisCol[1] : "#ffffff"

  // onDeath actions - extract body with nested brace handling
  const onDeathIdx = blockCode.indexOf("onDeath")
  if (onDeathIdx >= 0) {
    const afterOnDeath = blockCode.slice(onDeathIdx + "onDeath".length)
    const openIdx = afterOnDeath.indexOf("{")
    if (openIdx >= 0) {
      let depth = 0
      let closeIdx = -1
      for (let i = openIdx; i < afterOnDeath.length; i++) {
        if (afterOnDeath[i] === "{") depth++
        else if (afterOnDeath[i] === "}") {
          depth--
          if (depth === 0) { closeIdx = i; break }
        }
      }
      if (closeIdx >= 0) {
        const body = afterOnDeath.slice(openIdx + 1, closeIdx)
        target.deathEffects = []

        // burst
        for (const m of body.matchAll(/burst\s+(\d+)\s*\{([^}]*)\}/g)) {
          const eff = createBurstDeath()
          eff.count = parseInt(m[1])
          const opts = m[2]

          const bLife = opts.match(/life\s*=\s*([\d.]+)/)
          if (bLife) eff.life = parseFloat(bLife[1])

          const bSpeed = opts.match(/speed\s*=\s*([\d.]+)/)
          if (bSpeed) eff.speed = parseFloat(bSpeed[1])

          const bColor = opts.match(/color\s*=\s*(\w+|#[a-fA-F0-9]{6})/)
          if (bColor) parseDeathColor(bColor[1], eff)
          target.deathEffects.push(eff)
        }

        // flash
        for (const m of body.matchAll(/flash(?:\((\d+)\))?/g)) {
          const eff = createFlashDeath()
          eff.radius = m[1] ? parseInt(m[1]) : 46
          target.deathEffects.push(eff)
        }

        // arc
        for (const m of body.matchAll(/arc\s+(\d+)(?:\s*\(([\d.]+|Math\.PI)\))?\s*\{([^}]*)\}/g)) {
          const eff = createArcDeath()
          eff.count = parseInt(m[1])
          if (m[2]) eff.angle = m[2] === "Math.PI" ? 3.1415 : parseFloat(m[2])

          const aOpts = m[3]
          const aLife = aOpts.match(/life\s*=\s*([\d.]+)/)
          if (aLife) eff.life = parseFloat(aLife[1])

          const aColor = aOpts.match(/color\s*=\s*(\w+|#[a-fA-F0-9]{6})/)
          if (aColor) parseDeathColor(aColor[1], eff)
          target.deathEffects.push(eff)
        }

        // spiral
        for (const m of body.matchAll(/spiral\s+(\d+)(?:\s*\(([\d.]+)\))?\s*\{([^}]*)\}/g)) {
          const eff = createSpiralDeath()
          eff.count = parseInt(m[1])
          eff.turns = m[2] ? parseFloat(m[2]) : 1

          const sOpts = m[3]
          const sLife = sOpts.match(/life\s*=\s*([\d.]+)/)
          if (sLife) eff.life = parseFloat(sLife[1])

          const sSpeed = sOpts.match(/speed\s*=\s*([\d.]+)/)
          if (sSpeed) eff.speed = parseFloat(sSpeed[1])

          const sColor = sOpts.match(/color\s*=\s*(\w+|#[a-fA-F0-9]{6})/)
          if (sColor) parseDeathColor(sColor[1], eff)
          target.deathEffects.push(eff)
        }
      }
    }
  }
}

function extractFireworkBlocks(code: string): string[] {
  const blocks: string[] = []
  const lines = code.split("\n")
  let depth = 0
  let startIdx = -1

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed.startsWith("firework") && (trimmed.endsWith("{") || trimmed === "firework")) {
      startIdx = i
      depth = 1
    } else if (startIdx >= 0) {
      depth += (lines[i].match(/\{/g) || []).length
      depth -= (lines[i].match(/\}/g) || []).length
      if (depth === 0) {
        const blockLines = lines.slice(startIdx, i + 1)
        blocks.push(blockLines.join("\n"))
        startIdx = -1
      }
    }
  }
  return blocks
}

function parseAllBlocks(code: string) {
  const blockCodes = extractFireworkBlocks(code)

  if (blockCodes.length === 0) {
    blocks.length = 0
    blocks.push(defaultForm())
    activeIdx.value = 0
    return
  }

  while (blocks.length > blockCodes.length) blocks.pop()
  while (blocks.length < blockCodes.length) blocks.push(defaultForm())

  for (let i = 0; i < blockCodes.length; i++) {
    parseBlockCode(blockCodes[i], blocks[i])
  }

  if (activeIdx.value >= blocks.length) {
    activeIdx.value = blocks.length - 1
  }
}

let lastParsedCode = ""
watch(() => props.modelValue, (val) => {
  if (val === generatedCode.value) return
  if (val === lastParsedCode && val) return
  parseAllBlocks(val)
  lastParsedCode = val
}, { immediate: true })
</script>

<style scoped lang="scss">
.visual-designer {
  flex: 1;
  min-height: 0;

  &__actions {
    display: flex;
    gap: 6px;
  }

  &__content {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    gap: 16px;
    scrollbar-gutter: stable;
  }
}

.designer-block-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #3c3c3c;

  &__scroll {
    display: flex;
    gap: 4px;
    flex: 1;
    overflow-x: auto;

    &::-webkit-scrollbar {
      height: 4px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: #484848;
      border-radius: 2px;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: #666;
    }
  }

  &__actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
}

.designer-block-tab {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  font-size: 12px;
  font-family: inherit;
  color: #888;
  background: #2d2d2d;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;

  &:hover {
    color: #ccc;
    border-color: #454545;
  }

  &--active {
    color: #fff;
    background: rgba(14, 99, 156, 0.3);
    border-color: #0e639c;
  }
}

.designer-section {
  &__title {
    font-size: 13px;
    font-weight: 600;
    color: #ccc;
    margin-bottom: 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid #3c3c3c;
  }
}

.designer-death-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.designer-death-item {
  border: 1px solid #454545;
  border-radius: 4px;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: #333;
    border-bottom: 1px solid #454545;
  }

  &__order {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  &__order-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 14px;
    padding: 0;
    font-size: 8px;
    color: #888;
    background: #3c3c3c;
    border: 1px solid #454545;
    border-radius: 2px;
    cursor: pointer;
    line-height: 1;
    transition: all 0.1s;

    &:hover:not(:disabled) {
      color: #d4d4d4;
      background: #505050;
    }

    &:disabled {
      opacity: 0.3;
      cursor: default;
    }
  }

  &__type-tag {
    font-size: 11px;
    font-weight: 600;
    color: #4fc1ff;
    background: rgba(79, 193, 255, 0.1);
    padding: 2px 6px;
    border-radius: 3px;
    letter-spacing: 0.03em;
  }

  &__spacer {
    flex: 1;
  }

  &__remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    font-size: 14px;
    color: #888;
    background: transparent;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    line-height: 1;
    transition: all 0.1s;

    &:hover {
      color: #e06c75;
      background: rgba(224, 108, 117, 0.15);
    }
  }
}

.designer-death-fields {
  padding: 8px;
}

.designer-death-add {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0 0;

  &__label {
    font-size: 12px;
    color: #888;
    margin-right: 2px;
  }

  &__btn {
    padding: 4px 10px;
    font-size: 12px;
    font-family: inherit;
    color: #aaa;
    background: #3c3c3c;
    border: 1px solid #454545;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      color: #4fc1ff;
      border-color: #0e639c;
      background: rgba(14, 99, 156, 0.15);
    }
  }
}

.designer-death-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;

  &--1 {
    grid-template-columns: 1fr;
    max-width: 120px;
  }
}

.designer-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;

  &--2 {
    grid-template-columns: 1fr 1fr;
  }

  &--3 {
    grid-template-columns: 1fr 1fr 1fr;
  }
}

.designer-row {
  display: flex;
}

.designer-field {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &--mb {
    margin-bottom: 10px;
  }

  &--mt {
    margin-top: 10px;
  }
}

.designer-label {
  font-size: 12px;
  color: #888;

  &__hint {
    color: #569cd6;
  }
}


.designer-color-dot {
  display: inline-block;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  flex-shrink: 0;

  &--sm {
    width: 12px;
    height: 12px;
  }

  &--empty {
    border-style: dashed;
    border-color: #555;
    box-shadow: none;
  }

  &--rainbow {
    background: conic-gradient(#ff0043, #ffbf36, #14fc56, #1e7fff, #e60aff, #ff0043) !important;
    border-color: rgba(255, 255, 255, 0.5);
  }
}

// === 单色模式 ===
.designer-color-single {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: #2d2d2d;
  border-radius: 6px;
  border: 1px solid #3c3c3c;

  &__swatch {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    flex-shrink: 0;
  }

  &__inputs {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }
}

// === 多色模式（芯片布局） ===
.designer-color-multi {
  margin-bottom: 12px;
}

.designer-color-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.designer-color-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: #2d2d2d;
  border: 1px solid #3c3c3c;
  border-radius: 8px;
  min-width: 80px;

  &__top {
    display: flex;
    align-items: center;
    gap: 4px;
    position: relative;
  }

  &__picker {
    width: 36px;
    height: 36px;
    padding: 2px;
    border: 1px solid #454545;
    border-radius: 50%;
    background: #3c3c3c;
    cursor: pointer;

    &::-webkit-color-swatch-wrapper {
      padding: 0;
    }

    &::-webkit-color-swatch {
      border: none;
      border-radius: 50%;
    }
  }

  &__remove {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 18px;
    height: 18px;
    padding: 0;
    font-size: 12px;
    line-height: 18px;
    text-align: center;
    color: #888;
    background: #2d2d2d;
    border: 1px solid #454545;
    border-radius: 50%;
    cursor: pointer;

    &:hover {
      color: #e74c3c;
      border-color: #e74c3c;
      background: #3c2020;
    }
  }

  &__hex {
    width: 72px;
    padding: 3px 6px;
    font-size: 11px;
    font-family: "Consolas", "Courier New", monospace;
    text-align: center;
    color: #aaa;
    background: #3c3c3c;
    border: 1px solid #454545;
    border-radius: 3px;
    outline: none;

    &:focus {
      border-color: #0e639c;
      color: #d4d4d4;
    }
  }

  &--add {
    justify-content: center;
    cursor: pointer;
    border-style: dashed;
    border-color: #454545;
    min-width: 80px;
    min-height: 80px;
    transition: all 0.15s;

    &:hover {
      border-color: #569cd6;
      background: rgba(86, 156, 214, 0.08);
    }
  }

  &__plus {
    font-size: 24px;
    color: #569cd6;
    line-height: 1;
  }
}

// === 随机模式 ===
.designer-color-random {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: #2d2d2d;
  border-radius: 6px;
  border: 1px solid #3c3c3c;

  &__bar {
    width: 60px;
    height: 8px;
    border-radius: 4px;
    background: linear-gradient(90deg, #ff0043, #ffbf36, #14fc56, #1e7fff, #e60aff);
    flex-shrink: 0;
  }

  &__label {
    font-size: 12px;
    color: #888;
    font-style: italic;
  }
}

// === 辅助色（横向两列） ===
.designer-color-extras {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid #3c3c3c;
}

.designer-color-extra {
  display: flex;
  flex-direction: column;
  gap: 4px;

  &__row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

// === 保留的基础样式 ===
.designer-input {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  font-size: 13px;
  font-family: "Consolas", "Courier New", monospace;
  color: #d4d4d4;
  background: #3c3c3c;
  border: 1px solid #454545;
  border-radius: 4px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;

  &:focus {
    border-color: #0e639c;
  }

  &--flex {
    flex: 1;
  }

  &--error {
    border-color: #e74c3c;
    box-shadow: 0 0 0 1px rgba(231, 76, 60, 0.15);
  }
}

.designer-color {
  width: 32px;
  height: 32px;
  padding: 2px;
  border: 1px solid #454545;
  border-radius: 4px;
  background: #3c3c3c;
  cursor: pointer;
  flex-shrink: 0;

  &::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  &::-webkit-color-swatch {
    border: none;
    border-radius: 2px;
  }
}

.designer-select {
  width: 100%;
  padding: 6px 10px;
  font-size: 13px;
  font-family: inherit;
  color: #d4d4d4;
  background: #3c3c3c;
  border: 1px solid #454545;
  border-radius: 4px;
  outline: none;

  &:focus {
    border-color: #0e639c;
  }
}

.designer-segmented {
  display: flex;
  background: #2d2d2d;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  overflow: hidden;

  &__btn {
    flex: 1;
    height: 32px;
    padding: 0 10px;
    font-size: 12px;
    font-family: inherit;
    color: #888;
    background: transparent;
    border: none;
    border-right: 1px solid #3c3c3c;
    cursor: pointer;
    box-sizing: border-box;
    transition: all 0.15s;
    text-align: center;

    &:last-child {
      border-right: none;
    }

    &:hover {
      color: #ccc;
      background: rgba(255, 255, 255, 0.05);
    }

    &--active {
      color: #fff;
      background: rgba(14, 99, 156, 0.35);
      font-weight: 500;
    }
  }
}

.designer-toggle-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.designer-code-preview {
  padding: 12px;
  font-size: 13px;
  font-family: "Consolas", "Courier New", monospace;
  line-height: 1.6;
  color: #d4d4d4;
  background: #1e1e1e;
  border-radius: 4px;
  overflow-x: auto;
  white-space: pre;
}
</style>
