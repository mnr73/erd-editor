<script setup>
import { computed } from "vue";

import { useI18n } from "vue-i18n";

import {
  contentBounds,
  groupRect,
  tableRect,
  unionRects,
} from "@/model/geometry";
import { useDocumentStore } from "@/stores/document";
import { useEditorStore } from "@/stores/editor";

import { useCanvasCamera } from "./useCanvasCamera";
import { minimapTransform, visibleWorldRect } from "./viewport";

/** Overview of the diagram + the visible area. Click / drag moves the camera. */
const W = 180;
const H = 110;

const { t } = useI18n();
const doc = useDocumentStore();
const editor = useEditorStore();
const { view, size, set } = useCanvasCamera();

const visible = computed(() => visibleWorldRect(view.value, size.value));
const bounds = computed(() =>
  unionRects([visible.value, contentBounds(doc.doc)].filter(Boolean)),
);
const tf = computed(() => minimapTransform(bounds.value, { w: W, h: H }));

const toMini = (r) => ({
  left: `${r.x * tf.value.scale + tf.value.ox}px`,
  top: `${r.y * tf.value.scale + tf.value.oy}px`,
  width: `${Math.max(2, r.w * tf.value.scale)}px`,
  height: `${Math.max(2, r.h * tf.value.scale)}px`,
});

const groups = computed(() =>
  doc.doc.groups.map((g) => ({
    id: g.id,
    color: g.color,
    style: toMini(groupRect(g)),
  })),
);
const tables = computed(() =>
  doc.doc.tables.map((tb) => ({
    id: tb.id,
    color: tb.color,
    style: toMini(tableRect(tb)),
  })),
);
const frame = computed(() => toMini(visible.value));

function moveTo(e) {
  const box = e.currentTarget.getBoundingClientRect();
  const wx = (e.clientX - box.left - tf.value.ox) / tf.value.scale;
  const wy = (e.clientY - box.top - tf.value.oy) / tf.value.scale;
  // center the camera on that world point
  set({
    zoom: view.value.zoom,
    x: editor.viewportSize.w / 2 - wx * view.value.zoom,
    y: editor.viewportSize.h / 2 - wy * view.value.zoom,
  });
}
function onDown(e) {
  e.currentTarget.setPointerCapture(e.pointerId);
  moveTo(e);
}
function onMove(e) {
  if (e.currentTarget.hasPointerCapture(e.pointerId)) moveTo(e);
}
</script>

<template>
  <div
    role="img"
    :aria-label="t('canvas.minimap')"
    class="absolute bottom-4 inset-e-4 cursor-pointer overflow-hidden rounded-chip border border-line bg-panel"
    :style="{ width: `${W}px`, height: `${H}px` }"
    @pointerdown.stop="onDown"
    @pointermove="onMove"
    @wheel.stop
  >
    <div
      v-for="g in groups"
      :key="g.id"
      class="absolute rounded-[2px] border"
      :style="{
        ...g.style,
        borderColor: g.color ?? 'var(--c-faint)',
        opacity: 0.5,
      }"
    />
    <div
      v-for="tb in tables"
      :key="tb.id"
      class="absolute rounded-[1.5px] opacity-80"
      :style="{ ...tb.style, background: tb.color ?? 'var(--c-faint)' }"
    />
    <div
      class="pointer-events-none absolute rounded-[3px] border-[1.5px] border-accent-text"
      :style="frame"
    />
  </div>
</template>
