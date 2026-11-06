<script setup>
import { computed } from "vue";

import { useI18n } from "vue-i18n";

import UiButton from "@/components/ui/UiButton.vue";
import UiInput from "@/components/ui/UiInput.vue";

import { IconDelete, IconRelationSwap } from "@/icons";
import { CARDINALITIES, REF_ACTIONS } from "@/model/constants";
import { relationKind } from "@/model/document";
import { useDocumentStore } from "@/stores/document";

/**
 * One relationship: both ends (table.column + cardinality), the derived kind (1:N …), On Delete /
 * On Update, an optional label, swap and delete. Every change is written immediately.
 */
const props = defineProps({
  refId: { type: String, required: true },
  fluid: Boolean,
});
const emit = defineEmits(["close"]);

const { t } = useI18n();
const doc = useDocumentStore();

const ref = computed(() => doc.doc.refs.find((r) => r.id === props.refId));
const kind = computed(() => (ref.value ? relationKind(ref.value) : ""));

const endText = (end) => {
  const tb = doc.tableById.get(end.table);
  const names = end.columns.map(
    (id) => tb?.columns.find((c) => c.id === id)?.name ?? "?",
  );
  return `${tb?.name ?? "?"}.${names.join(", ")}`;
};

const CARD_LABEL = {
  1: "1",
  "0..1": "0..1",
  "1..*": "1..*",
  "0..*": "0..*",
};
const actionOptions = ["", ...REF_ACTIONS];
const actionLabel = (a) => (a ? a.toUpperCase() : t("relation.none"));

function swap() {
  doc.swapRef(props.refId);
}
function remove() {
  doc.removeRef(props.refId);
  emit("close");
}
</script>

<template>
  <div
    v-if="ref"
    data-workspace
    class="flex flex-col gap-3 p-3"
    :class="props.fluid ? 'w-full' : 'w-[320px]'"
    @keydown.enter.self.prevent
  >
    <div class="flex items-center gap-2" dir="ltr">
      <h3 class="font-sans text-xs font-semibold text-fg">
        {{ t("relation.title") }}
      </h3>
      <span
        class="rounded-kbd bg-accent-soft px-1.5 font-mono text-[10.5px] text-accent-text"
        data-kind
        >{{ kind }}</span
      >
      <span class="flex-1" />
      <button
        type="button"
        class="inline-flex h-6 items-center gap-1 rounded-control border border-line-strong px-2 text-[11px] text-fg-soft hover:bg-hover"
        :title="t('relation.swap')"
        data-swap
        @click="swap"
      >
        <IconRelationSwap class="size-3.5" />
        {{ t("relation.swapShort") }}
      </button>
    </div>

    <div
      v-for="side in ['from', 'to']"
      :key="side"
      class="flex flex-col gap-1.5 rounded-control border border-line-strong p-2"
      :data-side="side"
      dir="ltr"
    >
      <div class="flex items-center gap-2">
        <span
          class="w-14 shrink-0 font-sans text-[10.5px] whitespace-nowrap text-muted"
          >{{ side === "from" ? t("relation.from") : t("relation.to") }}</span
        >
        <span class="min-w-0 flex-1 truncate font-mono text-[11.5px] text-fg">{{
          endText(ref[side])
        }}</span>
      </div>
      <div
        class="flex gap-1"
        role="group"
        :aria-label="t('relation.cardinality')"
      >
        <button
          v-for="c in CARDINALITIES"
          :key="c"
          type="button"
          :aria-pressed="ref[side].cardinality === c"
          :data-card="c"
          class="h-6 flex-1 rounded-chip border font-mono text-[10.5px] transition-colors"
          :class="
            ref[side].cardinality === c
              ? 'border-accent bg-accent-soft text-accent-text'
              : 'border-line-strong text-muted hover:text-fg'
          "
          @click="doc.updateRefEnd(props.refId, side, { cardinality: c })"
        >
          {{ CARD_LABEL[c] }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-[70px_1fr] items-center gap-x-2 gap-y-2">
      <span class="font-mono text-[11px] text-muted">ON DELETE</span>
      <select
        :value="ref.onDelete ?? ''"
        :aria-label="'ON DELETE'"
        class="h-7 rounded-control border border-line-strong bg-canvas px-2 font-mono text-[11px] text-fg"
        data-on-delete
        @change="
          doc.updateRef(props.refId, { onDelete: $event.target.value || null })
        "
      >
        <option v-for="a in actionOptions" :key="a" :value="a">
          {{ actionLabel(a) }}
        </option>
      </select>
      <span class="font-mono text-[11px] text-muted">ON UPDATE</span>
      <select
        :value="ref.onUpdate ?? ''"
        :aria-label="'ON UPDATE'"
        class="h-7 rounded-control border border-line-strong bg-canvas px-2 font-mono text-[11px] text-fg"
        data-on-update
        @change="
          doc.updateRef(props.refId, { onUpdate: $event.target.value || null })
        "
      >
        <option v-for="a in actionOptions" :key="a" :value="a">
          {{ actionLabel(a) }}
        </option>
      </select>
      <span class="font-sans text-[11px] text-muted">{{
        t("relation.label")
      }}</span>
      <UiInput
        :model-value="ref.label"
        :label="t('relation.label')"
        :placeholder="t('relation.labelPlaceholder')"
        @update:model-value="
          doc.updateRef(props.refId, { label: $event }, 'label')
        "
      />
    </div>

    <div class="flex items-center">
      <UiButton variant="danger" size="sm" @click="remove">
        <template #icon><IconDelete class="size-3.5" /></template>
        {{ t("relation.delete") }}
      </UiButton>
      <span class="flex-1" />
      <UiButton variant="ghost" size="sm" @click="emit('close')">{{
        t("common.close")
      }}</UiButton>
    </div>
  </div>
</template>
