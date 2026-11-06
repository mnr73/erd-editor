<script setup>
import { computed, ref, useTemplateRef } from "vue";

import { useI18n } from "vue-i18n";

import UiInlineEdit from "@/components/ui/UiInlineEdit.vue";

import {
  IconChevronDown,
  IconColComment,
  IconColDefault,
  IconColIncrement,
  IconColIndex,
  IconColUnique,
  IconDragHandle,
  IconInsertColumn,
  IconMore,
  IconNote,
} from "@/icons";
import { useDocumentStore } from "@/stores/document";
import { useEditorStore } from "@/stores/editor";

import { BODY_PAD, HEADER_H, ROW_H, tableHeight, tableWidth } from "./geometry";

/**
 * One table card. Size comes from geometry.js (same numbers the minimap / fit use), position is the
 * document position plus the live drag offset. Columns show only name + type; attribute icons appear
 * only when the attribute has a value (PK / FK use a text key, "?" marks nullable).
 *
 * Editing (stage 5): double-click a name to rename inline, hover a row for the "more" button
 * (opens the column popover), the + dots on a row border insert above / below, and the 6-dot handle
 * reorders columns by dragging.
 */
const props = defineProps({
  table: { type: Object, required: true },
  selected: Boolean,
  dragging: Boolean,
  dx: { type: Number, default: 0 },
  dy: { type: Number, default: 0 },
  zoom: { type: Number, default: 1 },
  fkKeys: { type: Set, required: true }, // `${tableId}.${columnId}` that are foreign keys
  indexKeys: { type: Set, required: true }, // `${tableId}.${columnId}` that are in some index
});
const emit = defineEmits([
  "pointerdown",
  "toggle-collapse",
  "header-menu",
  "column-menu",
  "color",
]);

const { t } = useI18n();
const doc = useDocumentStore();
const editor = useEditorStore();
const body = useTemplateRef("body");

const width = computed(() => tableWidth(props.table));
const height = computed(() => tableHeight(props.table));
const accent = computed(() => props.table.color ?? "var(--c-faint)");
const headerBg = computed(() =>
  props.table.color
    ? `color-mix(in srgb, ${props.table.color} var(--mix-header), var(--c-card))`
    : "transparent",
);
/** Column id whose popover is open (this table only): the row stays highlighted. */
const editingColumn = computed(() =>
  editor.columnPopover?.tableId === props.table.id
    ? editor.columnPopover.columnId
    : null,
);
const renamingTable = computed(() =>
  editor.isRenaming("table", props.table.id),
);

const rows = computed(() =>
  props.table.columns.map((c) => {
    const key = `${props.table.id}.${c.id}`;
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      key: c.pk ? "PK" : props.fkKeys.has(key) ? "FK" : "",
      nullable: !c.notNull && !c.pk,
      pk: c.pk,
      unique: c.unique,
      increment: c.increment,
      def: c.default,
      note: c.note,
      indexed: props.indexKeys.has(key),
    };
  }),
);

/* ------------------------------ table name ------------------------------ */

function commitTableName(value) {
  editor.stopRename();
  const name = value.trim();
  if (name && name !== props.table.name)
    doc.updateTable(props.table.id, { name });
}

/* ------------------------------ column name ------------------------------ */

const renamingColumn = (id) => editor.isRenaming("column", props.table.id, id);

function commitColumnName(id, value) {
  editor.stopRename();
  const name = value.trim();
  const col = props.table.columns.find((c) => c.id === id);
  if (name && col && name !== col.name)
    doc.updateColumn(props.table.id, id, { name });
}

/** Tab in the name field: save and start renaming the next / previous column (adds one past the end). */
function tabFrom(index, backwards) {
  const cols = props.table.columns;
  const next = index + (backwards ? -1 : 1);
  if (next < 0) return;
  if (next >= cols.length) {
    const id = doc.addColumn(props.table.id);
    editor.startRename({
      kind: "column",
      tableId: props.table.id,
      columnId: id,
    });
  } else {
    editor.startRename({
      kind: "column",
      tableId: props.table.id,
      columnId: cols[next].id,
    });
  }
}

function insertColumn(index) {
  const id = doc.addColumn(props.table.id, {}, index);
  editor.startRename({ kind: "column", tableId: props.table.id, columnId: id });
}

/* -------------------------- column reorder (drag) ------------------------- */

const reorder = ref(null); // { from, to, y }  y = pointer offset inside the body (px, unscaled)

function startReorder(e, index) {
  e.stopPropagation();
  e.preventDefault();
  e.currentTarget.setPointerCapture(e.pointerId);
  reorder.value = { from: index, to: index };
}
function moveReorder(e) {
  if (!reorder.value) return;
  const box = body.value.getBoundingClientRect();
  const y = (e.clientY - box.top) / props.zoom - BODY_PAD;
  const to = Math.max(
    0,
    Math.min(props.table.columns.length - 1, Math.floor(y / ROW_H)),
  );
  if (to !== reorder.value.to) reorder.value = { ...reorder.value, to };
}
function endReorder(e) {
  if (!reorder.value) return;
  e.currentTarget.releasePointerCapture?.(e.pointerId);
  const { from, to } = reorder.value;
  reorder.value = null;
  if (from !== to) doc.moveColumn(props.table.id, from, to);
}
/** Y (px inside the body) of the blue drop line: before row `to` when moving up, after it when moving down. */
const dropLineTop = computed(() => {
  if (!reorder.value || reorder.value.from === reorder.value.to) return null;
  const { from, to } = reorder.value;
  return BODY_PAD + (to > from ? to + 1 : to) * ROW_H;
});

function onRowKey(e, index) {
  if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
  e.preventDefault();
  const to = index + (e.key === "ArrowDown" ? 1 : -1);
  if (to >= 0 && to < props.table.columns.length)
    doc.moveColumn(props.table.id, index, to);
}
</script>

<template>
  <div
    class="absolute overflow-hidden rounded-table border bg-card font-mono transition-shadow"
    :class="[
      props.selected
        ? 'border-accent'
        : 'border-line-strong hover:border-faint',
      props.dragging
        ? 'shadow-table-drag'
        : 'shadow-table hover:shadow-table-hover',
    ]"
    :style="{
      left: `${props.table.x}px`,
      top: `${props.table.y}px`,
      width: `${width}px`,
      height: `${height}px`,
      transform:
        props.dx || props.dy
          ? `translate(${props.dx}px, ${props.dy}px)`
          : undefined,
      zIndex: props.dragging ? 20 : props.selected ? 10 : 1,
      boxShadow:
        props.selected && !props.dragging
          ? '0 0 0 2px var(--c-accent)'
          : undefined,
    }"
    :data-table-id="props.table.id"
    @pointerdown="emit('pointerdown', $event)"
  >
    <header
      class="flex items-center gap-[7px] px-2"
      :class="props.table.collapsed ? '' : 'border-b border-line'"
      :style="{ height: `${HEADER_H}px`, background: headerBg }"
      @contextmenu.stop.prevent="emit('header-menu', $event)"
    >
      <button
        type="button"
        :aria-label="t('table.color')"
        :title="t('table.color')"
        class="size-2.5 shrink-0 rounded-[3px] ring-offset-1 ring-offset-card hover:ring-2 hover:ring-fg-soft"
        :style="{ background: accent }"
        @pointerdown.stop
        @click.stop="
          emit('color', $event.currentTarget.getBoundingClientRect())
        "
      />
      <UiInlineEdit
        v-if="renamingTable"
        class="flex-1 text-xs font-semibold"
        mono
        :value="props.table.name"
        :label="t('table.name')"
        @commit="commitTableName"
        @cancel="editor.stopRename()"
      />
      <span v-else class="flex-1 truncate text-xs font-semibold text-fg">{{
        props.table.name
      }}</span>
      <span
        v-if="props.table.collapsed"
        class="shrink-0 font-sans text-[10.5px] text-muted"
      >
        {{ t("canvas.columnsCount", { n: props.table.columns.length }) }}
      </span>
      <IconNote v-if="props.table.note" class="size-3.5 shrink-0 text-muted" />
      <button
        type="button"
        :aria-label="
          props.table.collapsed ? t('canvas.expand') : t('canvas.collapse')
        "
        :aria-expanded="!props.table.collapsed"
        class="inline-flex size-4 shrink-0 items-center justify-center rounded-kbd text-muted hover:bg-hover hover:text-fg"
        @pointerdown.stop
        @click.stop="emit('toggle-collapse')"
      >
        <IconChevronDown
          class="size-3.5 transition-transform"
          :class="props.table.collapsed ? '-rotate-90' : ''"
        />
      </button>
    </header>

    <div
      v-if="!props.table.collapsed && rows.length"
      ref="body"
      class="relative"
      :style="{ padding: `${BODY_PAD}px 0` }"
    >
      <div
        v-for="(r, i) in rows"
        :key="r.id"
        class="group/row relative flex items-center gap-[5px] px-2"
        :class="[
          reorder?.from === i ? 'opacity-40' : '',
          editingColumn === r.id ? 'bg-row-active' : 'hover:bg-hover',
        ]"
        :style="{ height: `${ROW_H}px` }"
        :data-column-id="r.id"
        tabindex="-1"
        @contextmenu.stop.prevent="emit('column-menu', $event, r.id)"
        @keydown="onRowKey($event, i)"
      >
        <!-- 6-dot reorder handle, only on hover -->
        <span
          class="absolute inset-s-0 top-0 hidden h-full w-3 cursor-grab items-center justify-center text-faint group-hover/row:flex"
          :title="t('column.dragHint')"
          @pointerdown="startReorder($event, i)"
          @pointermove="moveReorder"
          @pointerup="endReorder"
          @pointercancel="endReorder"
        >
          <IconDragHandle class="size-3" />
        </span>

        <span
          class="w-[18px] shrink-0 text-[9.5px] font-semibold"
          :class="r.pk ? 'text-key-pk' : 'text-key-fk'"
          >{{ r.key }}</span
        >

        <UiInlineEdit
          v-if="renamingColumn(r.id)"
          class="flex-1 text-[11.5px]"
          mono
          :value="r.name"
          :label="t('column.name')"
          @commit="commitColumnName(r.id, $event)"
          @cancel="editor.stopRename()"
          @tab="tabFrom(i, $event)"
        />
        <template v-else>
          <span
            class="truncate text-[11.5px] text-fg-soft"
            :class="r.pk ? 'font-semibold text-fg' : ''"
            >{{ r.name }}</span
          >
          <span class="flex flex-1 items-center gap-[3px] ps-0.5 text-faint">
            <IconColUnique v-if="r.unique" class="size-3" title="UNIQUE" />
            <IconColIncrement
              v-if="r.increment"
              class="size-3"
              title="AUTO INCREMENT"
            />
            <IconColDefault
              v-if="r.def"
              class="size-3"
              :title="`DEFAULT ${r.def}`"
            />
            <IconColIndex v-if="r.indexed" class="size-3" title="INDEX" />
            <IconColComment v-if="r.note" class="size-3" :title="r.note" />
          </span>
          <span class="shrink-0 text-[10.5px] text-faint"
            >{{ r.type
            }}<span v-if="r.nullable" class="text-warn">?</span></span
          >
          <button
            type="button"
            :aria-label="t('column.more')"
            :data-more="r.id"
            class="hidden size-4 shrink-0 items-center justify-center rounded-kbd bg-line-strong text-fg group-hover/row:inline-flex hover:bg-accent hover:text-accent-fg"
            @pointerdown.stop
            @click.stop="editor.openColumnPopover(props.table.id, r.id)"
          >
            <IconMore class="size-3" />
          </button>
        </template>

        <!-- insert above / below: + dots on the row border, only on hover -->
        <button
          v-if="i === 0"
          type="button"
          :aria-label="t('column.insertAbove')"
          class="absolute -top-[9px] left-1/2 z-10 hidden size-[18px] -translate-x-1/2 items-center justify-center rounded-full bg-accent text-accent-fg shadow-[0_0_0_2px_var(--c-card)] group-hover/row:flex"
          @pointerdown.stop
          @click.stop="insertColumn(i)"
        >
          <IconInsertColumn class="size-3.5" />
        </button>
        <button
          type="button"
          :aria-label="t('column.insertBelow')"
          class="absolute -bottom-[9px] left-1/2 z-10 hidden size-[18px] -translate-x-1/2 items-center justify-center rounded-full bg-accent text-accent-fg shadow-[0_0_0_2px_var(--c-card)] group-hover/row:flex"
          @pointerdown.stop
          @click.stop="insertColumn(i + 1)"
        >
          <IconInsertColumn class="size-3.5" />
        </button>
      </div>

      <!-- blue drop line while reordering -->
      <div
        v-if="dropLineTop !== null"
        class="pointer-events-none absolute inset-x-1 z-20 h-0.5 rounded-full bg-accent"
        :style="{ top: `${dropLineTop - 1}px` }"
      />
    </div>

    <div
      v-else-if="!props.table.collapsed"
      class="flex h-[var(--size-empty-body)] flex-col items-center justify-center gap-1.5 font-sans text-[11.5px] text-muted"
    >
      <span>{{ t("canvas.noColumns") }}</span>
      <button
        type="button"
        class="flex h-6 items-center rounded-chip border border-dashed border-line-strong px-2.5 text-accent-text hover:bg-hover"
        @pointerdown.stop
        @click.stop="insertColumn(0)"
      >
        + {{ t("table.newColumn") }}
      </button>
    </div>
  </div>
</template>
