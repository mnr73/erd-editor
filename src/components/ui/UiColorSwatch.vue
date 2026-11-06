<script setup>
const props = defineProps({
  color: String, // #rrggbb, or empty for "no color"
  selected: Boolean,
  label: String,
  size: { type: Number, default: 22 },
});
</script>

<template>
  <button
    type="button"
    :aria-label="props.label"
    :title="props.label"
    :aria-pressed="props.selected"
    class="relative shrink-0 rounded-chip border border-line-strong transition-transform hover:scale-110"
    :class="
      props.selected
        ? 'ring-2 ring-accent ring-offset-2 ring-offset-popover'
        : ''
    "
    :style="{
      width: `${props.size}px`,
      height: `${props.size}px`,
      background: props.color || 'transparent',
    }"
  >
    <!-- "no color": diagonal strike -->
    <span
      v-if="!props.color"
      class="absolute inset-0 rounded-chip"
      style="
        background: linear-gradient(
          135deg,
          transparent 46%,
          var(--c-danger) 46%,
          var(--c-danger) 54%,
          transparent 54%
        );
      "
    />
    <slot />
  </button>
</template>
