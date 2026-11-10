<script setup>
import { computed } from "vue";

import { useI18n } from "vue-i18n";

import UiButton from "@/components/ui/UiButton.vue";

import { useDiskWarnings } from "@/composables/useDiskWatch";
import { IconReload } from "@/icons";
import { keepMine } from "@/services/disk";
import { reloadTab, saveActive } from "@/services/files";
import { useDocumentStore } from "@/stores/document";
import { baseName } from "@/utils/path";

/**
 * Shown over the top of the board when the file of the active tab was changed (or deleted) outside the
 * app while the tab has unsaved changes. It never acts by itself: the user picks.
 */
const { t } = useI18n();
const doc = useDocumentStore();
const warnings = useDiskWarnings();

const kind = computed(() => warnings.value[doc.activeId] ?? null);
const name = computed(() => (doc.path ? baseName(doc.path) : ""));

async function reload() {
  await reloadTab(doc.activeId);
}
</script>

<template>
  <div
    v-if="kind"
    class="absolute inset-x-0 top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-warn/60 bg-warn/15 px-4 py-2 text-xs text-fg shadow-popover"
    role="alert"
    data-disk-banner
    :data-kind="kind"
  >
    <IconReload class="size-4 shrink-0 text-warn" />
    <span class="min-w-0 flex-1">
      {{
        t(kind === "gone" ? "disk.goneBanner" : "disk.changedBanner", { name })
      }}
    </span>
    <div class="flex shrink-0 gap-2">
      <UiButton
        v-if="kind === 'changed'"
        size="sm"
        variant="primary"
        data-disk-reload
        @click="reload"
        >{{ t("disk.reload") }}</UiButton
      >
      <UiButton
        v-if="kind === 'gone'"
        size="sm"
        variant="primary"
        data-disk-save
        @click="saveActive()"
        >{{ t("disk.saveAgain") }}</UiButton
      >
      <UiButton size="sm" data-disk-keep @click="keepMine(doc.activeId)">{{
        t(kind === "gone" ? "disk.dismiss" : "disk.keepMine")
      }}</UiButton>
    </div>
  </div>
</template>
