<script setup>
import { computed, useTemplateRef } from "vue";

import { useI18n } from "vue-i18n";

import AppSearch from "@/components/AppSearch.vue";
import UiIconButton from "@/components/ui/UiIconButton.vue";
import UiSegmented from "@/components/ui/UiSegmented.vue";

import { setLocale } from "@/i18n";
import { IconDownload, IconInspector, IconUpload } from "@/icons";
import { useDocumentStore } from "@/stores/document";
import { useEditorStore } from "@/stores/editor";
import { splitPath } from "@/utils/path";

/** Thin title bar: file location + unsaved dot on the start side, language switch on the end side. */
const { t, locale } = useI18n();
const doc = useDocumentStore();
const search = useTemplateRef("search");
defineExpose({ focusSearch: () => search.value?.focus() });
const editor = useEditorStore();

const file = computed(() => splitPath(doc.path));
const fileName = computed(() => file.value.name || t("title.untitled"));
const lang = computed({
  get: () => locale.value,
  set: (v) => setLocale(v),
});
</script>

<template>
  <header
    class="flex h-[var(--size-titlebar)] shrink-0 items-center gap-3 border-b border-line bg-app px-3"
  >
    <div class="flex min-w-0 items-center gap-2">
      <span class="size-5 shrink-0 rounded-[6px] bg-accent" />
      <span
        class="truncate font-mono text-xs text-faint"
        dir="ltr"
        data-workspace
      >
        {{ file.dir }}<span class="text-fg">{{ fileName }}</span>
      </span>
      <template v-if="doc.dirty">
        <span class="size-[7px] shrink-0 rounded-full bg-warn" />
        <span class="shrink-0 text-[11.5px] text-muted">{{
          t("title.unsaved")
        }}</span>
      </template>
    </div>
    <span class="flex-1" />
    <AppSearch ref="search" />
    <UiIconButton
      :label="t('import.title')"
      shortcut="Ctrl+Shift+I"
      @click="editor.openImport()"
    >
      <IconDownload class="size-4" />
    </UiIconButton>
    <UiIconButton
      :label="t('export.title')"
      shortcut="Ctrl+E"
      :disabled="doc.isFresh"
      @click="editor.openExport(editor.selected.size ? 'selection' : 'all')"
    >
      <IconUpload class="size-4" />
    </UiIconButton>
    <UiIconButton
      :label="t('inspector.toggle')"
      shortcut="Ctrl+\\"
      :active="editor.inspectorOpen"
      @click="editor.toggleInspector()"
    >
      <IconInspector class="size-4 rtl:-scale-x-100" />
    </UiIconButton>
    <UiSegmented
      v-model="lang"
      :label="t('app.language')"
      :options="[
        { value: 'fa', label: 'فا' },
        { value: 'en', label: 'EN' },
      ]"
    />
  </header>
</template>
