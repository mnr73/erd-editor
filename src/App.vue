<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

import AppAskDialog from "@/components/AppAskDialog.vue";
import AppDropOverlay from "@/components/AppDropOverlay.vue";
import AppExportDialog from "@/components/AppExportDialog.vue";
import AppHelpDialog from "@/components/AppHelpDialog.vue";
import AppImportDialog from "@/components/AppImportDialog.vue";
import AppInspector from "@/components/AppInspector.vue";
import AppNewBoardDialog from "@/components/AppNewBoardDialog.vue";
import AppSettingsDialog from "@/components/AppSettingsDialog.vue";
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
  openDropped,
  openPaths,
  openWithDialog,
  saveActive,
} from "@/services/files";
import { autoUpdate } from "@/services/updates";
import { useDocumentStore } from "@/stores/document";
import { useEditorStore } from "@/stores/editor";
import {
  listenFileDrop,
  listenOpenFile,
  onWindowCloseRequested,
  readInitialFile,
} from "@/tauri";
import { shortcutKey } from "@/utils/keys";

const doc = useDocumentStore();
const editor = useEditorStore();
const showGallery = new URLSearchParams(location.search).has("components");
const cleanups = [];
const titleBar = ref(null);
const dragging = ref(false);

/** App-wide file shortcuts. They work even while typing (they never insert text). */
function onKeyDown(e) {
  if (e.key === "F1") {
    e.preventDefault();
    e.stopPropagation();
    editor.toggleHelp();
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  if (!mod || e.altKey) return;
  const k = shortcutKey(e);
  const tabs = doc.tabList;
  const at = tabs.findIndex((x) => x.active);
  const run = (fn) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };
  if (k === "k") run(() => titleBar.value?.focusSearch());
  else if (k === "e" && !e.shiftKey)
    run(
      () =>
        !doc.isFresh &&
        editor.openExport(editor.selected.size ? "selection" : "all"),
    );
  else if (k === "i" && e.shiftKey) run(() => editor.openImport());
  else if (k === "\\") run(() => editor.toggleInspector());
  else if (k === "s") run(() => saveActive({ forceDialog: e.shiftKey }));
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
  cleanups.push(
    await listenFileDrop({
      onHover: (v) => (dragging.value = v),
      onDrop: openDropped,
    }),
  );
  cleanups.push(await onWindowCloseRequested(confirmCloseAll));
  // after everything is on screen; never awaited, so a slow network cannot delay the app
  setTimeout(() => autoUpdate(), 3000);
});
onBeforeUnmount(() => cleanups.forEach((fn) => fn?.()));
</script>

<template>
  <ComponentsPage v-if="showGallery" />
  <div v-else class="flex h-full flex-col">
    <AppTitleBar ref="titleBar" />
    <AppTabBar />
    <StartPage v-if="doc.isFresh" />
    <div v-else class="flex min-h-0 flex-1">
      <ToolRail />
      <main class="relative min-w-0 flex-1">
        <EditorCanvas />
      </main>
      <AppInspector v-if="editor.inspectorOpen" />
    </div>
  </div>
  <AppAskDialog />
  <AppExportDialog />
  <AppHelpDialog />
  <AppImportDialog />
  <AppNewBoardDialog />
  <AppSettingsDialog />
  <AppDropOverlay :show="dragging" />
  <UiToastHost />
</template>
