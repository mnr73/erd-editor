<script setup>
import { computed } from "vue";

import { useI18n } from "vue-i18n";

import UiButton from "@/components/ui/UiButton.vue";
import UiColorPalette from "@/components/ui/UiColorPalette.vue";
import UiIconButton from "@/components/ui/UiIconButton.vue";
import UiInput from "@/components/ui/UiInput.vue";
import UiSwitch from "@/components/ui/UiSwitch.vue";

import ColumnEditor from "@/canvas/ColumnEditor.vue";
import NoteEditor from "@/canvas/NoteEditor.vue";
import RelationEditor from "@/canvas/RelationEditor.vue";
import {
  IconAdd,
  IconClose,
  IconCopy,
  IconDelete,
  IconToolSection,
} from "@/icons";
import { MIN_NOTE_SIZE } from "@/model/constants";
import {
  columnAfterRemoval,
  docStats,
  inspectorTarget,
  relationsOfTable,
  sectionOfTable,
  tablesInSection,
} from "@/model/inspector";
import { DEFAULT_NOTE_COLOR } from "@/model/palette";
import { useDocumentStore } from "@/stores/document";
import { useEditorStore } from "@/stores/editor";

/**
 * The right-hand panel (320px). Shows ONE thing at a time, chosen by the selection: a table (tabs:
 * Table / Columns / Relations / Note), a section, a relationship line, or a summary of a multi-
 * selection. It reuses the popover editors (`fluid`), so a field behaves the same in both places.
 * Every edit goes straight to the document; nothing here keeps its own copy.
 */
const { t } = useI18n();
const doc = useDocumentStore();
const editor = useEditorStore();

const target = computed(() => {
  void doc.doc; // re-run on any document change (undo swaps the whole document)
  const tableIds = [...editor.selected].filter((id) => doc.tableById.has(id));
  const groupIds = [...editor.selected].filter((id) =>
    doc.doc.groups.some((g) => g.id === id),
  );
  const noteIds = [...editor.selected].filter((id) =>
    doc.doc.notes.some((n) => n.id === id),
  );
  return inspectorTarget(doc.doc, {
    tableIds,
    groupIds,
    noteIds,
    refId: editor.selectedRefId,
  });
});
const stats = computed(() => docStats(doc.doc));

const table = computed(() => target.value.table);
const group = computed(() => target.value.group);
const freeNote = computed(() => target.value.note);
const section = computed(() =>
  table.value ? sectionOfTable(doc.doc, table.value) : null,
);
const relations = computed(() =>
  table.value ? relationsOfTable(doc.doc, table.value.id) : [],
);
const tabs = computed(() => [
  { id: "table", label: t("inspector.tabTable") },
  {
    id: "columns",
    label: `${t("inspector.tabColumns")} ${table.value?.columns.length ?? ""}`,
  },
  {
    id: "rels",
    label: `${t("inspector.tabRels")} ${relations.value.length || ""}`,
  },
  { id: "note", label: t("inspector.tabNote") },
]);
const tab = computed({
  get: () => editor.inspectorTab,
  set: (v) => (editor.inspectorTab = v),
});

const accent = (c) => c ?? "var(--c-muted)";
const openColumn = computed(() => {
  const c = editor.inspectorColumn;
  return c && c.tableId === table.value?.id ? c.columnId : null;
});

function patchTable(p, key = null) {
  doc.updateTable(table.value.id, p, key);
}
function setColor(color) {
  patchTable({ color });
}
function toggleColumn(id) {
  editor.inspectorColumn =
    openColumn.value === id ? null : { tableId: table.value.id, columnId: id };
}
function addColumn() {
  const id = doc.addColumn(table.value.id);
  editor.inspectorColumn = { tableId: table.value.id, columnId: id };
  tab.value = "columns";
}
/** Relationships are edited in the panel itself; "back" returns to the table's Relations tab. */
function openRef(id) {
  editor.selectRef(id, { back: table.value.id });
}
function back() {
  const id = editor.inspectorBack;
  editor.selectRef(null);
  if (id && doc.tableById.has(id)) {
    editor.setSelection([id]);
    tab.value = "rels";
  }
}
function removeTable() {
  doc.removeTables([table.value.id]);
  editor.clearSelection();
}
function duplicate() {
  editor.setSelection(doc.duplicateTables([table.value.id]));
}
/** Called just BEFORE the column is deleted: remember which neighbour to open next. */
function onColumnRemoved(id) {
  const cols = table.value.columns;
  const i = cols.findIndex((c) => c.id === id);
  const after = cols.filter((c) => c.id !== id);
  const next = columnAfterRemoval(after, i);
  editor.inspectorColumn = next
    ? { tableId: table.value.id, columnId: next }
    : null;
}
function moveToSection(e) {
  // a table belongs to a section by lying inside it, so "move to section" moves the table there
  const id = e.target.value;
  const tb = table.value;
  if (!id) return;
  const g = doc.doc.groups.find((x) => x.id === id);
  if (g)
    doc.updateTable(tb.id, {
      x: Math.round(g.x + 32),
      y: Math.round(g.y + 56),
    });
}
function groupSelected() {
  const ids = target.value.tables.map((x) => x.id);
  const id = doc.groupTables(ids);
  if (id) editor.setSelection([id]);
}
function removeSelected() {
  doc.removeTables(target.value.tables.map((x) => x.id));
  for (const g of target.value.groups) doc.removeGroup(g.id);
  if (target.value.notes?.length)
    doc.removeNotes(target.value.notes.map((x) => x.id));
  editor.clearSelection();
}
/** Applied on Enter / blur, not per keystroke: "3" on the way to "300" must not be clamped to the minimum. */
function onNoteSize(key, e) {
  const n = Number(e.target.value);
  const value = Number.isFinite(n)
    ? Math.max(MIN_NOTE_SIZE, Math.round(n))
    : freeNote.value[key];
  doc.updateNote(freeNote.value.id, { [key]: value });
  e.target.value = value;
}
function duplicateNote() {
  editor.setSelection(doc.duplicateNotes([freeNote.value.id]));
}
function close() {
  if (editor.selectedRefId) editor.selectRef(null);
  else editor.clearSelection();
}

const title = computed(() => {
  const m = target.value.mode;
  if (m === "table") return table.value.name;
  if (m === "group") return group.value.name;
  if (m === "note") return t("freeNote.title");
  if (m === "ref") return t("relation.title");
  if (m === "multi")
    return t("inspector.multi", {
      n:
        target.value.tables.length +
        target.value.groups.length +
        target.value.notes.length,
    });
  return t("inspector.title");
});
</script>

<template>
  <aside
    data-inspector
    :aria-label="t('inspector.title')"
    class="flex w-[var(--size-inspector)] shrink-0 flex-col overflow-hidden border-s border-line bg-panel"
  >
    <!-- empty -->
    <div
      v-if="target.mode === 'none'"
      class="flex flex-1 flex-col gap-4 p-4"
      data-inspector-empty
    >
      <h2 class="font-sans text-ui-13 font-semibold text-fg">
        {{ t("inspector.title") }}
      </h2>
      <p class="text-xs leading-[1.8] text-muted">{{ t("inspector.empty") }}</p>
      <div class="grid grid-cols-2 gap-2" data-workspace>
        <div
          v-for="s in [
            [stats.tables, t('inspector.tables')],
            [stats.refs, t('inspector.relationships')],
            [stats.groups, t('inspector.sections')],
            [stats.notes, t('inspector.notes')],
          ]"
          :key="s[1]"
          class="rounded-control border border-line bg-canvas p-2.5"
        >
          <div class="text-lg font-semibold text-fg">{{ s[0] }}</div>
          <div class="text-ui-105 text-muted">{{ s[1] }}</div>
        </div>
      </div>
    </div>

    <template v-else>
      <!-- header -->
      <div class="flex items-center gap-2 px-3.5 pt-3 pb-2.5">
        <button
          v-if="target.mode === 'ref' && editor.inspectorBack"
          type="button"
          class="inline-flex h-6 items-center rounded-control px-1.5 text-ui-11 text-accent-text hover:bg-hover"
          @click="back"
        >
          ← {{ t("inspector.back") }}
        </button>
        <span
          v-if="target.mode === 'table'"
          class="size-2.5 shrink-0 rounded-[3px]"
          :style="{ background: accent(table.color) }"
        />
        <span
          v-else-if="target.mode === 'group'"
          class="size-2.5 shrink-0 rounded-[3px]"
          :style="{ background: accent(group.color) }"
        />
        <span
          class="min-w-0 flex-1 truncate font-mono text-ui-13 font-semibold text-fg"
          dir="ltr"
          data-workspace
          >{{ title }}</span
        >
        <span
          v-if="target.mode === 'table' && section"
          class="shrink-0 text-ui-11 text-muted"
          >· {{ section.name }}</span
        >
        <UiIconButton
          size="sm"
          :label="t('inspector.close')"
          shortcut="Esc"
          @click="close"
        >
          <IconClose class="size-3.5" />
        </UiIconButton>
      </div>

      <!-- TABLE -->
      <template v-if="target.mode === 'table'">
        <div
          role="tablist"
          class="flex gap-0.5 border-b border-line px-2.5"
          :aria-label="t('inspector.title')"
        >
          <button
            v-for="tb in tabs"
            :key="tb.id"
            type="button"
            role="tab"
            :aria-selected="tab === tb.id"
            :data-tab="tb.id"
            class="h-[34px] border-b-2 px-2 text-xs whitespace-nowrap transition-colors"
            :class="
              tab === tb.id
                ? 'border-accent text-fg'
                : 'border-transparent text-muted hover:text-fg'
            "
            @click="tab = tb.id"
          >
            {{ tb.label }}
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto">
          <!-- table tab -->
          <div
            v-if="tab === 'table'"
            class="flex flex-col gap-4 p-3.5"
            data-pane="table"
          >
            <label class="flex flex-col gap-1.5">
              <span class="text-ui-11 text-muted">{{ t("table.name") }}</span>
              <UiInput
                :model-value="table.name"
                mono
                :label="t('table.name')"
                data-table-name
                @update:model-value="patchTable({ name: $event }, 'name')"
              />
            </label>
            <div class="flex flex-col gap-2">
              <span class="text-ui-11 text-muted">{{
                t("inspector.headerColor")
              }}</span>
              <UiColorPalette
                flush
                :model-value="table.color"
                :custom="doc.doc.palette"
                @update:model-value="setColor"
                @add="doc.addPaletteColor"
                @remove="doc.removePaletteColor"
              />
            </div>
            <label class="flex flex-col gap-1.5">
              <span class="text-ui-11 text-muted">{{
                t("inspector.section")
              }}</span>
              <select
                :value="section?.id ?? ''"
                :aria-label="t('inspector.section')"
                class="h-[30px] rounded-control border border-line-strong bg-canvas px-2 text-xs text-fg"
                data-section-select
                @change="moveToSection"
              >
                <option v-if="!section" value="">
                  {{ t("inspector.noSection") }}
                </option>
                <option v-for="g in doc.doc.groups" :key="g.id" :value="g.id">
                  {{ g.name }}
                </option>
              </select>
            </label>
            <label class="flex items-center gap-2.5 text-xs text-fg-soft">
              <span class="flex-1">{{ t("inspector.collapsed") }}</span>
              <UiSwitch
                :model-value="table.collapsed"
                :label="t('inspector.collapsed')"
                @update:model-value="patchTable({ collapsed: $event })"
              />
            </label>
            <div class="grid grid-cols-2 gap-2" data-workspace>
              <div class="rounded-control border border-line bg-canvas p-2.5">
                <div class="text-lg font-semibold text-fg">
                  {{ table.columns.length }}
                </div>
                <div class="text-ui-11 text-muted">
                  {{ t("inspector.columns") }}
                </div>
              </div>
              <div class="rounded-control border border-line bg-canvas p-2.5">
                <div class="text-lg font-semibold text-fg">
                  {{ relations.length }}
                </div>
                <div class="text-ui-11 text-muted">
                  {{ t("inspector.relations") }}
                </div>
              </div>
            </div>
            <div class="flex gap-2">
              <UiButton class="flex-1" @click="duplicate">
                <template #icon><IconCopy class="size-3.5" /></template>
                {{ t("inspector.duplicate") }}
              </UiButton>
              <UiButton class="flex-1" variant="danger" @click="removeTable">
                <template #icon><IconDelete class="size-3.5" /></template>
                {{ t("inspector.delete") }}
              </UiButton>
            </div>
          </div>

          <!-- columns tab -->
          <div
            v-else-if="tab === 'columns'"
            class="flex flex-col py-1.5"
            data-pane="columns"
            dir="ltr"
          >
            <p
              v-if="!table.columns.length"
              class="px-3.5 py-3 text-xs text-muted"
              dir="auto"
            >
              {{ t("inspector.noColumns") }}
            </p>
            <template v-for="c in table.columns" :key="c.id">
              <button
                v-if="openColumn !== c.id"
                type="button"
                :data-col-row="c.id"
                class="flex h-[30px] items-center gap-2 ps-2.5 pe-2.5 text-start font-mono text-ui-115 text-fg hover:bg-hover"
                data-workspace
                @click="toggleColumn(c.id)"
              >
                <span
                  class="w-4 text-ui-95 font-semibold"
                  :class="c.pk ? 'text-key-pk' : 'text-key-fk'"
                  >{{
                    c.pk
                      ? "PK"
                      : doc.doc.refs.some(
                            (r) =>
                              r.from.table === table.id &&
                              r.from.columns.includes(c.id),
                          )
                        ? "FK"
                        : ""
                  }}</span
                >
                <span class="flex-1 truncate">{{ c.name }}</span>
                <span class="text-faint"
                  >{{ c.type
                  }}<span v-if="!c.notNull && !c.pk" class="text-warn"
                    >?</span
                  ></span
                >
              </button>
              <div
                v-else
                class="mx-2 my-0.5 rounded-popover border border-accent bg-accent-soft"
                :data-col-open="c.id"
              >
                <ColumnEditor
                  :table-id="table.id"
                  :column-id="c.id"
                  fluid
                  @removed="onColumnRemoved"
                  @close="editor.inspectorColumn = editor.inspectorColumn"
                  @navigate="
                    (d) => {
                      const i =
                        table.columns.findIndex((x) => x.id === c.id) + d;
                      if (table.columns[i]) toggleColumn(table.columns[i].id);
                    }
                  "
                  @index="
                    (ixId) =>
                      editor.openIndexEditor(
                        table.id,
                        ixId ? { focus: ixId } : { columns: [c.id] },
                      )
                  "
                />
              </div>
            </template>
            <button
              type="button"
              dir="auto"
              class="mx-2 mt-1.5 flex h-8 items-center gap-2 rounded-popover border border-dashed border-line-strong px-2 text-xs text-muted hover:text-fg"
              data-add-column
              @click="addColumn"
            >
              <IconAdd class="size-3.5" /> {{ t("inspector.newColumn") }}
            </button>
          </div>

          <!-- relations tab -->
          <div
            v-else-if="tab === 'rels'"
            class="flex flex-col p-2"
            data-pane="rels"
          >
            <p v-if="!relations.length" class="px-2 py-3 text-xs text-muted">
              {{ t("inspector.noRelations") }}
            </p>
            <button
              v-for="r in relations"
              :key="r.id"
              type="button"
              :data-rel-row="r.id"
              class="flex min-h-10 items-center gap-2 rounded-control px-2 py-1 text-start hover:bg-hover"
              dir="ltr"
              data-workspace
              @click="openRef(r.id)"
            >
              <span class="flex flex-1 flex-col gap-0.5">
                <span class="font-mono text-ui-115 text-fg">{{ r.other }}</span>
                <span class="font-mono text-ui-105 text-faint">{{
                  r.mine
                }}</span>
              </span>
              <span
                class="rounded-chip bg-accent-soft px-1.5 font-mono text-ui-105 text-accent-text"
                >{{ r.kind }}</span
              >
            </button>
          </div>

          <!-- note tab -->
          <NoteEditor
            v-else-if="tab === 'note'"
            :id="table.id"
            :key="`n-${table.id}`"
            fluid
            :autofocus="false"
            class="p-3.5"
            data-pane="note"
            @close="tab = 'table'"
          />
        </div>
      </template>

      <!-- SECTION -->
      <div
        v-else-if="target.mode === 'group'"
        class="min-h-0 flex-1 overflow-y-auto"
        data-pane="group"
      >
        <div class="flex flex-col gap-4 p-3.5">
          <label class="flex flex-col gap-1.5">
            <span class="text-ui-11 text-muted">{{
              t("inspector.sectionName")
            }}</span>
            <UiInput
              :model-value="group.name"
              :label="t('inspector.sectionName')"
              @update:model-value="
                doc.updateGroup(group.id, { name: $event }, 'gname')
              "
            />
          </label>
          <div class="flex flex-col gap-2">
            <span class="text-ui-11 text-muted">{{
              t("inspector.headerColor")
            }}</span>
            <UiColorPalette
              flush
              :model-value="group.color"
              :custom="doc.doc.palette"
              @update:model-value="
                (c) => doc.updateGroup(group.id, { color: c })
              "
              @add="doc.addPaletteColor"
              @remove="doc.removePaletteColor"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <span class="text-ui-11 text-muted">{{
              t("inspector.sectionTables")
            }}</span>
            <ul class="flex flex-wrap gap-1" dir="ltr" data-workspace>
              <li
                v-for="tb in tablesInSection(doc.doc, group.id)"
                :key="tb.id"
                class="rounded-chip border border-line-strong px-1.5 py-px font-mono text-ui-11 text-fg-soft"
              >
                {{ tb.name }}
              </li>
            </ul>
          </div>
          <NoteEditor
            :id="group.id"
            :key="`g-${group.id}`"
            fluid
            :autofocus="false"
            class="border-t border-line pt-4"
            @close="close"
          />
          <UiButton
            variant="danger"
            @click="
              doc.removeGroup(group.id);
              editor.clearSelection();
            "
          >
            <template #icon><IconDelete class="size-3.5" /></template>
            {{ t("inspector.deleteSection") }}
          </UiButton>
        </div>
      </div>

      <!-- FREE NOTE -->
      <div
        v-else-if="target.mode === 'note'"
        class="min-h-0 flex-1 overflow-y-auto"
        data-pane="free-note"
      >
        <div class="flex flex-col gap-4 p-3.5" data-workspace>
          <label class="flex flex-col gap-1.5">
            <span class="text-ui-11 text-muted">{{ t("freeNote.text") }}</span>
            <textarea
              :value="freeNote.text"
              :placeholder="t('freeNote.placeholder')"
              :aria-label="t('freeNote.text')"
              rows="8"
              dir="auto"
              class="resize-y rounded-control border border-line-strong bg-canvas px-2.5 py-2 text-ui-125 leading-[1.8] text-fg focus-visible:border-accent"
              data-free-note-field
              @input="
                doc.updateNote(
                  freeNote.id,
                  { text: $event.target.value },
                  'text',
                )
              "
            />
          </label>
          <div class="flex flex-col gap-2">
            <span class="text-ui-11 text-muted">{{ t("freeNote.color") }}</span>
            <UiColorPalette
              flush
              :allow-none="false"
              :model-value="freeNote.color ?? DEFAULT_NOTE_COLOR"
              :custom="doc.doc.palette"
              @update:model-value="
                (c) => doc.updateNote(freeNote.id, { color: c })
              "
              @add="doc.addPaletteColor"
              @remove="doc.removePaletteColor"
            />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <label class="flex flex-col gap-1">
              <span class="text-ui-11 text-muted">{{
                t("freeNote.width")
              }}</span>
              <input
                :value="Math.round(freeNote.w)"
                :aria-label="t('freeNote.width')"
                :data-note-size="'w'"
                inputmode="numeric"
                dir="ltr"
                spellcheck="false"
                class="h-[30px] w-full min-w-0 rounded-control border border-line-strong bg-canvas px-2.5 font-mono text-xs text-fg focus-visible:border-accent focus-visible:outline-none"
                @change="onNoteSize('w', $event)"
                @keydown.enter.prevent="onNoteSize('w', $event)"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-ui-11 text-muted">{{
                t("freeNote.height")
              }}</span>
              <input
                :value="Math.round(freeNote.h)"
                :aria-label="t('freeNote.height')"
                :data-note-size="'h'"
                inputmode="numeric"
                dir="ltr"
                spellcheck="false"
                class="h-[30px] w-full min-w-0 rounded-control border border-line-strong bg-canvas px-2.5 font-mono text-xs text-fg focus-visible:border-accent focus-visible:outline-none"
                @change="onNoteSize('h', $event)"
                @keydown.enter.prevent="onNoteSize('h', $event)"
              />
            </label>
          </div>
          <div class="flex gap-2">
            <UiButton class="flex-1" @click="duplicateNote">
              <template #icon><IconCopy class="size-3.5" /></template>
              {{ t("inspector.duplicate") }}
            </UiButton>
            <UiButton
              class="flex-1"
              variant="danger"
              @click="
                doc.removeNotes([freeNote.id]);
                editor.clearSelection();
              "
            >
              <template #icon><IconDelete class="size-3.5" /></template>
              {{ t("freeNote.delete") }}
            </UiButton>
          </div>
        </div>
      </div>

      <!-- RELATIONSHIP -->
      <div
        v-else-if="target.mode === 'ref'"
        class="min-h-0 flex-1 overflow-y-auto"
        data-pane="ref"
      >
        <RelationEditor
          :key="target.ref.id"
          :ref-id="target.ref.id"
          fluid
          @close="close"
        />
      </div>

      <!-- MULTI -->
      <div v-else class="flex flex-col gap-3 p-3.5" data-pane="multi">
        <ul class="flex flex-wrap gap-1" dir="ltr" data-workspace>
          <li
            v-for="x in [...target.tables, ...target.groups, ...target.notes]"
            :key="x.id"
            class="max-w-full truncate rounded-chip border border-line-strong px-1.5 py-px font-mono text-ui-11 text-fg-soft"
          >
            {{ x.name ?? (x.text.split("\n")[0] || t("freeNote.title")) }}
          </li>
        </ul>
        <UiButton v-if="target.tables.length" @click="groupSelected">
          <template #icon><IconToolSection class="size-3.5" /></template>
          {{ t("inspector.groupSelected") }}
        </UiButton>
        <UiButton variant="danger" @click="removeSelected">
          <template #icon><IconDelete class="size-3.5" /></template>
          {{ t("inspector.deleteSelected") }}
        </UiButton>
      </div>
    </template>
  </aside>
</template>
