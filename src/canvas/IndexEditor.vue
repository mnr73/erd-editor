<script setup>
import { computed, ref } from "vue";

import { useI18n } from "vue-i18n";

import UiButton from "@/components/ui/UiButton.vue";
import UiInput from "@/components/ui/UiInput.vue";
import UiSegmented from "@/components/ui/UiSegmented.vue";
import UiSwitch from "@/components/ui/UiSwitch.vue";

import { IconAdd, IconClose, IconDelete } from "@/icons";
import { findSameIndex, indexName, moveItem } from "@/model/indexes";
import { useDocumentStore } from "@/stores/document";

/**
 * Indexes of one table: the existing ones (rename, unique, type, reorder / remove columns, delete)
 * and a form for a new one. Column ORDER matters (leftmost-prefix rule), so the chips can be moved.
 * Edits to existing indexes apply immediately; the new index is written by "Create index".
 * `initial` pre-fills the new index (e.g. from a column selection), `focus` expands one existing index.
 */
const props = defineProps({
  tableId: { type: String, required: true },
  initial: { type: Array, default: () => [] },
  focus: { type: String, default: null },
});
const emit = defineEmits(["close"]);

const { t } = useI18n();
const doc = useDocumentStore();

const table = computed(() => doc.tableById.get(props.tableId));

/* ------------------------------ new index form ----------------------------- */
const draft = ref({
  name: "",
  unique: false,
  type: "",
  columns: [...props.initial],
});
const colName = (id) =>
  table.value.columns.find((c) => c.id === id)?.name || "?";
const free = computed(() =>
  table.value.columns.filter((c) => !draft.value.columns.includes(c.id)),
);
const duplicate = computed(() =>
  draft.value.columns.length
    ? findSameIndex(table.value, draft.value.columns)
    : null,
);

function pick(id) {
  draft.value.columns = [...draft.value.columns, id];
}
function drop(id) {
  draft.value.columns = draft.value.columns.filter((c) => c !== id);
}
function shift(id, dir) {
  const i = draft.value.columns.indexOf(id);
  const next = moveItem(draft.value.columns, i, i + dir);
  if (next) draft.value.columns = next;
}
function create() {
  if (!draft.value.columns.length) return;
  doc.addIndex(props.tableId, {
    name: draft.value.name.trim(),
    unique: draft.value.unique,
    type: draft.value.type || null,
    columns: draft.value.columns,
  });
  draft.value = { name: "", unique: false, type: "", columns: [] };
}

/* ----------------------------- existing indexes ---------------------------- */
const open = ref(props.focus);
const typeOptions = [
  { value: "", label: t("index.typeDefault") },
  { value: "btree", label: "BTREE" },
  { value: "hash", label: "HASH" },
];

const patch = (ix, p, key) => doc.updateIndex(props.tableId, ix.id, p, key);
function removeColumn(ix, id) {
  const columns = ix.columns.filter((c) => c !== id);
  // an index without columns is meaningless: removing the last one removes the index
  if (columns.length) patch(ix, { columns });
  else doc.removeIndex(props.tableId, ix.id);
}
function moveColumn(ix, id, dir) {
  const i = ix.columns.indexOf(id);
  const next = moveItem(ix.columns, i, i + dir);
  if (next) patch(ix, { columns: next });
}
function addColumn(ix, id) {
  patch(ix, { columns: [...ix.columns, id] });
}
const freeFor = (ix) =>
  table.value.columns.filter((c) => !ix.columns.includes(c.id));
</script>

<template>
  <div
    v-if="table"
    data-workspace
    class="flex max-h-[min(560px,80vh)] w-[340px] flex-col gap-3 overflow-y-auto p-3"
    @keydown.enter.self.prevent
  >
    <h3 class="font-sans text-xs font-semibold text-fg" dir="auto">
      {{ t("index.title") }} · <span class="font-mono">{{ table.name }}</span>
    </h3>

    <!-- existing -->
    <section :aria-label="t('index.existing')" class="flex flex-col gap-1.5">
      <p v-if="!table.indexes.length" class="text-[11.5px] text-muted">
        {{ t("index.none") }}
      </p>
      <div
        v-for="ix in table.indexes"
        :key="ix.id"
        :data-index-id="ix.id"
        class="rounded-control border border-line-strong"
      >
        <button
          type="button"
          class="flex w-full items-center gap-2 px-2 py-1.5 text-start"
          :aria-expanded="open === ix.id"
          @click="open = open === ix.id ? null : ix.id"
        >
          <span
            class="min-w-0 flex-1 truncate font-mono text-[11.5px] text-fg"
            >{{ indexName(table, ix) }}</span
          >
          <span
            v-if="ix.unique"
            class="rounded-kbd bg-accent-soft px-1 font-mono text-[9.5px] text-accent-text"
            >UNIQUE</span
          >
          <span class="font-mono text-[10.5px] text-faint">{{
            ix.columns.map(colName).join(", ")
          }}</span>
        </button>

        <div
          v-if="open === ix.id"
          class="flex flex-col gap-2 border-t border-line p-2"
        >
          <UiInput
            :model-value="ix.name"
            mono
            :label="t('index.name')"
            :placeholder="t('index.namePlaceholder')"
            @update:model-value="patch(ix, { name: $event }, 'ixname')"
          />
          <div class="flex flex-wrap items-center gap-2" dir="ltr">
            <label class="flex items-center gap-1.5 text-[11px] text-muted">
              <UiSwitch
                :model-value="ix.unique"
                :label="t('index.unique')"
                @update:model-value="patch(ix, { unique: $event })"
              />
              {{ t("index.unique") }}
            </label>
            <span class="flex-1" />
            <UiSegmented
              :model-value="ix.type ?? ''"
              :label="t('index.type')"
              :options="typeOptions"
              @update:model-value="patch(ix, { type: $event || null })"
            />
          </div>

          <ol class="flex flex-col gap-1" dir="ltr">
            <li
              v-for="(id, i) in ix.columns"
              :key="id"
              class="flex items-center gap-1.5 rounded-kbd bg-canvas px-1.5 py-1"
            >
              <span class="w-4 text-center font-mono text-[10px] text-faint">{{
                i + 1
              }}</span>
              <span
                class="min-w-0 flex-1 truncate font-mono text-[11.5px] text-fg"
                >{{ colName(id) }}</span
              >
              <button
                type="button"
                class="size-5 rounded-kbd text-muted hover:bg-hover hover:text-fg disabled:opacity-30"
                :aria-label="t('index.earlier', { name: colName(id) })"
                :disabled="i === 0"
                @click="moveColumn(ix, id, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                class="size-5 rounded-kbd text-muted hover:bg-hover hover:text-fg disabled:opacity-30"
                :aria-label="t('index.later', { name: colName(id) })"
                :disabled="i === ix.columns.length - 1"
                @click="moveColumn(ix, id, 1)"
              >
                ↓
              </button>
              <button
                type="button"
                class="inline-flex size-5 items-center justify-center rounded-kbd text-muted hover:bg-hover hover:text-danger"
                :aria-label="t('index.removeColumn', { name: colName(id) })"
                @click="removeColumn(ix, id)"
              >
                <IconClose class="size-3" />
              </button>
            </li>
          </ol>
          <div v-if="freeFor(ix).length" class="flex flex-wrap gap-1" dir="ltr">
            <button
              v-for="c in freeFor(ix)"
              :key="c.id"
              type="button"
              class="inline-flex h-5 items-center gap-1 rounded-chip border border-dashed border-line-strong px-1.5 font-mono text-[10.5px] text-muted hover:border-accent hover:text-accent-text"
              :aria-label="t('index.addColumn', { name: c.name })"
              @click="addColumn(ix, c.id)"
            >
              <IconAdd class="size-3" />{{ c.name }}
            </button>
          </div>
          <UiButton
            variant="danger"
            size="sm"
            class="self-start"
            @click="doc.removeIndex(props.tableId, ix.id)"
          >
            <template #icon><IconDelete class="size-3.5" /></template>
            {{ t("index.delete") }}
          </UiButton>
        </div>
      </div>
    </section>

    <!-- new -->
    <section
      class="flex flex-col gap-2 border-t border-line pt-3"
      :aria-label="t('index.newTitle')"
    >
      <h4 class="font-sans text-[11px] font-semibold text-muted">
        {{ t("index.newTitle") }}
      </h4>
      <p class="text-[11px] text-muted">{{ t("index.pick") }}</p>

      <ol
        v-if="draft.columns.length"
        class="flex flex-col gap-1"
        dir="ltr"
        data-draft-columns
      >
        <li
          v-for="(id, i) in draft.columns"
          :key="id"
          class="flex items-center gap-1.5 rounded-kbd bg-canvas px-1.5 py-1"
        >
          <span class="w-4 text-center font-mono text-[10px] text-faint">{{
            i + 1
          }}</span>
          <span
            class="min-w-0 flex-1 truncate font-mono text-[11.5px] text-fg"
            >{{ colName(id) }}</span
          >
          <button
            type="button"
            class="size-5 rounded-kbd text-muted hover:bg-hover hover:text-fg disabled:opacity-30"
            :aria-label="t('index.earlier', { name: colName(id) })"
            :disabled="i === 0"
            @click="shift(id, -1)"
          >
            ↑
          </button>
          <button
            type="button"
            class="size-5 rounded-kbd text-muted hover:bg-hover hover:text-fg disabled:opacity-30"
            :aria-label="t('index.later', { name: colName(id) })"
            :disabled="i === draft.columns.length - 1"
            @click="shift(id, 1)"
          >
            ↓
          </button>
          <button
            type="button"
            class="inline-flex size-5 items-center justify-center rounded-kbd text-muted hover:bg-hover hover:text-danger"
            :aria-label="t('index.removeColumn', { name: colName(id) })"
            @click="drop(id)"
          >
            <IconClose class="size-3" />
          </button>
        </li>
      </ol>
      <div
        v-if="free.length"
        class="flex flex-wrap gap-1"
        dir="ltr"
        data-free-columns
      >
        <button
          v-for="c in free"
          :key="c.id"
          type="button"
          class="inline-flex h-5 items-center gap-1 rounded-chip border border-dashed border-line-strong px-1.5 font-mono text-[10.5px] text-muted hover:border-accent hover:text-accent-text"
          :aria-label="t('index.addColumn', { name: c.name })"
          @click="pick(c.id)"
        >
          <IconAdd class="size-3" />{{ c.name }}
        </button>
      </div>

      <UiInput
        v-model="draft.name"
        mono
        :label="t('index.name')"
        :placeholder="t('index.namePlaceholder')"
      />
      <div class="flex items-center gap-2" dir="ltr">
        <label class="flex items-center gap-1.5 text-[11px] text-muted">
          <UiSwitch v-model="draft.unique" :label="t('index.unique')" />
          {{ t("index.unique") }}
        </label>
        <span class="flex-1" />
        <UiSegmented
          v-model="draft.type"
          :label="t('index.type')"
          :options="typeOptions"
        />
      </div>

      <p v-if="duplicate" class="text-[11px] text-warn" role="status">
        {{ indexName(table, duplicate) }}
      </p>
      <div class="flex items-center gap-2">
        <UiButton
          variant="primary"
          :disabled="!draft.columns.length"
          data-create-index
          @click="create"
        >
          {{ t("index.create") }}
        </UiButton>
        <span v-if="!draft.columns.length" class="text-[11px] text-muted">{{
          t("index.needColumn")
        }}</span>
        <span class="flex-1" />
        <UiButton variant="ghost" @click="emit('close')">{{
          t("common.close")
        }}</UiButton>
      </div>
    </section>
  </div>
</template>
