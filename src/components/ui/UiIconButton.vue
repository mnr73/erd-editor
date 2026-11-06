<script setup>
import UiTooltip from "./UiTooltip.vue";

defineOptions({ inheritAttrs: false });
const props = defineProps({
  label: { type: String, required: true }, // aria-label and tooltip text
  shortcut: String,
  active: Boolean,
  disabled: Boolean,
  size: { type: String, default: "md" }, // sm 24 | md 28 | lg 34 (tool button)
  tooltipSide: { type: String, default: "bottom" },
});

const sizes = {
  sm: "size-6",
  md: "size-7",
  lg: "size-[var(--size-tool-button)]",
};
</script>

<template>
  <UiTooltip
    :text="props.label"
    :shortcut="props.shortcut"
    :side="props.tooltipSide"
  >
    <button
      type="button"
      :aria-label="props.label"
      :aria-pressed="props.active || undefined"
      :disabled="props.disabled"
      v-bind="$attrs"
      class="inline-flex shrink-0 items-center justify-center rounded-control transition-colors disabled:pointer-events-none disabled:opacity-40"
      :class="[
        sizes[props.size],
        props.active
          ? 'bg-accent-soft text-accent-text'
          : 'text-fg-soft hover:bg-hover hover:text-fg',
      ]"
    >
      <slot />
    </button>
  </UiTooltip>
</template>
