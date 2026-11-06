<script setup>
import { ref } from "vue";

import UiMenu from "./UiMenu.vue";
import UiPopover from "./UiPopover.vue";

/**
 * Right-click menu at a point. Parent calls `ref.value.show(event, items)`; selecting emits
 * `select(item)` and closes. Items are passed per call because the menu differs per target
 * (canvas, table, column, relation).
 */
const emit = defineEmits(["select"]);

const open = ref(false);
const point = ref({ x: 0, y: 0 });
const items = ref([]);
const menu = ref(null);

function show(event, nextItems) {
  event.preventDefault();
  point.value = { x: event.clientX, y: event.clientY };
  items.value = nextItems;
  open.value = true;
}
function onSelect(item) {
  open.value = false;
  emit("select", item);
}
defineExpose({ show, hide: () => (open.value = false) });
</script>

<template>
  <UiPopover
    v-model:open="open"
    :anchor="point"
    side="bottom"
    align="start"
    :offset="0"
    role="presentation"
  >
    <UiMenu ref="menu" :items="items" @select="onSelect" />
  </UiPopover>
</template>
