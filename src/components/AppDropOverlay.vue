<script setup>
import { useI18n } from "vue-i18n";

import { IconOpenFile } from "@/icons";

defineProps({ show: Boolean });
const { t } = useI18n();
</script>

<template>
  <div
    v-if="show"
    data-drop-overlay
    class="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-6"
  >
    <div
      class="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent bg-popover px-12 py-10 text-fg shadow-xl"
    >
      <IconOpenFile class="size-10 text-accent" />
      <p class="text-lg font-medium">{{ t("file.dropTitle") }}</p>
      <p class="text-sm text-fg-soft">
        {{ t("file.dropHint") }}
        <bdi dir="ltr" class="font-mono">.erd.json</bdi>
      </p>
    </div>
  </div>
</template>
