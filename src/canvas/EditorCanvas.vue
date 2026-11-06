<script setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch,
} from "vue";

import { useI18n } from "vue-i18n";

import { fkColumnKeys } from "@/model/document";
import { useDocumentStore } from "@/stores/document";
import { useEditorStore } from "@/stores/editor";

import CanvasGroup from "./CanvasGroup.vue";
import CanvasMinimap from "./CanvasMinimap.vue";
import CanvasTable from "./CanvasTable.vue";
import {
  groupRect,
  rectContains,
  rectFromPoints,
  rectsIntersect,
  tableRect,
} from "./geometry";
import { useCanvasCamera } from "./useCanvasCamera";
import { screenToWorld } from "./viewport";

/**
 * The infinite canvas: dot grid, pan / zoom, selection (click, shift, marquee), dragging tables and
 * sections. Everything lives in one transformed "world" layer; items are positioned in world units.
 * Dragging only moves a live offset (cheap); the document is written once, on drop (one undo step).
 */
const DRAG_THRESHOLD = 3;

const { locale } = useI18n();
const doc = useDocumentStore();
const editor = useEditorStore();
const camera = useCanvasCamera();
const root = useTemplateRef("root");

const uiDir = computed(() => (locale.value === "fa" ? "rtl" : "ltr"));
const view = camera.view;

/* --------------------------------- derived ---------------------------------- */

const fkKeys = computed(() => fkColumnKeys(doc.doc));
const indexKeys = computed(() => {
  const keys = new Set();
  for (const t of doc.doc.tables)
    for (const ix of t.indexes)
      for (const c of ix.columns) keys.add(`${t.id}.${c}`);
  return keys;
});
const memberCounts = computed(() => {
  const counts = new Map();
  for (const t of doc.doc.tables)
    if (t.groupId) counts.set(t.groupId, (counts.get(t.groupId) ?? 0) + 1);
  return counts;
});

/** Ids that follow the pointer while dragging: selected items + members of selected sections. */
const dragIds = computed(() => {
  const ids = new Set(editor.selected);
  for (const t of doc.doc.tables)
    if (t.groupId && editor.selected.has(t.groupId)) ids.add(t.id);
  return ids;
});

/* ---------------------------------- state ----------------------------------- */

const drag = ref(null); // { startX, startY, dx, dy, moved }
const marquee = ref(null); // { a, b } in screen px relative to the canvas
const panning = ref(null); // { x, y }
const spaceDown = ref(false);

const panMode = computed(() => editor.tool === "pan" || spaceDown.value);
const cursor = computed(() =>
  panning.value ? "grabbing" : panMode.value ? "grab" : "default",
);

const worldStyle = computed(() => ({
  transform: `translate(${view.value.x}px, ${view.value.y}px) scale(${view.value.zoom})`,
}));
const gridStyle = computed(() => {
  const s = 16 * view.value.zoom;
  // dots fade out when they would be denser than ~6px
  return {
    backgroundSize: `${s}px ${s}px`,
    backgroundPosition: `${view.value.x}px ${view.value.y}px`,
    backgroundImage: s < 6 ? "none" : undefined,
  };
});
const marqueeStyle = computed(() => {
  if (!marquee.value) return null;
  const r = rectFromPoints(marquee.value.a, marquee.value.b);
  return {
    left: `${r.x}px`,
    top: `${r.y}px`,
    width: `${r.w}px`,
    height: `${r.h}px`,
  };
});

/* --------------------------------- helpers ---------------------------------- */

function localPoint(e) {
  const box = root.value.getBoundingClientRect();
  return { x: e.clientX - box.left, y: e.clientY - box.top };
}

/* ------------------------------- camera input -------------------------------- */

function onWheel(e) {
  e.preventDefault();
  const p = localPoint(e);
  if (e.ctrlKey || e.metaKey) {
    // pinch (ctrlKey from trackpads) and Ctrl+wheel: smooth multiplicative zoom
    camera.zoomBy(Math.exp(-e.deltaY * 0.0022), p);
  } else {
    camera.pan(e.shiftKey ? -e.deltaY : -e.deltaX, e.shiftKey ? 0 : -e.deltaY);
  }
}

function startPan(e) {
  panning.value = { x: e.clientX, y: e.clientY };
  root.value.setPointerCapture(e.pointerId);
}

/* ---------------------------- pointer: empty canvas -------------------------- */

function onPointerDown(e) {
  if (e.button === 1 || (e.button === 0 && panMode.value)) {
    e.preventDefault();
    return startPan(e);
  }
  if (e.button !== 0) return;
  // empty canvas (tables / group chips stop propagation themselves)
  if (!e.shiftKey) editor.clearSelection();
  marquee.value = {
    a: localPoint(e),
    b: localPoint(e),
    base: new Set(e.shiftKey ? editor.selected : []),
  };
  root.value.setPointerCapture(e.pointerId);
}

function onPointerMove(e) {
  if (panning.value) {
    camera.pan(e.clientX - panning.value.x, e.clientY - panning.value.y);
    panning.value = { x: e.clientX, y: e.clientY };
  } else if (marquee.value) {
    marquee.value = { ...marquee.value, b: localPoint(e) };
    selectInMarquee();
  } else if (drag.value) {
    const dx = (e.clientX - drag.value.startX) / view.value.zoom;
    const dy = (e.clientY - drag.value.startY) / view.value.zoom;
    const moved =
      drag.value.moved ||
      Math.hypot(e.clientX - drag.value.startX, e.clientY - drag.value.startY) >
        DRAG_THRESHOLD;
    drag.value = {
      ...drag.value,
      dx: moved ? dx : 0,
      dy: moved ? dy : 0,
      moved,
    };
  }
}

function onPointerUp(e) {
  if (root.value.hasPointerCapture?.(e.pointerId))
    root.value.releasePointerCapture(e.pointerId);
  panning.value = null;
  marquee.value = null;
  if (drag.value) finishDrag();
}

function selectInMarquee() {
  const a = screenToWorld(view.value, marquee.value.a);
  const b = screenToWorld(view.value, marquee.value.b);
  const box = rectFromPoints(a, b);
  const ids = new Set(marquee.value.base);
  for (const t of doc.doc.tables)
    if (rectsIntersect(box, tableRect(t))) ids.add(t.id);
  // a section is picked only when the marquee fully covers it (otherwise it would always win)
  for (const g of doc.doc.groups)
    if (rectContains(box, groupRect(g))) ids.add(g.id);
  editor.setSelection(ids);
}

/* ------------------------------ pointer: items ------------------------------- */

function onItemDown(e, id) {
  if (e.button === 1 || (e.button === 0 && panMode.value)) return; // let the canvas pan
  if (e.button !== 0) return;
  e.stopPropagation();
  if (e.shiftKey) editor.toggle(id);
  else if (!editor.isSelected(id)) editor.setSelection([id]);
  if (!editor.isSelected(id)) return; // shift-click deselected it: nothing to drag
  drag.value = {
    startX: e.clientX,
    startY: e.clientY,
    dx: 0,
    dy: 0,
    moved: false,
    pressedId: id,
    shift: e.shiftKey,
  };
  root.value.setPointerCapture(e.pointerId);
}

function finishDrag() {
  const d = drag.value;
  drag.value = null;
  if (d.moved) {
    doc.moveItems([...editor.selected], d.dx, d.dy);
  } else if (!d.shift && editor.selected.size > 1) {
    // plain click on one of several selected items narrows the selection to it
    editor.setSelection([d.pressedId]);
  }
}

function onContextMenu(e) {
  e.preventDefault(); // real context menus arrive in stage 9
}

/* --------------------------------- keyboard ---------------------------------- */

const isTyping = (e) =>
  ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) ||
  e.target.isContentEditable;

function onKeyDown(e) {
  if (isTyping(e)) return;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();

  if (e.code === "Space") {
    if (!spaceDown.value) spaceDown.value = true;
    e.preventDefault();
  } else if (mod && (k === "=" || k === "+")) {
    e.preventDefault();
    camera.zoomStep(1);
  } else if (mod && (k === "-" || k === "_")) {
    e.preventDefault();
    camera.zoomStep(-1);
  } else if (mod && k === "0") {
    e.preventDefault();
    camera.zoomTo(1);
  } else if (mod && k === "a") {
    e.preventDefault();
    editor.setSelection([
      ...doc.doc.tables.map((t) => t.id),
      ...doc.doc.groups.map((g) => g.id),
    ]);
  } else if (mod && k === "z") {
    e.preventDefault();
    e.shiftKey ? doc.redo() : doc.undo();
  } else if (mod && k === "y") {
    e.preventDefault();
    doc.redo();
  } else if (e.shiftKey && !mod && e.code === "Digit1") {
    camera.fitAll();
  } else if (e.shiftKey && !mod && e.code === "Digit2") {
    camera.fitSelection(editor.selected);
  } else if (!mod && !e.shiftKey && k === "v") {
    editor.setTool("select");
  } else if (!mod && !e.shiftKey && k === "h") {
    editor.setTool("pan");
  } else if (k === "escape") {
    editor.clearSelection();
  }
}
function onKeyUp(e) {
  if (e.code === "Space") spaceDown.value = false;
}

/* ------------------------------- lifecycle ----------------------------------- */

let observer = null;
let needsFit = true;
let fitTimer = null;

// A file that never stored a camera is shown fitted; one that did keeps its camera.
// The window / layout resizes a few times while starting, so fit once the size has settled.
function maybeFit() {
  if (!needsFit || !editor.viewportSize.w) return;
  clearTimeout(fitTimer);
  fitTimer = setTimeout(() => {
    needsFit = false;
    const v = doc.doc.view;
    if (v.x === 0 && v.y === 0 && v.zoom === 1) camera.fitAll();
  }, 120);
}

onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    editor.setViewportSize(width, height);
    maybeFit();
  });
  observer.observe(root.value);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => (spaceDown.value = false));
  root.value.addEventListener("wheel", onWheel, { passive: false });
});
onBeforeUnmount(() => {
  clearTimeout(fitTimer);
  observer?.disconnect();
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  root.value?.removeEventListener("wheel", onWheel);
});

watch(
  () => doc.loadId,
  () => {
    needsFit = true;
    editor.clearSelection();
    maybeFit();
  },
);
// keep the selection free of ids that were deleted / undone away
watch(
  () => [doc.doc.tables, doc.doc.groups],
  () =>
    editor.prune(
      new Set([
        ...doc.doc.tables.map((t) => t.id),
        ...doc.doc.groups.map((g) => g.id),
      ]),
    ),
);

defineExpose({ camera });
</script>

<template>
  <div
    ref="root"
    class="canvas-grid relative h-full w-full touch-none overflow-hidden"
    :style="{ ...gridStyle, cursor }"
    role="application"
    aria-roledescription="diagram canvas"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @contextmenu="onContextMenu"
  >
    <div
      class="absolute top-0 left-0 origin-top-left"
      dir="ltr"
      :style="worldStyle"
    >
      <CanvasGroup
        v-for="g in doc.doc.groups"
        :key="g.id"
        :group="g"
        :member-count="memberCounts.get(g.id) ?? 0"
        :selected="editor.isSelected(g.id)"
        :dragging="!!drag?.moved && dragIds.has(g.id)"
        :dx="drag?.moved && dragIds.has(g.id) ? drag.dx : 0"
        :dy="drag?.moved && dragIds.has(g.id) ? drag.dy : 0"
        :ui-dir="uiDir"
        @pointerdown="onItemDown($event, g.id)"
      />
      <CanvasTable
        v-for="t in doc.doc.tables"
        :key="t.id"
        :table="t"
        :selected="editor.isSelected(t.id)"
        :dragging="!!drag?.moved && dragIds.has(t.id)"
        :dx="drag?.moved && dragIds.has(t.id) ? drag.dx : 0"
        :dy="drag?.moved && dragIds.has(t.id) ? drag.dy : 0"
        :fk-keys="fkKeys"
        :index-keys="indexKeys"
        @pointerdown="onItemDown($event, t.id)"
        @toggle-collapse="doc.updateTable(t.id, { collapsed: !t.collapsed })"
      />
    </div>

    <div
      v-if="marqueeStyle"
      class="pointer-events-none absolute rounded-[3px] border border-accent bg-accent-soft"
      :style="marqueeStyle"
    />

    <slot />
    <CanvasMinimap />
  </div>
</template>
