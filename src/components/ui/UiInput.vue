<script setup>
import { useTemplateRef } from "vue";

const model = defineModel({ type: String, default: "" });
const props = defineProps({
  mono: Boolean, // names/types/defaults are code: LTR + mono font
  placeholder: String,
  label: String, // aria-label when there is no visible <label>
  invalid: Boolean,
  disabled: Boolean,
});
defineExpose({
  focus: () => input.value?.focus(),
  select: () => input.value?.select(),
});

const input = useTemplateRef("input");
</script>

<template>
  <input
    ref="input"
    v-model="model"
    :placeholder="props.placeholder"
    :aria-label="props.label"
    :aria-invalid="props.invalid || undefined"
    :disabled="props.disabled"
    :dir="props.mono ? 'ltr' : undefined"
    spellcheck="false"
    autocomplete="off"
    class="h-[30px] w-full min-w-0 rounded-control border bg-canvas px-2.5 text-xs text-fg placeholder:text-muted focus-visible:border-accent focus-visible:outline-none disabled:opacity-45"
    :class="[
      props.mono ? 'font-mono' : '',
      props.invalid ? 'border-danger' : 'border-line-strong',
    ]"
  />
</template>
