<script setup>
import { useI18n } from "vue-i18n";

import RecentFiles from "@/components/RecentFiles.vue";

import { IconNewFile, IconOpenFile, IconSampleBoard } from "@/icons";
import {
  newEmptyBoard,
  newSampleBoard,
  openWithDialog,
} from "@/services/files";
import { isTauri } from "@/tauri";

/**
 * The three ways to get a board: empty, from a file, or the sample. Shared by the start page and the
 * "new board" dialog so they can never offer different things. `done` fires right before the action
 * runs (the dialog closes itself on it).
 */
const emit = defineEmits(["done"]);
const { t } = useI18n();
const canOpen = isTauri();

const CHOICES = [
  { id: "empty", icon: IconNewFile, run: newEmptyBoard },
  { id: "open", icon: IconOpenFile, run: openWithDialog },
  { id: "sample", icon: IconSampleBoard, run: newSampleBoard },
];

async function choose(c) {
  emit("done");
  await c.run();
}
</script>

<template>
  <div class="flex flex-col gap-2.5" data-new-choices>
    <button
      v-for="(c, i) in CHOICES"
      :key="c.id"
      type="button"
      :data-choice="c.id"
      :data-autofocus="i === 0 ? '' : undefined"
      :disabled="c.id === 'open' && !canOpen"
      class="flex items-center gap-3 rounded-popover border border-line-strong bg-panel p-3.5 text-start transition-colors hover:border-faint hover:bg-hover disabled:pointer-events-none disabled:opacity-45"
      @click="choose(c)"
    >
      <component :is="c.icon" class="size-5 shrink-0 text-accent-text" />
      <span class="flex-1">
        <span class="block text-sm font-medium text-fg">{{
          t(`start.${c.id}`)
        }}</span>
        <span class="block text-xs text-muted">{{
          c.id === "open" && !canOpen
            ? t("start.browserNote")
            : t(`start.${c.id}Hint`)
        }}</span>
      </span>
    </button>
    <RecentFiles class="mt-3" @done="emit('done')" />
  </div>
</template>
