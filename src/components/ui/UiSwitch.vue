<script setup>
const model = defineModel({ type: Boolean, default: false });
const props = defineProps({
  label: { type: String, required: true },
  disabled: Boolean,
});
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="model"
    :aria-label="props.label"
    :disabled="props.disabled"
    dir="ltr"
    class="relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors disabled:opacity-45"
    :class="model ? 'bg-accent' : 'bg-line-strong'"
    @click="model = !model"
  >
    <span
      class="absolute top-[3px] left-[3px] size-3 rounded-full bg-white transition-transform"
      :class="model ? 'translate-x-3' : ''"
    />
  </button>
</template>
