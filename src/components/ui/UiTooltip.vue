<script setup>
import { onBeforeUnmount, ref, useId } from "vue";

import UiKbd from "./UiKbd.vue";
import UiPopover from "./UiPopover.vue";

const props = defineProps({
  text: String,
  shortcut: String,
  side: { type: String, default: "bottom" },
  delay: { type: Number, default: 450 },
  disabled: Boolean,
});

const id = useId();
const trigger = ref(null);
const open = ref(false);
let timer = null;

function show() {
  if (props.disabled || (!props.text && !props.shortcut)) return;
  clearTimeout(timer);
  timer = setTimeout(() => (open.value = true), props.delay);
}
function hide() {
  clearTimeout(timer);
  open.value = false;
}
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <span
    ref="trigger"
    class="inline-flex"
    :aria-describedby="open ? id : undefined"
    @pointerenter="show"
    @pointerleave="hide"
    @pointerdown="hide"
    @focusin="show"
    @focusout="hide"
  >
    <slot />
  </span>
  <UiPopover
    :open="open"
    :anchor="trigger"
    :side="props.side"
    align="center"
    :offset="8"
    :dismissable="false"
    :trap="false"
    surface="tooltip"
    :popover-id="id"
    role="tooltip"
  >
    <span class="flex items-center gap-2 whitespace-nowrap">
      <span>{{ props.text }}</span>
      <UiKbd v-if="props.shortcut">{{ props.shortcut }}</UiKbd>
    </span>
  </UiPopover>
</template>
