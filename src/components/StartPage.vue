<script setup>
import { useI18n } from "vue-i18n";

import NewBoardChoices from "@/components/NewBoardChoices.vue";

import { IconFile } from "@/icons";

/**
 * Shown while the app has no board yet (launched directly, not through Open with). Three big choices
 * (empty, open, sample), no recent-files list on purpose: the app is a viewer/editor for files you
 * open from the file manager. The same choices are in the "new board" dialog.
 */
const { t } = useI18n();
</script>

<template>
  <div
    class="flex h-full items-start justify-center overflow-auto bg-canvas p-8 sm:items-center"
    data-start-page
  >
    <div class="w-full max-w-md">
      <span
        class="flex size-12 items-center justify-center rounded-popover bg-accent-soft text-accent-text"
      >
        <IconFile class="size-6" />
      </span>
      <h1 class="mt-4 text-lg font-semibold text-fg">{{ t("start.title") }}</h1>
      <p class="mt-1 text-xs text-muted">{{ t("start.subtitle") }}</p>

      <NewBoardChoices class="mt-6" />
    </div>
  </div>
</template>
