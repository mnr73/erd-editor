<script setup>
import { useI18n } from "vue-i18n";

import { IconFile, IconNewFile, IconOpenFile } from "@/icons";
import { newBoard, openWithDialog } from "@/services/files";
import { isTauri } from "@/tauri";

/**
 * Shown while the app has no board yet (launched directly, not through Open with). Two big choices,
 * no recent-files list on purpose: the app is a viewer/editor for files you open from the file manager.
 */
const { t } = useI18n();
const canOpen = isTauri();
</script>

<template>
  <div
    class="flex h-full items-center justify-center bg-canvas p-8"
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

      <div class="mt-6 flex flex-col gap-2.5">
        <button
          type="button"
          data-autofocus
          class="flex items-center gap-3 rounded-popover border border-line-strong bg-panel p-3.5 text-start transition-colors hover:border-faint hover:bg-hover"
          @click="newBoard"
        >
          <IconNewFile class="size-5 shrink-0 text-accent-text" />
          <span class="flex-1">
            <span class="block text-sm font-medium text-fg">{{
              t("start.new")
            }}</span>
            <span class="block text-xs text-muted">{{
              t("start.newHint")
            }}</span>
          </span>
        </button>
        <button
          type="button"
          :disabled="!canOpen"
          class="flex items-center gap-3 rounded-popover border border-line-strong bg-panel p-3.5 text-start transition-colors hover:border-faint hover:bg-hover disabled:pointer-events-none disabled:opacity-45"
          @click="openWithDialog"
        >
          <IconOpenFile class="size-5 shrink-0 text-accent-text" />
          <span class="flex-1">
            <span class="block text-sm font-medium text-fg">{{
              t("start.open")
            }}</span>
            <span class="block text-xs text-muted">{{
              canOpen ? t("start.openHint") : t("start.browserNote")
            }}</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
