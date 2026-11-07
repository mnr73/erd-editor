<script setup>
import { computed, nextTick, onMounted, useTemplateRef } from "vue";

import { useI18n } from "vue-i18n";

import UiButton from "@/components/ui/UiButton.vue";
import UiSwitch from "@/components/ui/UiSwitch.vue";

import { IconDelete } from "@/icons";
import { useDocumentStore } from "@/stores/document";

/**
 * Note of a table or a section. The text is written as you type (one undo step per burst);
 * "Show on canvas" pins it as a card next to the item. Same component for both kinds.
 */
const props = defineProps({
  id: { type: String, required: true },
  fluid: Boolean,
  autofocus: { type: Boolean, default: true },
});
const emit = defineEmits(["close"]);

const { t } = useI18n();
const doc = useDocumentStore();
const area = useTemplateRef("area");

const isTable = computed(() => doc.tableById.has(props.id));
const item = computed(
  () =>
    doc.tableById.get(props.id) ??
    doc.doc.groups.find((g) => g.id === props.id),
);

function patch(p, key = null) {
  if (isTable.value) doc.updateTable(props.id, p, key);
  else doc.updateGroup(props.id, p, key);
}

onMounted(async () => {
  await nextTick();
  if (!props.autofocus) return;
  area.value?.focus({ preventScroll: true });
  area.value?.setSelectionRange(
    area.value.value.length,
    area.value.value.length,
  );
});
</script>

<template>
  <div
    v-if="item"
    data-workspace
    class="flex flex-col gap-3"
    :class="props.fluid ? 'w-full' : 'w-[300px] p-3'"
  >
    <div class="flex items-center gap-2" dir="ltr">
      <h3 class="font-sans text-xs font-semibold text-fg">
        {{ t("note.title") }}
      </h3>
      <span class="min-w-0 flex-1 truncate font-mono text-ui-115 text-muted">{{
        item.name
      }}</span>
    </div>
    <textarea
      ref="area"
      :value="item.note"
      :aria-label="t('note.title')"
      :placeholder="t('note.placeholder')"
      rows="6"
      dir="auto"
      class="resize-y rounded-control border border-line-strong bg-canvas px-2.5 py-2 text-ui-125 leading-[1.8] text-fg focus-visible:border-accent"
      data-note-text
      @input="patch({ note: $event.target.value }, 'note')"
    />
    <label class="flex items-center gap-2 text-xs text-fg-soft">
      <span class="flex-1">{{ t("note.pin") }}</span>
      <UiSwitch
        :model-value="item.noteVisible"
        :label="t('note.pin')"
        :disabled="!item.note"
        @update:model-value="patch({ noteVisible: $event })"
      />
    </label>
    <p class="text-ui-11 text-muted">{{ t("note.hint") }}</p>
    <div class="flex items-center">
      <UiButton
        variant="danger"
        size="sm"
        :disabled="!item.note"
        @click="patch({ note: '', noteVisible: false })"
      >
        <template #icon><IconDelete class="size-3.5" /></template>
        {{ t("note.clear") }}
      </UiButton>
      <span class="flex-1" />
      <UiButton variant="ghost" size="sm" @click="emit('close')">{{
        t("common.close")
      }}</UiButton>
    </div>
  </div>
</template>
