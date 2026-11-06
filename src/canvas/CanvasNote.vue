<script setup>
import { computed } from "vue";

import { useI18n } from "vue-i18n";

import { IconPin } from "@/icons";

/**
 * A pinned note: a small sticky card under its table / section. It is positioned by the parent from
 * the live geometry, so it follows drags and resizes. Clicking it opens the note editor.
 */
const props = defineProps({
  note: { type: Object, required: true }, // { id, text, x, y, w }
  selected: Boolean,
});
const emit = defineEmits(["open"]);
const { t } = useI18n();

const style = computed(() => ({
  left: `${props.note.x}px`,
  top: `${props.note.y}px`,
  width: `${props.note.w}px`,
  background: "color-mix(in srgb, var(--c-warn) 13%, var(--c-card))",
  borderColor: "color-mix(in srgb, var(--c-warn) 45%, transparent)",
}));
</script>

<template>
  <button
    type="button"
    class="absolute z-[2] flex cursor-pointer items-start gap-1.5 rounded-[8px] border px-2.5 py-2 text-start font-sans text-[11.5px] leading-[1.7] text-fg-soft shadow-table hover:brightness-110"
    :style="style"
    :aria-label="t('note.open')"
    :data-note-card="props.note.id"
    data-workspace
    @pointerdown.stop
    @dblclick.stop
    @click.stop="emit('open', props.note.id)"
  >
    <IconPin class="mt-[3px] size-3 shrink-0 text-warn" />
    <span class="min-w-0 flex-1 break-words whitespace-pre-wrap" dir="auto">{{
      props.note.text
    }}</span>
  </button>
</template>
