<script setup>
import { computed } from "vue";

import { RESIZE_HANDLES } from "@/model/geometry";

/**
 * Section frame behind the tables. The frame itself ignores the pointer (so box-selection and
 * clicks reach what is under it); only the title chip and, when selected, the 8 resize handles are
 * interactive, like FigJam sections.
 */
const props = defineProps({
  group: { type: Object, required: true },
  memberCount: { type: Number, default: 0 },
  selected: Boolean,
  dragging: Boolean,
  dx: { type: Number, default: 0 },
  dy: { type: Number, default: 0 },
  // live rect while a resize drag is running; null otherwise
  resizing: { type: Object, default: null },
  uiDir: { type: String, default: "ltr" }, // the chip sits at the start edge of the UI language
  zoom: { type: Number, default: 1 },
});
const emit = defineEmits(["pointerdown", "resize-start"]);

const color = computed(() => props.group.color ?? "#8792A6");
const mix = (pct, base = "transparent") =>
  `color-mix(in srgb, ${color.value} ${pct}%, ${base})`;

const rect = computed(() => props.resizing ?? props.group);

// Handles keep a constant on-screen size whatever the zoom
const HANDLE = 9;
const handleSize = computed(() => HANDLE / props.zoom);
const half = computed(() => handleSize.value / 2);
const EDGE_HIT = 8; // px of the invisible edge strips that start a resize

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
const isCorner = (h) => h.length === 2;
const edges = computed(() => {
  const t = EDGE_HIT / props.zoom;
  return [
    {
      h: "n",
      style: {
        top: `${-t / 2}px`,
        left: 0,
        right: 0,
        height: `${t}px`,
        cursor: CURSOR.n,
      },
    },
    {
      h: "s",
      style: {
        bottom: `${-t / 2}px`,
        left: 0,
        right: 0,
        height: `${t}px`,
        cursor: CURSOR.s,
      },
    },
    {
      h: "w",
      style: {
        left: `${-t / 2}px`,
        top: 0,
        bottom: 0,
        width: `${t}px`,
        cursor: CURSOR.w,
      },
    },
    {
      h: "e",
      style: {
        right: `${-t / 2}px`,
        top: 0,
        bottom: 0,
        width: `${t}px`,
        cursor: CURSOR.e,
      },
    },
  ];
});
</script>

<template>
  <div
    class="pointer-events-none absolute"
    :style="{
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.w}px`,
      height: `${rect.h}px`,
      transform:
        props.dx || props.dy
          ? `translate(${props.dx}px, ${props.dy}px)`
          : undefined,
      zIndex: 0,
    }"
    :data-group-id="props.group.id"
  >
    <div
      class="absolute inset-0 rounded-[10px]"
      :class="props.selected ? 'border-2 border-accent' : 'border'"
      :style="{
        background: mix(props.selected ? 10 : 6),
        borderColor: props.selected ? undefined : mix(30),
        boxShadow: props.selected
          ? '0 0 0 4px var(--c-accent-soft)'
          : undefined,
      }"
    />
    <div class="absolute inset-x-0 -top-[11px] flex px-4" :dir="props.uiDir">
      <span
        class="pointer-events-auto flex h-[22px] cursor-grab items-center gap-1.5 rounded-chip border px-2.5 text-[11.5px] font-semibold active:cursor-grabbing"
        :style="{
          background: props.selected
            ? 'var(--c-accent)'
            : mix(18, 'var(--c-card)'),
          borderColor: props.selected ? 'var(--c-accent)' : mix(45),
          color: props.selected ? 'var(--c-accent-fg)' : mix(60, 'var(--c-fg)'),
        }"
        @pointerdown="emit('pointerdown', $event)"
      >
        {{ props.group.name }}
        <span class="font-normal opacity-75">{{ props.memberCount }}</span>
      </span>
    </div>

    <!-- resize: invisible edge strips + 8 visible handles, only while selected -->
    <template v-if="props.selected">
      <div
        v-for="e in edges"
        :key="`edge-${e.h}`"
        class="pointer-events-auto absolute"
        :style="e.style"
        :data-resize="e.h"
        @pointerdown.stop="emit('resize-start', $event, e.h)"
      />
      <div
        v-for="h in RESIZE_HANDLES"
        :key="h"
        class="pointer-events-auto absolute border-[1.5px] border-accent bg-canvas"
        :class="isCorner(h) ? 'rounded-[2px]' : 'rounded-[2px] opacity-0'"
        :style="handleStyle(h)"
        :data-resize="h"
        @pointerdown.stop="emit('resize-start', $event, h)"
      />
    </template>
  </div>
</template>
