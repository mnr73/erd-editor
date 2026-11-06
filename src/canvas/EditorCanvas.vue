<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch,
} from "vue";

import { useI18n } from "vue-i18n";

import UiColorPalette from "@/components/ui/UiColorPalette.vue";
import UiContextMenu from "@/components/ui/UiContextMenu.vue";
import UiPopover from "@/components/ui/UiPopover.vue";

import {
  IconColIndex,
  IconCopy,
  IconDelete,
  IconEdit,
  IconNote,
  IconRelationSwap,
  IconToolTable,
} from "@/icons";
import { fkColumnKeys } from "@/model/document";
import {
  groupMembership,
  groupRect,
  movedWith,
  rectContains,
  rectFromPoints,
  rectsIntersect,
  resizeRect,
  tableRect,
} from "@/model/geometry";
import { inTableOrder } from "@/model/indexes";
import {
  anchorY,
  columnKeysOf,
  focusedRefIds,
  layoutRefs,
  routeRef,
} from "@/model/relations";
import { useDocumentStore } from "@/stores/document";
import { useEditorStore } from "@/stores/editor";

import CanvasGroup from "./CanvasGroup.vue";
import CanvasMinimap from "./CanvasMinimap.vue";
import CanvasRelations from "./CanvasRelations.vue";
import CanvasTable from "./CanvasTable.vue";
import ColumnEditor from "./ColumnEditor.vue";
import IndexEditor from "./IndexEditor.vue";
import RelationEditor from "./RelationEditor.vue";
import { useCanvasCamera } from "./useCanvasCamera";
import { screenToWorld, worldToScreen } from "./viewport";

/**
 * The infinite canvas: dot grid, pan / zoom, selection (click, shift, marquee), dragging tables and
 * sections. Everything lives in one transformed "world" layer; items are positioned in world units.
 * Dragging only moves a live offset (cheap); the document is written once, on drop (one undo step).
 */
const DRAG_THRESHOLD = 3;

const { locale, t } = useI18n();
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
/* -------------------------------- relations ---------------------------------- */

/** Document as the user sees it right now: tables shifted by the live drag offset. */
const liveDoc = computed(() => {
  if (!drag.value?.moved) return doc.doc;
  const { dx, dy } = drag.value;
  const moving = dragIds.value;
  return {
    ...doc.doc,
    tables: doc.doc.tables.map((t) =>
      moving.has(t.id) ? { ...t, x: t.x + dx, y: t.y + dy } : t,
    ),
  };
});
const refLayout = computed(() => layoutRefs(liveDoc.value));
const focusRefs = computed(() =>
  focusedRefIds(doc.doc, {
    refId: editor.selectedRefId,
    hoverRefId: editor.hoverRefId,
    columnSel: editor.columnSelection,
    tableIds: [...editor.selected].filter((id) => doc.tableById.has(id)),
  }),
);
const litKeys = computed(() =>
  columnKeysOf(doc.doc.refs.filter((r) => focusRefs.value.has(r.id))),
);

// Membership is derived: a table is in a section only when it lies completely inside it.
const membership = computed(() => groupMembership(doc.doc));
const memberCounts = computed(() => {
  const counts = new Map();
  for (const gid of membership.value.values())
    counts.set(gid, (counts.get(gid) ?? 0) + 1);
  return counts;
});

/** Ids that follow the pointer while dragging: selected items + everything inside selected sections. */
const dragIds = computed(() => {
  const { tables, groups } = movedWith(doc.doc, [...editor.selected]);
  return new Set([...editor.selected, ...tables, ...groups]);
});

/* ---------------------------------- state ----------------------------------- */

const drag = ref(null); // { startX, startY, dx, dy, moved }
const marquee = ref(null); // { a, b } in screen px relative to the canvas
const panning = ref(null); // { x, y }
const spaceDown = ref(false);
const resize = ref(null);
const link = ref(null); // { tableId, columnId, x, y (world), target: {tableId, columnId}|null } // { id, handle, startX, startY, rect, live }
const ctx = useTemplateRef("ctx");
const ctxTarget = ref(null); // what the open context menu was opened on
const colorFor = ref(null); // table id whose header-color popover is open
const colorAnchor = ref(null);
const columnAnchor = ref(null);
const columnOpen = computed({
  get: () => !!editor.columnPopover,
  set: (v) => !v && editor.closeColumnPopover(),
});
const colorOpen = computed({
  get: () => !!colorFor.value,
  set: (v) => !v && (colorFor.value = null),
});

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
  if (editor.tool === "table") {
    const p = worldPoint(e);
    placeTable(p);
    return;
  }
  // empty canvas (tables / group chips stop propagation themselves)
  if (!e.shiftKey) {
    editor.clearSelection();
    editor.selectRef(null);
  }
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
  } else if (link.value) {
    updateLink(e);
  } else if (resize.value) {
    const r = resize.value;
    const dx = (e.clientX - r.startX) / view.value.zoom;
    const dy = (e.clientY - r.startY) / view.value.zoom;
    resize.value = { ...r, live: resizeRect(r.rect, r.handle, dx, dy) };
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
  if (link.value) finishLink();
  if (resize.value) finishResize();
  if (drag.value) finishDrag();
}

/* --------------------------- drawing a relationship ------------------------- */

/** Start a line from a column's connector dot (or any row while the relation tool is active). */
function startLink(e, tableId, columnId) {
  if (e.button !== 0) return;
  e.stopPropagation();
  const p = worldPoint(e);
  link.value = { tableId, columnId, x: p.x, y: p.y, target: null };
  root.value.setPointerCapture(e.pointerId);
}

function updateLink(e) {
  const p = worldPoint(e);
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  const row = hit?.closest("[data-column-id]");
  const tb = row?.closest("[data-table-id]");
  const target =
    row && tb
      ? { tableId: tb.dataset.tableId, columnId: row.dataset.columnId }
      : null;
  link.value = { ...link.value, x: p.x, y: p.y, target };
}

function finishLink() {
  const l = link.value;
  link.value = null;
  if (!l?.target) return;
  const id = doc.connectColumns(
    l.tableId,
    l.columnId,
    l.target.tableId,
    l.target.columnId,
  );
  if (id) editor.selectRef(id);
  if (editor.tool === "relation") editor.setTool("select");
}

/** Preview line while dragging: from the source row to the pointer (snapped to the target row). */
const linkPreview = computed(() => {
  const l = link.value;
  if (!l) return null;
  const from = doc.tableById.get(l.tableId);
  if (!from) return null;
  const target = l.target && doc.tableById.get(l.target.tableId);
  const fakeRef = {
    from: { columns: [l.columnId] },
    to: { columns: [l.target?.columnId ?? ""] },
  };
  if (target) {
    const g = routeRef(fakeRef, from, target);
    return {
      d: g.d,
      tx: g.q.x,
      ty: g.q.y,
      sx: g.p.x,
      sy: g.p.y,
      snapped: true,
    };
  }
  const sx = from.x + (l.x >= from.x + 100 ? tableRect(from).w : 0);
  const sy = anchorY(from, l.columnId);
  const dir = l.x >= sx ? 1 : -1;
  const mx = (sx + l.x) / 2;
  return {
    d: `M${sx} ${sy}H${sx + dir * 12}C${mx} ${sy} ${mx} ${l.y} ${l.x} ${l.y}`,
    tx: l.x,
    ty: l.y,
    sx,
    sy,
    snapped: false,
  };
});

function startResize(e, id, handle) {
  if (e.button !== 0) return;
  e.stopPropagation();
  const g = doc.doc.groups.find((x) => x.id === id);
  resize.value = {
    id,
    handle,
    startX: e.clientX,
    startY: e.clientY,
    rect: groupRect(g),
    live: groupRect(g),
  };
  root.value.setPointerCapture(e.pointerId);
}

function finishResize() {
  const r = resize.value;
  resize.value = null;
  if (
    r?.live &&
    (r.live.x !== r.rect.x ||
      r.live.y !== r.rect.y ||
      r.live.w !== r.rect.w ||
      r.live.h !== r.rect.h)
  ) {
    doc.setGroupRect(r.id, r.live);
  }
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
  if (isDoubleDown(e, id)) {
    drag.value = null;
    return onItemDoubleClick(e, id);
  }
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

// Two presses on the same item within 350ms and 6px = a double-click.
let lastDown = { id: null, t: 0, x: 0, y: 0 };
function isDoubleDown(e, id) {
  const now = performance.now();
  const dbl =
    lastDown.id === id &&
    now - lastDown.t < 350 &&
    Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 6;
  lastDown = dbl
    ? { id: null, t: 0, x: 0, y: 0 }
    : { id, t: now, x: e.clientX, y: e.clientY };
  return dbl;
}

/** Double-click on a table: name in the header renames the table, a column row renames the column. */
function onItemDoubleClick(e, id) {
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  if (!hit || !doc.tableById.has(id)) return;
  const row = hit.closest("[data-column-id]");
  if (row) {
    editor.startRenameSoon({
      kind: "column",
      tableId: id,
      columnId: row.dataset.columnId,
    });
  } else if (hit.closest("header")) {
    editor.startRenameSoon({ kind: "table", tableId: id });
  }
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

const worldPoint = (e) => screenToWorld(view.value, localPoint(e));

/** Create a table centred on world point `p`, select it and start renaming it. */
function placeTable(p) {
  const id = doc.addDefaultTable({
    x: Math.round(p.x - 100),
    y: Math.round(p.y - 15),
  });
  editor.setSelection([id]);
  editor.setTool("select");
  editor.startRenameSoon({ kind: "table", tableId: id });
}

/**
 * Double-click on empty canvas creates a table. While an item is pressed the root holds pointer
 * capture, which makes the browser report `dblclick` on the root, so `e.target` can't be trusted:
 * ask what is really under the pointer instead. (Double-clicks on tables / columns are handled in
 * CanvasTable through `onItemDown`, see `clicks` below.)
 */
function onDoubleClick(e) {
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  if (
    hit?.closest(
      "[data-table-id], [data-group-id], [role=dialog], button, input",
    )
  )
    return;
  placeTable(worldPoint(e));
}

/* ------------------------------ context menus ------------------------------ */

const canvasItems = () => [
  {
    id: "new-table",
    label: t("menu.newTable"),
    icon: IconToolTable,
    shortcut: "T",
  },
];
const tableItems = (many) => [
  {
    id: "rename",
    label: t("menu.rename"),
    icon: IconEdit,
    shortcut: "F2",
    disabled: many,
  },
  { id: "color", label: t("menu.color"), icon: IconNote, disabled: false },
  {
    id: "indexes",
    label: t("menu.indexes"),
    icon: IconColIndex,
    shortcut: "Ctrl I",
    disabled: many,
  },
  {
    id: "duplicate",
    label: t("common.duplicate"),
    icon: IconCopy,
    shortcut: "Ctrl D",
  },
  { separator: true },
  {
    id: "delete",
    label: t("menu.deleteTable"),
    icon: IconDelete,
    danger: true,
    shortcut: "Del",
  },
];
const columnItems = (n = 1) => [
  {
    id: "edit-column",
    label: t("column.more"),
    icon: IconEdit,
    disabled: n > 1,
  },
  {
    id: "index-columns",
    label: n > 1 ? t("index.menuCreate", { n }) : t("index.menuOne"),
    icon: IconColIndex,
    shortcut: "Ctrl I",
  },
  { id: "insert-above", label: t("column.insertAbove"), icon: IconToolTable },
  { id: "insert-below", label: t("column.insertBelow"), icon: IconToolTable },
  { separator: true },
  {
    id: "delete-column",
    label: t("column.delete"),
    icon: IconDelete,
    danger: true,
  },
];

/** True when nothing but the bare canvas / world layer is under the pointer. */
function isEmptyCanvasAt(e) {
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  return (
    !!hit &&
    (hit === root.value ||
      hit.hasAttribute("data-world") ||
      !hit.closest(
        "[data-table-id], [data-group-id], [role=dialog], [role=img], button",
      ))
  );
}

function onContextMenu(e) {
  e.preventDefault();
  if (isEmptyCanvasAt(e)) {
    ctxTarget.value = { kind: "canvas", point: worldPoint(e) };
    ctx.value.show(e, canvasItems());
  }
}
function openTableMenu(e, table) {
  if (!editor.isSelected(table.id)) editor.setSelection([table.id]);
  ctxTarget.value = {
    kind: "table",
    tableId: table.id,
    anchor: { x: e.clientX, y: e.clientY },
  };
  ctx.value.show(e, tableItems(editor.selected.size > 1));
}
function openColumnMenu(e, table, columnId) {
  ctxTarget.value = {
    kind: "column",
    tableId: table.id,
    columnId,
    anchor: { x: e.clientX, y: e.clientY },
  };
  // right-clicking inside a multi-selection acts on all of it, otherwise on the clicked column
  const sel = editor.columnSelection;
  if (!(sel?.tableId === table.id && sel.ids.has(columnId)))
    editor.selectColumn(table, columnId);
  ctx.value.show(e, columnItems(editor.columnSelection?.ids.size ?? 1));
}

let lastRefDown = { id: null, t: 0 };
/** Click selects a line; a second click within 350ms opens its editor. */
function onPickRef(id, e) {
  editor.selectRef(id);
  const now = performance.now();
  if (lastRefDown.id === id && now - lastRefDown.t < 350) {
    lastRefDown = { id: null, t: 0 };
    editor.openRelationEditor(id, { x: e.clientX, y: e.clientY });
  } else lastRefDown = { id, t: now };
}

const refItems = () => [
  {
    id: "ref-edit",
    label: t("relation.edit"),
    icon: IconEdit,
    shortcut: "Enter",
  },
  { id: "ref-swap", label: t("relation.swap"), icon: IconRelationSwap },
  { separator: true },
  {
    id: "ref-delete",
    label: t("relation.delete"),
    icon: IconDelete,
    danger: true,
    shortcut: "Del",
  },
];
function openRefMenu(id, e) {
  editor.selectRef(id);
  ctxTarget.value = {
    kind: "ref",
    refId: id,
    anchor: { x: e.clientX, y: e.clientY },
  };
  ctx.value.show(e, refItems());
}

function onMenuSelect(item) {
  const target = ctxTarget.value;
  if (!target) return;
  const ids = [...editor.selected].filter((id) => doc.tableById.has(id));
  switch (item.id) {
    case "new-table":
      return placeTable(target.point);
    case "rename":
      return editor.startRename({ kind: "table", tableId: target.tableId });
    case "color":
      return openColor(target.tableId, target.anchor);
    case "duplicate":
      return duplicateSelected();
    case "delete":
      return deleteSelected(ids);
    case "edit-column":
      return editor.openColumnPopover(target.tableId, target.columnId);
    case "indexes":
      return openIndexes(target.tableId);
    case "index-columns":
      return openIndexForSelection(target.tableId, target.columnId);
    case "insert-above":
    case "insert-below": {
      const t0 = doc.tableById.get(target.tableId);
      const at =
        t0.columns.findIndex((c) => c.id === target.columnId) +
        (item.id === "insert-below" ? 1 : 0);
      const id = doc.addColumn(target.tableId, {}, at);
      return editor.startRename({
        kind: "column",
        tableId: target.tableId,
        columnId: id,
      });
    }
    case "ref-edit":
      return editor.openRelationEditor(target.refId, target.anchor);
    case "ref-swap":
      return doc.swapRef(target.refId);
    case "ref-delete":
      doc.removeRef(target.refId);
      return editor.selectRef(null);
    case "delete-column":
      return doc.removeColumn(target.tableId, target.columnId);
  }
}

/* -------------------------------- indexes ---------------------------------- */

/** Screen box around BOTH tables of the edited line: the popover opens beside it, clear of the line. */
const relationAnchor = computed(() => {
  const ed = editor.relationEditor;
  if (!ed) return null;
  const r = doc.doc.refs.find((x) => x.id === ed.refId);
  if (!r) return ed.anchor;
  const box = root.value?.getBoundingClientRect();
  const rects = [r.from.table, r.to.table]
    .map((id) => doc.tableById.get(id))
    .filter(Boolean)
    .map((tb) => {
      const w = tableRect(tb);
      const a = worldToScreen(view.value, { x: w.x, y: w.y });
      const b = worldToScreen(view.value, { x: w.x + w.w, y: w.y + w.h });
      return { l: a.x, t: a.y, r: b.x, b: b.y };
    });
  if (!rects.length || !box) return ed.anchor;
  const left = Math.min(...rects.map((x) => x.l)) + box.left;
  const right = Math.max(...rects.map((x) => x.r)) + box.left;
  const top = Math.min(...rects.map((x) => x.t)) + box.top;
  const bottom = Math.max(...rects.map((x) => x.b)) + box.top;
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
  };
});

const relationOpen = computed({
  get: () => !!editor.relationEditor,
  set: (v) => !v && editor.closeRelationEditor(),
});
const indexAnchor = ref(null);
const indexOpen = computed({
  get: () => !!editor.indexEditor,
  set: (v) => !v && editor.closeIndexEditor(),
});

function tableAnchor(tableId) {
  const el = root.value.querySelector(`[data-table-id="${tableId}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    left: r.left,
    right: r.right,
    top: r.top,
    bottom: r.bottom,
    width: r.width,
    height: r.height,
  };
}

async function showIndexEditor(tableId, options) {
  indexAnchor.value = tableAnchor(tableId);
  editor.openIndexEditor(tableId, options);
}
function openIndexFromColumn(indexId) {
  const v = editor.columnPopover;
  if (!v) return;
  const { tableId, columnId } = v;
  editor.closeColumnPopover();
  // an existing index opens expanded; "new" starts from this column
  showIndexEditor(
    tableId,
    indexId ? { focus: indexId } : { columns: [columnId] },
  );
}
const openIndexes = (tableId) => showIndexEditor(tableId, {});

/** Start a new index from the selected columns (or from `fallbackColumn` when none is selected). */
function openIndexForSelection(tableId, fallbackColumn = null) {
  const sel = editor.columnSelection;
  const ids =
    sel?.tableId === tableId && sel.ids.size
      ? [...sel.ids]
      : fallbackColumn
        ? [fallbackColumn]
        : [];
  const tb = doc.tableById.get(tableId);
  showIndexEditor(tableId, { columns: inTableOrder(tb, ids) });
}

function openColor(tableId, anchor) {
  // a DOMRect (header color dot) or a plain point (context menu)
  colorAnchor.value =
    anchor && "width" in anchor
      ? anchor
      : anchor
        ? { x: anchor.x, y: anchor.y }
        : null;
  colorFor.value = tableId;
}

function duplicateSelected() {
  const ids = [...editor.selected].filter((id) => doc.tableById.has(id));
  if (ids.length) editor.setSelection(doc.duplicateTables(ids));
}
function deleteSelected(ids = [...editor.selected]) {
  const tables = ids.filter((id) => doc.tableById.has(id));
  const groups = ids.filter((id) => doc.doc.groups.some((g) => g.id === id));
  if (tables.length) doc.removeTables(tables);
  for (const g of groups) doc.removeGroup(g);
  editor.clearSelection();
}

const colorTable = computed(() =>
  colorFor.value ? doc.tableById.get(colorFor.value) : null,
);
function setTableColor(color) {
  // a multi-selection gets the same color (the clicked table is part of it)
  const ids = editor.isSelected(colorFor.value)
    ? [...editor.selected].filter((id) => doc.tableById.has(id))
    : [colorFor.value];
  doc.commit((d) => {
    for (const tb of d.tables) if (ids.includes(tb.id)) tb.color = color;
  });
}

/** Screen rect of a column's "more" button (anchor for its popover). */
watch(
  () => editor.columnPopover,
  async (v) => {
    if (!v) return (columnAnchor.value = null);
    await nextTick();
    const tableEl = root.value.querySelector(`[data-table-id="${v.tableId}"]`);
    const rowEl = tableEl?.querySelector(`[data-column-id="${v.columnId}"]`);
    if (!tableEl || !rowEl) return (columnAnchor.value = null);
    // horizontal extent of the whole card, vertical extent of the row: beside the table, level with the row
    const t = tableEl.getBoundingClientRect();
    const r = rowEl.getBoundingClientRect();
    columnAnchor.value = {
      left: t.left,
      right: t.right,
      width: t.width,
      top: r.top,
      bottom: r.bottom,
      height: r.height,
    };
  },
);
function navigateColumn(dir) {
  const v = editor.columnPopover;
  const tb = v && doc.tableById.get(v.tableId);
  if (!tb) return;
  const i = tb.columns.findIndex((c) => c.id === v.columnId) + dir;
  if (i >= 0 && i < tb.columns.length)
    editor.openColumnPopover(v.tableId, tb.columns[i].id);
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
  } else if (mod && k === "i") {
    e.preventDefault();
    const sel = editor.columnSelection;
    if (sel?.ids.size) openIndexForSelection(sel.tableId);
    else if (editor.selected.size === 1) {
      const id = [...editor.selected][0];
      if (doc.tableById.has(id)) openIndexes(id);
    }
  } else if (mod && k === "d") {
    e.preventDefault();
    duplicateSelected();
  } else if (k === "enter" && editor.selectedRefId) {
    e.preventDefault();
    const el = root.value.querySelector(
      `[data-ref-id="${editor.selectedRefId}"] path`,
    );
    const r = el?.getBoundingClientRect();
    editor.openRelationEditor(
      editor.selectedRefId,
      r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null,
    );
  } else if (k === "delete" || k === "backspace") {
    if (editor.selectedRefId) {
      e.preventDefault();
      doc.removeRef(editor.selectedRefId);
      editor.selectRef(null);
    } else if (editor.selected.size) {
      e.preventDefault();
      deleteSelected();
    }
  } else if (e.code === "F2") {
    const only = editor.selected.size === 1 ? [...editor.selected][0] : null;
    if (only && doc.tableById.has(only)) {
      e.preventDefault();
      editor.startRename({ kind: "table", tableId: only });
    }
  } else if (!mod && !e.shiftKey && k === "t") {
    editor.setTool("table");
  } else if (!mod && e.key === "?") {
    editor.legendOpen = !editor.legendOpen;
  } else if (!mod && !e.shiftKey && k === "r") {
    editor.setTool("relation");
  } else if (!mod && !e.shiftKey && k === "v") {
    editor.setTool("select");
  } else if (!mod && !e.shiftKey && k === "h") {
    editor.setTool("pan");
  } else if (k === "escape") {
    if (link.value) link.value = null;
    else if (editor.tool !== "select") editor.setTool("select");
    else if (editor.selectedRefId) editor.selectRef(null);
    else editor.clearSelection();
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
// a selected / hovered line that was deleted or undone away
watch(
  () => doc.doc.refs,
  (refs) => {
    if (
      editor.selectedRefId &&
      !refs.some((r) => r.id === editor.selectedRefId)
    )
      editor.selectRef(null);
    if (editor.hoverRefId && !refs.some((r) => r.id === editor.hoverRefId))
      editor.hoverRefId = null;
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
    @dblclick="onDoubleClick"
  >
    <div
      class="absolute top-0 left-0 origin-top-left"
      dir="ltr"
      data-world
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
        :zoom="view.zoom"
        :resizing="resize?.id === g.id ? resize.live : null"
        @pointerdown="onItemDown($event, g.id)"
        @resize-start="(ev, handle) => startResize(ev, g.id, handle)"
      />
      <CanvasRelations
        :refs="doc.doc.refs"
        :layout="refLayout"
        :focus="focusRefs"
        :selected-id="editor.selectedRefId"
        :hover-id="editor.hoverRefId"
        @pick="onPickRef"
        @hover="(id) => (editor.hoverRefId = id)"
        @menu="openRefMenu"
      />
      <CanvasTable
        v-for="tb in doc.doc.tables"
        :key="tb.id"
        :table="tb"
        :selected="editor.isSelected(tb.id)"
        :dragging="!!drag?.moved && dragIds.has(tb.id)"
        :dx="drag?.moved && dragIds.has(tb.id) ? drag.dx : 0"
        :dy="drag?.moved && dragIds.has(tb.id) ? drag.dy : 0"
        :zoom="view.zoom"
        :fk-keys="fkKeys"
        :index-keys="indexKeys"
        :lit-keys="litKeys"
        :link-source="link && link.tableId === tb.id ? link.columnId : null"
        :link-target="
          link?.target?.tableId === tb.id ? link.target.columnId : null
        "
        :relation-tool="editor.tool === 'relation'"
        @pointerdown="onItemDown($event, tb.id)"
        @link-start="(ev, colId) => startLink(ev, tb.id, colId)"
        @header-menu="openTableMenu($event, tb)"
        @color="openColor(tb.id, $event)"
        @column-menu="(ev, colId) => openColumnMenu(ev, tb, colId)"
        @toggle-collapse="doc.updateTable(tb.id, { collapsed: !tb.collapsed })"
      />
    </div>

    <svg
      v-if="linkPreview"
      class="pointer-events-none absolute top-0 left-0 overflow-visible"
      width="1"
      height="1"
      aria-hidden="true"
      :style="worldStyle"
      style="transform-origin: 0 0"
    >
      <path
        :d="linkPreview.d"
        fill="none"
        stroke="var(--c-accent)"
        stroke-width="1.8"
        stroke-dasharray="5 4"
        stroke-linecap="round"
      />
      <circle
        :cx="linkPreview.sx"
        :cy="linkPreview.sy"
        r="5"
        fill="var(--c-accent)"
        stroke="var(--c-canvas)"
        stroke-width="2"
      />
      <circle
        v-if="linkPreview.snapped"
        :cx="linkPreview.tx"
        :cy="linkPreview.ty"
        r="9"
        fill="none"
        stroke="var(--c-accent)"
        stroke-width="1.5"
        opacity="0.6"
      />
      <circle
        :cx="linkPreview.tx"
        :cy="linkPreview.ty"
        r="4"
        fill="var(--c-accent)"
      />
    </svg>

    <div
      v-if="marqueeStyle"
      class="pointer-events-none absolute rounded-[3px] border border-accent bg-accent-soft"
      :style="marqueeStyle"
    />

    <slot />
    <CanvasMinimap />

    <UiContextMenu ref="ctx" @select="onMenuSelect" />

    <UiPopover
      v-model:open="colorOpen"
      :anchor="colorAnchor"
      side="bottom"
      align="start"
      :offset="4"
    >
      <UiColorPalette
        :model-value="colorTable?.color ?? null"
        :custom="doc.doc.palette"
        @update:model-value="setTableColor"
        @add="doc.addPaletteColor"
        @remove="doc.removePaletteColor"
      />
    </UiPopover>

    <UiPopover
      v-model:open="relationOpen"
      :anchor="relationAnchor"
      side="inline-end"
      align="start"
      :offset="14"
    >
      <RelationEditor
        v-if="editor.relationEditor"
        :key="editor.relationEditor.refId"
        :ref-id="editor.relationEditor.refId"
        @close="editor.closeRelationEditor()"
      />
    </UiPopover>

    <UiPopover
      v-model:open="indexOpen"
      :anchor="indexAnchor"
      side="inline-end"
      align="start"
      :offset="8"
    >
      <IndexEditor
        v-if="editor.indexEditor"
        :key="`${editor.indexEditor.tableId}:${editor.indexEditor.columns.join(',')}:${editor.indexEditor.focus}`"
        :table-id="editor.indexEditor.tableId"
        :initial="editor.indexEditor.columns"
        :focus="editor.indexEditor.focus"
        @close="editor.closeIndexEditor()"
      />
    </UiPopover>

    <UiPopover
      v-model:open="columnOpen"
      :anchor="columnAnchor"
      side="inline-end"
      align="start"
      :offset="8"
    >
      <ColumnEditor
        v-if="editor.columnPopover"
        :key="editor.columnPopover.columnId"
        :table-id="editor.columnPopover.tableId"
        :column-id="editor.columnPopover.columnId"
        @close="editor.closeColumnPopover()"
        @navigate="navigateColumn"
        @index="openIndexFromColumn"
      />
    </UiPopover>
  </div>
</template>
