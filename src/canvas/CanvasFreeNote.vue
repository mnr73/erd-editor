<script setup>
import { computed, nextTick, useTemplateRef, watch } from "vue";

import { RESIZE_HANDLES } from "@/model/geometry";
import { DEFAULT_NOTE_COLOR } from "@/model/palette";

/**
 * A free sticky note: a coloured card placed anywhere on the canvas, independent of tables and
 * sections. Drag it by its body, resize it with the 8 handles while selected, double-click (or just
 * create it) to type inline. The tint follows `note.color`; text stays in the workspace font.
 */
const props = defineProps({
  note: { type: Object, required: true }, // { id, text, color, x, y, w, h }
  selected: Boolean,
  dragging: Boolean,
  dx: { type: Number, default: 0 },
  dy: { type: Number, default: 0 },
  resizing: { type: Object, default: null }, // live rect during a resize drag
  editing: Boolean,
  zoom: { type: Number, default: 1 },
  placeholder: { type: String, default: "" },
});
const emit = defineEmits([
  "pointerdown",
  "resize-start",
  "text",
  "stop-edit",
  "menu",
]);

const area = useTemplateRef("area");
const rect = computed(() => props.resizing ?? props.note);
const color = computed(() => props.note.color ?? DEFAULT_NOTE_COLOR);
const mix = (pct, base = "var(--c-card)") =>
  `color-mix(in srgb, ${color.value} ${pct}%, ${base})`;

const HANDLE = 9;
const handleSize = computed(() => HANDLE / props.zoom);
const half = computed(() => handleSize.value / 2);
const EDGE_HIT = 8;
const CURSOR = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};
const isCorner = (h) => h.length === 2;

function handleStyle(h) {
  const s = handleSize.value;
  const o = -half.value;
  const style = { width: `${s}px`, height: `${s}px`, cursor: CURSOR[h] };
  if (h.includes("n")) style.top = `${o}px`;
  else if (h.includes("s")) style.bottom = `${o}px`;
  else style.top = `calc(50% - ${half.value}px)`;
  if (h.includes("w")) style.left = `${o}px`;
  else if (h.includes("e")) style.right = `${o}px`;
  else style.left = `calc(50% - ${half.value}px)`;
  return style;
}
const edges = computed(() => {
  const t = EDGE_HIT / props.zoom;
  const box = (h, style) => ({ h, style: { ...style, cursor: CURSOR[h] } });
  return [
    box("n", { top: `${-t / 2}px`, left: 0, right: 0, height: `${t}px` }),
    box("s", { bottom: `${-t / 2}px`, left: 0, right: 0, height: `${t}px` }),
    box("w", { left: `${-t / 2}px`, top: 0, bottom: 0, width: `${t}px` }),
    box("e", { right: `${-t / 2}px`, top: 0, bottom: 0, width: `${t}px` }),
  ];
});

watch(
  () => props.editing,
  async (v) => {
    if (!v) return;
    await nextTick();
    area.value?.focus({ preventScroll: true });
    const n = area.value?.value.length ?? 0;
    area.value?.setSelectionRange(n, n);
  },
  { immediate: true },
);
</script>

<template>
  <div
    class="absolute z-[3] flex flex-col rounded-[8px] border font-sans text-[12.5px] leading-[1.7] text-fg shadow-table"
    :class="[props.dragging ? 'cursor-grabbing' : 'cursor-grab']"
    :style="{
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.w}px`,
      height: `${rect.h}px`,
      transform:
        props.dx || props.dy
          ? `translate(${props.dx}px, ${props.dy}px)`
          : undefined,
      background: mix(15),
      borderColor: props.selected ? 'var(--c-accent)' : mix(55, 'transparent'),
      borderWidth: props.selected ? '2px' : '1px',
      boxShadow: props.selected ? '0 0 0 4px var(--c-accent-soft)' : undefined,
    }"
    :data-free-note="props.note.id"
    data-workspace
    @pointerdown="emit('pointerdown', $event)"
    @contextmenu.stop.prevent="emit('menu', $event)"
  >
    <div
      class="pointer-events-none h-1 shrink-0 rounded-t-[7px]"
      :style="{ background: color }"
    />
    <textarea
      v-if="props.editing"
      ref="area"
      :value="props.note.text"
      :placeholder="props.placeholder"
      dir="auto"
      spellcheck="false"
      class="min-h-0 w-full flex-1 cursor-text resize-none bg-transparent px-2.5 py-2 text-[12.5px] leading-[1.7] text-fg outline-none placeholder:text-muted"
      data-free-note-text
      @pointerdown.stop
      @input="emit('text', $event.target.value)"
      @blur="emit('stop-edit')"
      @keydown.esc.stop.prevent="emit('stop-edit')"
    />
    <div
      v-else
      class="min-h-0 flex-1 overflow-hidden px-2.5 py-2 break-words whitespace-pre-wrap"
      dir="auto"
    >
      <template v-if="props.note.text">{{ props.note.text }}</template>
      <span v-else class="text-muted">{{ props.placeholder }}</span>
    </div>

    <template v-if="props.selected && !props.editing">
      <div
        v-for="e in edges"
        :key="`edge-${e.h}`"
        class="absolute z-[1]"
        :style="e.style"
        :data-resize="e.h"
        @pointerdown.stop="emit('resize-start', $event, e.h)"
      />
      <div
        v-for="h in RESIZE_HANDLES"
        :key="h"
        class="absolute border-[1.5px] border-accent bg-canvas"
        :class="isCorner(h) ? 'rounded-[2px]' : 'rounded-[2px] opacity-0'"
        :style="handleStyle(h)"
        :data-resize="h"
        @pointerdown.stop="emit('resize-start', $event, h)"
      />
    </template>
  </div>
</template>
