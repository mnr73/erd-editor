<script setup>
import { onMounted, onUnmounted, shallowRef } from "vue";

import AppTitleBar from "@/components/AppTitleBar.vue";
import ToolRail from "@/components/ToolRail.vue";
import UiToastHost from "@/components/ui/UiToastHost.vue";

import EditorCanvas from "@/canvas/EditorCanvas.vue";
import ComponentsPage from "@/dev/ComponentsPage.vue";
import { useDocumentStore } from "@/stores/document";
import { listenOpenFile, readInitialFile } from "@/tauri";

const doc = useDocumentStore();
const filePath = shallowRef(null);
const showGallery = new URLSearchParams(location.search).has("components");
let unlisten = null;

onMounted(async () => {
  filePath.value = await readInitialFile();
  unlisten = await listenOpenFile((path) => (filePath.value = path));
  // Until stage 8 (file I/O in Rust) the browser dev build opens a bundled sample diagram.
  if (import.meta.env.DEV && !filePath.value) {
    const sample = await import("@/dev/sample.erd.json?raw");
    doc.load(sample.default, "~/projects/shop/shop.erd.json");
  }
});
onUnmounted(() => unlisten?.());
</script>

<template>
  <ComponentsPage v-if="showGallery" />
  <div v-else class="flex h-full flex-col">
    <AppTitleBar />
    <div class="flex min-h-0 flex-1">
      <ToolRail />
      <main class="min-w-0 flex-1"><EditorCanvas /></main>
    </div>
  </div>
  <UiToastHost />
</template>
