<script setup>
import { onMounted, onUnmounted, shallowRef } from "vue";

import { useI18n } from "vue-i18n";

import { setLocale } from "@/i18n";
import { listenOpenFile, readInitialFile } from "@/tauri";

const { t, locale } = useI18n();
const filePath = shallowRef(null);
let unlisten = null;

onMounted(async () => {
  filePath.value = await readInitialFile();
  unlisten = await listenOpenFile((path) => (filePath.value = path));
});
onUnmounted(() => unlisten?.());
</script>

<template>
  <main
    class="flex h-full flex-col items-center justify-center gap-3 bg-neutral-950 text-neutral-200"
  >
    <h1 class="text-xl font-semibold">{{ t("app.name") }}</h1>
    <p class="font-mono text-sm text-neutral-400" dir="ltr">
      {{ filePath ?? t("app.noFile") }}
    </p>
    <button
      class="rounded border border-neutral-700 px-3 py-1 text-sm"
      :aria-label="t('app.language')"
      @click="setLocale(locale === 'en' ? 'fa' : 'en')"
    >
      {{ locale === "en" ? "فارسی" : "English" }}
    </button>
  </main>
</template>
