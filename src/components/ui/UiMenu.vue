<script setup>
import { nextTick, ref, watch } from "vue";

import UiKbd from "./UiKbd.vue";

/**
 * Generic menu list. `items`: [{ id, label, icon?, shortcut?, danger?, disabled?, checked? }]
 * or `{ separator: true }`. Emits `select(item)`. Arrow keys / Home / End / Enter.
 * Icon is a component (import it from "@/icons"); it is passed through, never baked in.
 */
const props = defineProps({
  items: { type: Array, required: true },
  label: String,
});
const emit = defineEmits(["select"]);

const list = ref(null);
const active = ref(-1);

const enabled = () =>
  props.items
    .map((it, i) => (it.separator || it.disabled ? -1 : i))
    .filter((i) => i >= 0);

function move(delta) {
  const idx = enabled();
  if (!idx.length) return;
  const at = idx.indexOf(active.value);
  active.value = idx[(at + delta + idx.length) % idx.length];
}
function onKey(e) {
  if (e.key === "ArrowDown") (e.preventDefault(), move(1));
  else if (e.key === "ArrowUp") (e.preventDefault(), move(-1));
  else if (e.key === "Home")
    (e.preventDefault(), (active.value = enabled()[0] ?? -1));
  else if (e.key === "End")
    (e.preventDefault(), (active.value = enabled().at(-1) ?? -1));
  else if ((e.key === "Enter" || e.key === " ") && active.value >= 0) {
    e.preventDefault();
    pick(props.items[active.value]);
  }
}
function pick(item) {
  if (item.disabled || item.separator) return;
  emit("select", item);
}

watch(active, async () => {
  await nextTick();
  list.value
    ?.querySelector("[data-active='true']")
    ?.scrollIntoView({ block: "nearest" });
});
defineExpose({ focus: () => list.value?.focus() });
</script>

<template>
  <div
    ref="list"
    role="menu"
    tabindex="0"
    :aria-label="props.label"
    class="min-w-48 p-1 outline-none"
    @keydown="onKey"
  >
    <template v-for="(item, i) in props.items" :key="item.id ?? `sep-${i}`">
      <div v-if="item.separator" role="separator" class="my-1 h-px bg-line" />
      <button
        v-else
        type="button"
        role="menuitem"
        :disabled="item.disabled"
        :data-active="active === i"
        class="flex h-7 w-full items-center gap-2 rounded-chip px-2 text-start text-xs disabled:opacity-40"
        :class="[
          item.danger ? 'text-danger' : 'text-fg',
          active === i ? 'bg-hover' : 'hover:bg-hover',
        ]"
        @pointerenter="active = i"
        @click="pick(item)"
      >
        <span
          class="inline-flex size-4 shrink-0 items-center justify-center text-muted"
        >
          <component :is="item.icon" v-if="item.icon" class="size-4" />
        </span>
        <span class="flex-1 truncate">{{ item.label }}</span>
        <span v-if="item.checked" class="text-accent-text">✓</span>
        <UiKbd v-if="item.shortcut">{{ item.shortcut }}</UiKbd>
      </button>
    </template>
  </div>
</template>
