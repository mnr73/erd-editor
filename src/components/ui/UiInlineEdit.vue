<script setup>
import { nextTick, onMounted, useTemplateRef } from "vue";

/**
 * Text input that replaces a label while editing. Commits on Enter / blur, cancels on Escape.
 * Emits `commit(value)` (also for an unchanged value, so the caller can close the editor),
 * `cancel`, and `tab(shift)` so the caller can move to the next field. Pointer events stop here, so
 * typing / selecting text never starts a drag on the canvas.
 */
const props = defineProps({
  value: { type: String, default: "" },
  mono: Boolean,
  label: String,
  placeholder: String,
  selectOnMount: { type: Boolean, default: true },
});
const emit = defineEmits(["commit", "cancel", "tab", "input"]);

const input = useTemplateRef("input");
let done = false;

onMounted(async () => {
  await nextTick();
  input.value?.focus({ preventScroll: true });
  if (props.selectOnMount) input.value?.select();
});

function commit() {
  if (done) return;
  done = true;
  emit("commit", input.value.value);
}
function cancel() {
  if (done) return;
  done = true;
  emit("cancel");
}
function onKey(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    commit();
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    cancel();
  } else if (e.key === "Tab") {
    e.preventDefault();
    const value = input.value.value;
    done = true;
    emit("commit", value);
    emit("tab", e.shiftKey);
  }
}
</script>

<template>
  <input
    ref="input"
    :value="props.value"
    :aria-label="props.label"
    :placeholder="props.placeholder"
    :dir="props.mono ? 'ltr' : undefined"
    spellcheck="false"
    autocomplete="off"
    class="h-5 w-full min-w-0 rounded-kbd border border-accent bg-canvas px-1 text-inherit"
    :class="props.mono ? 'font-mono' : ''"
    style="font: inherit"
    @keydown="onKey"
    @input="emit('input', $event.target.value)"
    @blur="commit"
    @pointerdown.stop
    @dblclick.stop
    @click.stop
  />
</template>
