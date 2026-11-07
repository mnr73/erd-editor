<script setup>
/** Small segmented switch. `options`: [{ value, label }]. Generic: labels are plain strings. */
const model = defineModel({ type: String });
const props = defineProps({
  options: { type: Array, required: true },
  label: String,
});
</script>

<template>
  <div
    role="group"
    dir="ltr"
    :aria-label="props.label"
    class="inline-flex rounded-control border border-line-strong bg-canvas p-0.5"
  >
    <button
      v-for="o in props.options"
      :key="o.value"
      type="button"
      :aria-pressed="model === o.value"
      class="h-[22px] min-w-[30px] rounded-[5px] px-2 text-ui-115 transition-colors"
      :class="
        model === o.value
          ? 'bg-accent-soft font-semibold text-accent-text'
          : 'text-muted hover:text-fg'
      "
      @click="model = o.value"
    >
      {{ o.label }}
    </button>
  </div>
</template>
