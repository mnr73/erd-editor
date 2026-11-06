<script setup>
import { onBeforeUnmount, onMounted } from "vue";

import AppAskDialog from "@/components/AppAskDialog.vue";
import AppTabBar from "@/components/AppTabBar.vue";
import AppTitleBar from "@/components/AppTitleBar.vue";
import StartPage from "@/components/StartPage.vue";
import ToolRail from "@/components/ToolRail.vue";
import UiToastHost from "@/components/ui/UiToastHost.vue";

import EditorCanvas from "@/canvas/EditorCanvas.vue";
import ComponentsPage from "@/dev/ComponentsPage.vue";
import {
  closeTabWithConfirm,
  confirmCloseAll,
  newBoard,
  openPaths,
  openWithDialog,
  saveActive,
} from "@/services/files";
import { useDocumentStore } from "@/stores/document";
import {
  listenOpenFile,
  onWindowCloseRequested,
  readInitialFile,
} from "@/tauri";

const doc = useDocumentStore();
const showGallery = new URLSearchParams(location.search).has("components");
const cleanups = [];

/** App-wide file shortcuts. They work even while typing (they never insert text). */
function onKeyDown(e) {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod || e.altKey) return;
  const k = e.key.toLowerCase();
  const tabs = doc.tabList;
  const at = tabs.findIndex((x) => x.active);
  const run = (fn) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };
  if (k === "s") run(() => saveActive({ forceDialog: e.shiftKey }));
  else if (k === "o") run(openWithDialog);
  else if (k === "n") run(newBoard);
  else if (k === "w") run(() => closeTabWithConfirm(doc.activeId));
  else if (e.key === "Tab")
    run(() =>
      doc.activateTab(
        tabs[(at + (e.shiftKey ? -1 : 1) + tabs.length) % tabs.length].id,
      ),
    );
  else if (/^[1-9]$/.test(k) && !e.shiftKey)
    run(
      () =>
        tabs[k === "9" ? tabs.length - 1 : Number(k) - 1] &&
        doc.activateTab(tabs[k === "9" ? tabs.length - 1 : Number(k) - 1].id),
    );
}

onMounted(async () => {
  window.addEventListener("keydown", onKeyDown, true);
  cleanups.push(() => window.removeEventListener("keydown", onKeyDown, true));

  const initial = await readInitialFile();
  if (initial) await openPaths([initial]);
  // Until files are real in the browser, `npm run dev` opens a bundled sample so the canvas can be developed.
  else if (
    import.meta.env.DEV &&
    !new URLSearchParams(location.search).has("start")
  ) {
    const sample = await import("@/dev/sample.erd.json?raw");
    doc.load(sample.default, "~/projects/shop/shop.erd.json");
    doc.startBoard();
  }
  cleanups.push(await listenOpenFile((path) => openPaths([path])));
  cleanups.push(await onWindowCloseRequested(confirmCloseAll));
});
onBeforeUnmount(() => cleanups.forEach((fn) => fn?.()));
</script>

<template>
  <ComponentsPage v-if="showGallery" />
  <div v-else class="flex h-full flex-col">
    <AppTitleBar />
    <AppTabBar />
    <StartPage v-if="doc.isFresh" />
    <div v-else class="flex min-h-0 flex-1">
      <ToolRail />
      <main class="min-w-0 flex-1"><EditorCanvas /></main>
    </div>
  </div>
  <AppAskDialog />
  <UiToastHost />
</template>
