<script setup>
import { computed } from "vue";

import { useI18n } from "vue-i18n";

import UiButton from "@/components/ui/UiButton.vue";
import UiCombobox from "@/components/ui/UiCombobox.vue";
import UiInput from "@/components/ui/UiInput.vue";

import { typeSuggestions } from "@/model/types";
import { useDocumentStore } from "@/stores/document";

/**
 * Popover body for editing one column. Every change is written to the document immediately
 * (coalesced per field), there is no Save button. Fields hold data, so the whole body carries
 * `data-workspace` (Latin digits, workspace font).
 */
const props = defineProps({
  tableId: { type: String, required: true },
  columnId: { type: String, required: true },
});
const emit = defineEmits(["close", "navigate"]);

const { t } = useI18n();
const doc = useDocumentStore();

const table = computed(() => doc.tableById.get(props.tableId));
const column = computed(() =>
  table.value?.columns.find((c) => c.id === props.columnId),
);
const dbType = computed(() => doc.doc.meta.dbType);

function set(patch, key) {
  doc.updateColumn(props.tableId, props.columnId, patch, key);
}

const flags = computed(() => [
  { key: "pk", label: "PK", on: column.value.pk, title: t("column.pk") },
  {
    key: "unique",
    label: "UNIQUE",
    on: column.value.unique,
    title: t("column.unique"),
  },
  {
    key: "notNull",
    label: "NOT NULL",
    on: column.value.notNull,
    title: t("column.notNull"),
  },
  {
    key: "increment",
    label: "AUTO INC",
    on: column.value.increment,
    title: t("column.increment"),
  },
]);

function toggle(key) {
  set({ [key]: !column.value[key] });
}

function remove() {
  doc.removeColumn(props.tableId, props.columnId);
  emit("close");
}

function onKey(e) {
  if (e.target.tagName === "TEXTAREA") return;
  if ((e.key === "ArrowUp" || e.key === "ArrowDown") && e.altKey) {
    e.preventDefault();
    emit("navigate", e.key === "ArrowDown" ? 1 : -1);
  }
}
</script>

<template>
  <div
    v-if="column"
    data-workspace
    class="flex w-[300px] flex-col gap-3 p-3"
    @keydown="onKey"
  >
    <div class="flex gap-2" dir="ltr">
      <UiInput
        :model-value="column.name"
        mono
        :label="t('column.name')"
        class="flex-1"
        @update:model-value="set({ name: $event }, 'name')"
      />
      <div class="w-[116px] shrink-0">
        <UiCombobox
          :model-value="column.type"
          mono
          :label="t('column.type')"
          :suggest="(q) => typeSuggestions(q, dbType)"
          @update:model-value="set({ type: $event }, 'type')"
        />
      </div>
    </div>

    <div
      class="flex flex-wrap gap-1"
      dir="ltr"
      role="group"
      :aria-label="t('column.flags')"
    >
      <button
        v-for="f in flags"
        :key="f.key"
        type="button"
        :aria-pressed="f.on"
        :title="f.title"
        class="h-6 rounded-chip border px-2 font-mono text-[10.5px] transition-colors"
        :class="
          f.on
            ? 'border-accent bg-accent-soft text-accent-text'
            : 'border-line-strong text-muted hover:text-fg'
        "
        @click="toggle(f.key)"
      >
        {{ f.label }}
      </button>
    </div>

    <label class="flex items-center gap-2">
      <span class="w-[70px] shrink-0 text-[11px] text-muted">{{
        t("column.default")
      }}</span>
      <UiInput
        :model-value="column.default"
        mono
        :label="t('column.default')"
        placeholder="NULL"
        @update:model-value="set({ default: $event }, 'default')"
      />
    </label>

    <label class="flex items-start gap-2">
      <span class="w-[70px] shrink-0 pt-[5px] text-[11px] text-muted">{{
        t("column.comment")
      }}</span>
      <textarea
        :value="column.note"
        :aria-label="t('column.comment')"
        rows="2"
        class="min-w-0 flex-1 resize-none rounded-control border border-line-strong bg-canvas px-2 py-[5px] text-[11.5px] leading-[1.6] text-fg focus-visible:border-accent"
        @input="set({ note: $event.target.value }, 'note')"
      />
    </label>

    <div class="flex items-center">
      <UiButton variant="danger" size="sm" @click="remove">{{
        t("column.delete")
      }}</UiButton>
      <span class="flex-1" />
      <span class="text-[10.5px] text-muted">
        <kbd dir="ltr" class="font-mono">Alt ↑↓</kbd> {{ t("column.nav") }}
      </span>
    </div>
  </div>
</template>
