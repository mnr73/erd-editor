<script setup>
import { useI18n } from "vue-i18n";

import { useRecent } from "@/composables/useRecent";
import { IconFile } from "@/icons";
import { openPaths } from "@/services/files";
import { isTauri } from "@/tauri";
import { baseName, splitPath } from "@/utils/path";

/**
 * The last few files, shown under the start choices (start page and "new board" dialog). Desktop only,
 * the browser has no file paths. `done` fires right before opening, like the choices next to it.
 */
const emit = defineEmits(["done"]);
const { t } = useI18n();
const { recent } = useRecent();
const canOpen = isTauri();

function open(path) {
  emit("done");
  openPaths([path]);
}
</script>

<template>
  <div v-if="canOpen && recent.length" data-recent>
    <h2
      class="mb-1.5 px-3.5 text-ui-11 font-semibold tracking-wide text-faint uppercase"
    >
      {{ t("start.recent") }}
    </h2>
    <ul class="flex flex-col">
      <li v-for="path in recent" :key="path">
        <button
          type="button"
          :data-recent-path="path"
          :title="path"
          class="flex w-full items-center gap-3 rounded-control px-3.5 py-1.5 text-start transition-colors hover:bg-hover"
          @click="open(path)"
        >
          <IconFile class="size-5 shrink-0 text-muted" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-xs font-medium text-fg">{{
              baseName(path)
            }}</span>
            <span
              dir="ltr"
              class="block truncate text-start text-ui-105 text-faint"
              >{{ splitPath(path).dir }}</span
            >
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
