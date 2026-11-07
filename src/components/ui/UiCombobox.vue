<script setup>
import { computed, ref, watch } from "vue";

import { nextIndex } from "@/utils/listNav";

import UiInput from "./UiInput.vue";

/**
 * Text field with a suggestion list under it. Free text always allowed. `suggest(query)` returns
 * an array of strings. Arrow keys move, Enter / Tab accept the highlighted suggestion (only when one
 * is highlighted, otherwise Enter keeps the typed text), Escape closes the list.
 */
const model = defineModel({ type: String, default: "" });
const props = defineProps({
  suggest: { type: Function, required: true },
  mono: Boolean,
  label: String,
  placeholder: String,
});
const emit = defineEmits(["enter"]);

const open = ref(false);
const active = ref(-1);

const items = computed(() => (open.value ? props.suggest(model.value) : []));
watch(items, () => (active.value = -1));

function accept(value) {
  model.value = value;
  open.value = false;
  active.value = -1;
}
function onKey(e) {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    if (!items.value.length) {
      open.value = true;
      return;
    }
    e.preventDefault();
    active.value = nextIndex(
      active.value,
      items.value.length,
      e.key === "ArrowDown" ? 1 : -1,
    );
  } else if (e.key === "Enter") {
    if (active.value >= 0 && items.value[active.value]) {
      e.preventDefault();
      e.stopPropagation();
      accept(items.value[active.value]);
    } else {
      open.value = false;
      emit("enter");
    }
  } else if (e.key === "Escape" && open.value) {
    e.stopPropagation();
    open.value = false;
  }
}
</script>

<template>
  <div
    class="relative min-w-0"
    @focusin="open = true"
    @focusout="open = false"
    @keydown="onKey"
  >
    <UiInput
      v-model="model"
      :mono="props.mono"
      :label="props.label"
      :placeholder="props.placeholder"
    />
    <ul
      v-if="items.length"
      role="listbox"
      class="absolute inset-x-0 top-full z-10 mt-1 max-h-44 overflow-auto rounded-control bg-popover py-1 shadow-popover"
      dir="ltr"
    >
      <li
        v-for="(it, i) in items"
        :key="it"
        role="option"
        :aria-selected="i === active"
        class="cursor-pointer px-2 py-1 font-mono text-ui-115 text-fg-soft"
        :class="i === active ? 'bg-hover text-fg' : 'hover:bg-hover'"
        @pointerdown.prevent="accept(it)"
        @pointerenter="active = i"
      >
        {{ it }}
      </li>
    </ul>
  </div>
</template>
