<script setup>
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";

import { useI18n } from "vue-i18n";

import { useCanvasCamera } from "@/canvas/useCanvasCamera";
import {
  IconColComment,
  IconSearch,
  IconToolNote,
  IconToolRelation,
  IconToolSection,
  IconToolTable,
} from "@/icons";
import { groupRect, noteRect, tableRect } from "@/model/geometry";
import { searchDocument } from "@/model/search";
import { useDocumentStore } from "@/stores/document";
import { useEditorStore } from "@/stores/editor";

/**
 * Header search (Ctrl+K). Finds tables, columns, sections and relationship lines by name, type, label
 * or note. Enter / click jumps to the result: selects it, moves the camera there and, for a column,
 * opens its editor. Arrow keys move through the list, Esc closes.
 */
const { t } = useI18n();
const doc = useDocumentStore();
const editor = useEditorStore();
const camera = useCanvasCamera();

const input = useTemplateRef("input");
const root = useTemplateRef("root");
const query = ref("");
const open = ref(false);
const active = ref(0);

const results = computed(() =>
  open.value ? searchDocument(doc.doc, query.value) : [],
);
watch(results, () => (active.value = 0));

const ICONS = {
  table: IconToolTable,
  column: IconColComment,
  group: IconToolSection,
  ref: IconToolRelation,
  note: IconToolNote,
};

function focus() {
  input.value?.focus();
  input.value?.select();
  open.value = true;
}
defineExpose({ focus });

function close() {
  open.value = false;
  query.value = "";
  input.value?.blur();
}

function jump(r) {
  const d = doc.doc;
  if (r.kind === "table" || r.kind === "column") {
    const tb = doc.tableById.get(r.kind === "table" ? r.id : r.tableId);
    if (!tb) return;
    editor.setSelection([tb.id]);
    camera.focusRect(tableRect(tb));
    if (r.kind === "column") editor.openColumnPopover(tb.id, r.id);
  } else if (r.kind === "note") {
    const n = d.notes.find((x) => x.id === r.id);
    if (!n) return;
    editor.setSelection([n.id]);
    camera.focusRect(noteRect(n));
  } else if (r.kind === "group") {
    const g = d.groups.find((x) => x.id === r.id);
    if (!g) return;
    editor.setSelection([g.id]);
    camera.focusRect(groupRect(g));
  } else {
    const ref = d.refs.find((x) => x.id === r.id);
    if (!ref) return;
    editor.selectRef(ref.id);
    const a = doc.tableById.get(ref.from.table);
    const b = doc.tableById.get(ref.to.table);
    const rects = [a, b].filter(Boolean).map(tableRect);
    if (rects.length) {
      const x1 = Math.min(...rects.map((q) => q.x));
      const y1 = Math.min(...rects.map((q) => q.y));
      const x2 = Math.max(...rects.map((q) => q.x + q.w));
      const y2 = Math.max(...rects.map((q) => q.y + q.h));
      camera.focusRect({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
    }
  }
  close();
}

function onKey(e) {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    const n = results.value.length;
    if (n)
      active.value = (active.value + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
    nextTick(() =>
      root.value
        ?.querySelector("[data-active=true]")
        ?.scrollIntoView({ block: "nearest" }),
    );
  } else if (e.key === "Enter") {
    e.preventDefault();
    const r = results.value[active.value];
    if (r) jump(r);
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    close();
  }
}

function onFocusOut(e) {
  if (!root.value?.contains(e.relatedTarget)) open.value = false;
}
</script>

<template>
  <div
    ref="root"
    class="relative w-[260px] max-w-[40vw]"
    data-search
    @focusout="onFocusOut"
  >
    <label
      class="flex h-7 items-center gap-2 rounded-control border border-line-strong bg-canvas px-2 text-muted focus-within:border-accent"
    >
      <IconSearch class="size-3.5 shrink-0" />
      <input
        ref="input"
        v-model="query"
        type="text"
        role="combobox"
        :aria-label="t('search.label')"
        :aria-expanded="open && results.length > 0"
        aria-controls="search-results"
        :placeholder="t('search.placeholder')"
        spellcheck="false"
        autocomplete="off"
        class="min-w-0 flex-1 bg-transparent text-xs text-fg outline-none placeholder:text-muted focus-visible:outline-none"
        @focus="open = true"
        @keydown="onKey"
      />
      <kbd
        v-if="!open"
        dir="ltr"
        class="rounded-kbd bg-kbd px-1.5 font-mono text-[10px] text-kbd-fg"
        >Ctrl K</kbd
      >
    </label>

    <ul
      v-if="open && query.trim()"
      id="search-results"
      role="listbox"
      class="absolute inset-s-0 top-full z-50 mt-1 max-h-[340px] w-[340px] max-w-[90vw] overflow-y-auto rounded-popover bg-popover py-1 shadow-popover"
      data-workspace
    >
      <li
        v-if="!results.length"
        class="px-3 py-2 font-sans text-xs text-muted"
        data-search-empty
      >
        {{ t("search.none") }}
      </li>
      <li
        v-for="(r, i) in results"
        :key="`${r.kind}-${r.id}`"
        role="option"
        :aria-selected="i === active"
        :data-active="i === active"
        :data-result="`${r.kind}:${r.id}`"
        class="flex cursor-pointer items-center gap-2 px-3 py-1.5"
        :class="i === active ? 'bg-accent-soft' : 'hover:bg-hover'"
        @pointerdown.prevent
        @click="jump(r)"
        @pointermove="active = i"
      >
        <component :is="ICONS[r.kind]" class="size-3.5 shrink-0 text-muted" />
        <span
          class="min-w-0 flex-1 truncate font-mono text-[12px] text-fg"
          dir="ltr"
          >{{ r.name }}</span
        >
        <span
          v-if="r.detail"
          class="max-w-[45%] truncate font-mono text-[10.5px] text-faint"
          dir="ltr"
          >{{ r.detail }}</span
        >
      </li>
    </ul>
  </div>
</template>
