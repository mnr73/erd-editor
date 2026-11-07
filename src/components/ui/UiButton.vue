<script setup>
const props = defineProps({
  variant: { type: String, default: "secondary" }, // primary | secondary | ghost | danger
  size: { type: String, default: "md" }, // sm | md
  disabled: Boolean,
  type: { type: String, default: "button" },
});

const variants = {
  primary: "bg-accent text-accent-fg border-transparent hover:brightness-110",
  secondary: "border-line-strong text-fg hover:bg-hover",
  ghost: "border-transparent text-fg-soft hover:bg-hover",
  danger: "border-line-strong text-danger hover:bg-hover",
};
const sizes = { sm: "h-6 px-2 text-ui-115", md: "h-7 px-3 text-xs" };
</script>

<template>
  <button
    :type="props.type"
    :disabled="props.disabled"
    class="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-control border font-normal whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-45"
    :class="[variants[props.variant], sizes[props.size]]"
  >
    <slot name="icon" />
    <slot />
  </button>
</template>
