<script setup>
import { nextTick, useTemplateRef, watch } from "vue";

import { useI18n } from "vue-i18n";

import UiIconButton from "@/components/ui/UiIconButton.vue";

import { IconClose, IconNewFile } from "@/icons";
import { closeTabWithConfirm, newBoard } from "@/services/files";
import { useDocumentStore } from "@/stores/document";
import { baseName } from "@/utils/path";

/**
 * VS Code style tabs. Middle-click closes, wheel scrolls sideways, the active tab scrolls into view.
 * The start page is a "fresh" tab and has no tab of its own until a board is created in it.
 */
const { t } = useI18n();
const doc = useDocumentStore();
const strip = useTemplateRef("strip");

const label = (tab) =>
  tab.path ? baseName(tab.path) : tab.name || t("title.untitled");

function onWheel(e) {
  if (e.deltaY && !e.deltaX) {
    strip.value.scrollLeft += e.deltaY;
    e.preventDefault();
  }
}

function onKey(e, tab, index) {
  const list = doc.tabList;
  const go = (i) => {
    const target = list[(i + list.length) % list.length];
    doc.activateTab(target.id);
    nextTick(() =>
      strip.value?.querySelector(`[data-tab="${target.id}"]`)?.focus(),
    );
  };
  if (e.key === "ArrowRight") go(index + (document.dir === "rtl" ? -1 : 1));
  else if (e.key === "ArrowLeft") go(index + (document.dir === "rtl" ? 1 : -1));
  else if (e.key === "Home") go(0);
  else if (e.key === "End") go(list.length - 1);
  else return;
  e.preventDefault();
}

watch(
  () => doc.activeId,
  async () => {
    await nextTick();
    strip.value
      ?.querySelector("[aria-selected=true]")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  },
);
</script>

<template>
  <div
    class="flex h-9 shrink-0 items-stretch border-b border-line bg-app"
    dir="ltr"
  >
    <div
      ref="strip"
      role="tablist"
      :aria-label="t('tabs.label')"
      class="flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]"
      @wheel="onWheel"
    >
      <div
        v-for="(tab, i) in doc.tabList"
        :key="tab.id"
        role="tab"
        :data-tab="tab.id"
        :aria-selected="tab.active"
        :tabindex="tab.active ? 0 : -1"
        :title="tab.path ?? undefined"
        class="group/tab relative flex max-w-[220px] min-w-[110px] shrink-0 cursor-pointer items-center gap-2 border-e border-line ps-3 pe-1.5 text-xs transition-colors"
        :class="
          tab.active
            ? 'bg-canvas text-fg'
            : 'text-muted hover:bg-hover hover:text-fg'
        "
        @pointerdown.left="doc.activateTab(tab.id)"
        @auxclick.middle.prevent="closeTabWithConfirm(tab.id)"
        @keydown="onKey($event, tab, i)"
      >
        <span
          v-if="tab.active"
          class="absolute inset-x-0 top-0 h-0.5 bg-accent"
        />
        <span class="min-w-0 flex-1 truncate" data-workspace>
          {{ tab.fresh ? t("title.untitled") : label(tab) }}
        </span>
        <span
          v-if="tab.dirty"
          class="size-[7px] shrink-0 rounded-full bg-warn group-hover/tab:hidden"
          :title="t('tabs.unsaved')"
        />
        <button
          type="button"
          :aria-label="t('tabs.close', { name: label(tab) })"
          class="inline-flex size-5 shrink-0 items-center justify-center rounded-kbd text-muted hover:bg-line hover:text-fg"
          :class="[
            tab.dirty ? 'hidden group-hover/tab:inline-flex' : '',
            tab.active ? '' : 'opacity-0 group-hover/tab:opacity-100',
          ]"
          tabindex="-1"
          @pointerdown.stop
          @click.stop="closeTabWithConfirm(tab.id)"
        >
          <IconClose class="size-3.5" />
        </button>
      </div>
    </div>
    <UiIconButton
      class="my-auto mx-1"
      size="sm"
      :label="t('tabs.new')"
      shortcut="Ctrl+N"
      @click="newBoard"
    >
      <IconNewFile class="size-4" />
    </UiIconButton>
  </div>
</template>
