<script setup>
import { computed, nextTick, useTemplateRef, watch } from "vue";

import { useI18n } from "vue-i18n";

import UiKbd from "@/components/ui/UiKbd.vue";

import { FEATURE_GROUPS, TIPS } from "@/help/features";
import { SHORTCUT_GROUPS } from "@/help/shortcuts";
import {
  IconChevronDown,
  IconClose,
  IconColComment,
  IconColDefault,
  IconColIncrement,
  IconColIndex,
  IconColUnique,
  IconDragHandle,
  IconInsertColumn,
  IconMore,
  IconNote,
  IconToolNote,
  IconToolRelation,
  IconToolSection,
  IconToolTable,
} from "@/icons";
import { markerPath } from "@/model/relations";
import { useEditorStore } from "@/stores/editor";

/**
 * Help dialog with three tabs:
 *  - Icons: every symbol the board draws (column icons, keys, relationship ends, controls),
 *    rendered with the same icons and the same `markerPath` the canvas uses;
 *  - About: what the app is and what it can do;
 *  - Shortcuts: every key and mouse gesture, from src/help/shortcuts.js.
 */
const { t } = useI18n();
const editor = useEditorStore();
const box = useTemplateRef("box");

const TABS = ["icons", "about", "shortcuts"];

/**
 * Tips mention keys inline as [[Alt+↑]]. In a right-to-left sentence a Latin run next to arrows or
 * "/" can come out in the wrong order, so each key combination is cut out and drawn as its own
 * left-to-right chip.
 */
function parts(text) {
  return String(text)
    .split(/(\[\[[^\]]+\]\])/)
    .filter(Boolean)
    .map((x) => (x.startsWith("[[") ? { key: x.slice(2, -2) } : { text: x }));
}

watch(
  () => editor.helpOpen,
  async (v) => {
    if (!v) return;
    await nextTick();
    box.value?.focus();
  },
);

function onKey(e) {
  if (e.key === "Escape") {
    e.stopPropagation();
    editor.closeHelp();
  } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    if (!e.target.closest?.("[role=tablist]")) return;
    const dir =
      (e.key === "ArrowRight" ? 1 : -1) * (document.dir === "rtl" ? -1 : 1);
    const i = TABS.indexOf(editor.helpTab);
    editor.helpTab = TABS[(i + dir + TABS.length) % TABS.length];
    nextTick(() =>
      box.value?.querySelector("[role=tab][aria-selected=true]")?.focus(),
    );
  }
}

/* ------------------------------- icons tab -------------------------------- */

const COLUMN_ICONS = [
  { id: "key", cap: "PK", cls: "text-key-pk" },
  { id: "fk", cap: "FK", cls: "text-key-fk" },
  { id: "unique", icon: IconColUnique },
  { id: "increment", icon: IconColIncrement },
  { id: "default", icon: IconColDefault },
  { id: "index", icon: IconColIndex },
  { id: "comment", icon: IconColComment },
  { id: "nullable", cap: "type?", cls: "text-warn" },
];
const CONTROLS = [
  { id: "dragHandle", icon: IconDragHandle },
  { id: "more", icon: IconMore },
  { id: "insert", icon: IconInsertColumn },
  { id: "collapse", icon: IconChevronDown },
  { id: "tableNote", icon: IconNote },
];
const TOOLS = [
  { id: "table", icon: IconToolTable, key: "T" },
  { id: "section", icon: IconToolSection, key: "S" },
  { id: "note", icon: IconToolNote, key: "N" },
  { id: "relation", icon: IconToolRelation, key: "R" },
];
const ENDS = [
  { card: "1", key: "one" },
  { card: "0..1", key: "zeroOne" },
  { card: "1..*", key: "oneMany" },
  { card: "0..*", key: "zeroMany" },
];
const ends = computed(() =>
  ENDS.map((it) => ({
    ...it,
    marker: markerPath({ x: 6, y: 10, o: 1 }, it.card),
  })),
);
const KINDS = [
  { id: "1:1", from: "1", to: "1" },
  { id: "1:N", from: "1", to: "1..*" },
  { id: "N:1", from: "1..*", to: "1" },
  { id: "N:M", from: "1..*", to: "1..*" },
];
/** A short sample line with both ends: left end = `from`, right end = `to` (drawn mirrored). */
const kinds = computed(() =>
  KINDS.map((k) => ({
    ...k,
    a: markerPath({ x: 8, y: 10, o: 1 }, k.from),
    b: markerPath({ x: 112, y: 10, o: -1 }, k.to),
  })),
);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="editor.helpOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @pointerdown.self="editor.closeHelp()"
      @keydown="onKey"
    >
      <div
        ref="box"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        :aria-label="t('help.title')"
        class="flex h-[min(720px,94vh)] w-[min(980px,96vw)] flex-col rounded-popover bg-popover shadow-popover outline-none"
        data-help-dialog
      >
        <div class="flex items-center gap-3 border-b border-line px-4 pt-3">
          <h2 class="pb-2 text-sm font-semibold text-fg">
            {{ t("help.title") }}
          </h2>
          <div
            role="tablist"
            :aria-label="t('help.title')"
            class="flex flex-1 gap-1 ps-3"
          >
            <button
              v-for="id in TABS"
              :id="`help-tab-${id}`"
              :key="id"
              type="button"
              role="tab"
              :aria-selected="editor.helpTab === id"
              :aria-controls="`help-panel-${id}`"
              :tabindex="editor.helpTab === id ? 0 : -1"
              :data-help-tab="id"
              class="-mb-px border-b-2 px-3 pb-2 text-xs transition-colors"
              :class="
                editor.helpTab === id
                  ? 'border-accent font-semibold text-accent-text'
                  : 'border-transparent text-muted hover:text-fg'
              "
              @click="editor.helpTab = id"
            >
              {{ t(`help.tab.${id}`) }}
            </button>
          </div>
          <button
            type="button"
            class="mb-2 inline-flex size-6 items-center justify-center rounded-control text-muted hover:bg-hover hover:text-fg"
            :aria-label="t('common.close')"
            @click="editor.closeHelp()"
          >
            <IconClose class="size-4" />
          </button>
        </div>

        <div
          :id="`help-panel-${editor.helpTab}`"
          class="min-h-0 flex-1 overflow-y-auto p-5"
          role="tabpanel"
          :aria-labelledby="`help-tab-${editor.helpTab}`"
          data-help-panel
        >
          <!-- ICONS -->
          <div
            v-if="editor.helpTab === 'icons'"
            class="grid gap-6 md:grid-cols-2"
            data-help-section="icons"
          >
            <section class="md:col-span-2">
              <h3 class="mb-1 text-xs font-semibold text-fg">
                {{ t("help.icons.relations") }}
              </h3>
              <p class="mb-3 text-[11.5px] leading-[1.7] text-muted">
                {{ t("help.icons.relationsIntro") }}
              </p>
              <ul class="grid gap-2 sm:grid-cols-2">
                <li
                  v-for="r in ends"
                  :key="r.card"
                  class="flex items-center gap-3 rounded-control border border-line bg-canvas px-3 py-2"
                >
                  <svg
                    width="64"
                    height="20"
                    viewBox="0 0 64 20"
                    fill="none"
                    stroke="var(--c-line-hi)"
                    stroke-width="1.4"
                    stroke-linecap="round"
                    aria-hidden="true"
                    class="shrink-0"
                  >
                    <path d="M6 10H64" />
                    <path :d="r.marker.m" />
                    <path
                      v-if="r.marker.c"
                      :d="r.marker.c"
                      fill="var(--c-canvas)"
                    />
                  </svg>
                  <span class="flex-1 text-[11.5px] text-fg-soft">{{
                    t(`help.icons.end.${r.key}`)
                  }}</span>
                  <UiKbd>{{ r.card }}</UiKbd>
                </li>
              </ul>
              <h4 class="mt-4 mb-2 text-[11.5px] font-semibold text-fg">
                {{ t("help.icons.kinds") }}
              </h4>
              <ul class="grid gap-2 sm:grid-cols-2" data-help-kinds>
                <li
                  v-for="k in kinds"
                  :key="k.id"
                  class="flex items-center gap-3 rounded-control border border-line bg-canvas px-3 py-2"
                >
                  <svg
                    width="120"
                    height="20"
                    viewBox="0 0 120 20"
                    fill="none"
                    stroke="var(--c-line-hi)"
                    stroke-width="1.4"
                    stroke-linecap="round"
                    aria-hidden="true"
                    class="shrink-0"
                  >
                    <path d="M8 10H112" />
                    <path :d="k.a.m" />
                    <path :d="k.b.m" />
                    <path v-if="k.a.c" :d="k.a.c" fill="var(--c-canvas)" />
                    <path v-if="k.b.c" :d="k.b.c" fill="var(--c-canvas)" />
                  </svg>
                  <span class="flex-1 text-[11.5px] text-fg-soft">{{
                    t(`help.icons.kind.${k.id}`)
                  }}</span>
                  <UiKbd>{{ k.id }}</UiKbd>
                </li>
              </ul>
              <p class="mt-3 text-[11.5px] leading-[1.7] text-muted">
                {{ t("help.icons.kindsNote") }}
              </p>
              <p class="mt-2 text-[11.5px] leading-[1.7] text-muted">
                {{ t("help.icons.readHow") }}
              </p>
            </section>

            <section>
              <h3 class="mb-2 text-xs font-semibold text-fg">
                {{ t("help.icons.columns") }}
              </h3>
              <ul class="flex flex-col gap-1.5">
                <li
                  v-for="c in COLUMN_ICONS"
                  :key="c.id"
                  class="flex items-center gap-3"
                >
                  <span
                    class="flex h-6 w-14 shrink-0 items-center justify-center rounded-control border border-line bg-canvas text-fg-soft"
                    dir="ltr"
                    data-workspace
                  >
                    <span
                      v-if="c.cap"
                      class="text-[10px] font-semibold"
                      :class="c.cls"
                      >{{ c.cap }}</span
                    >
                    <component :is="c.icon" v-else class="size-3.5" />
                  </span>
                  <span class="text-[11.5px] leading-[1.6] text-fg-soft">{{
                    t(`help.icons.col.${c.id}`)
                  }}</span>
                </li>
              </ul>
            </section>

            <section>
              <h3 class="mb-2 text-xs font-semibold text-fg">
                {{ t("help.icons.controls") }}
              </h3>
              <ul class="flex flex-col gap-1.5">
                <li
                  v-for="c in CONTROLS"
                  :key="c.id"
                  class="flex items-center gap-3"
                >
                  <span
                    class="flex h-6 w-14 shrink-0 items-center justify-center rounded-control border border-line bg-canvas text-fg-soft"
                  >
                    <component :is="c.icon" class="size-3.5" />
                  </span>
                  <span class="text-[11.5px] leading-[1.6] text-fg-soft">{{
                    t(`help.icons.ctl.${c.id}`)
                  }}</span>
                </li>
                <li class="flex items-center gap-3">
                  <span
                    class="flex h-6 w-14 shrink-0 items-center justify-center rounded-control border border-line bg-canvas"
                  >
                    <span
                      class="size-[10px] rounded-full border-2 border-accent bg-card"
                    />
                  </span>
                  <span class="text-[11.5px] leading-[1.6] text-fg-soft">{{
                    t("help.icons.ctl.linkDot")
                  }}</span>
                </li>
              </ul>
              <h3 class="mt-5 mb-2 text-xs font-semibold text-fg">
                {{ t("help.icons.tools") }}
              </h3>
              <ul class="flex flex-col gap-1.5">
                <li
                  v-for="c in TOOLS"
                  :key="c.id"
                  class="flex items-center gap-3"
                >
                  <span
                    class="flex h-6 w-14 shrink-0 items-center justify-center rounded-control border border-line bg-canvas text-fg-soft"
                  >
                    <component :is="c.icon" class="size-3.5" />
                  </span>
                  <span
                    class="flex-1 text-[11.5px] leading-[1.6] text-fg-soft"
                    >{{ t(`help.icons.tool.${c.id}`) }}</span
                  >
                  <UiKbd>{{ c.key }}</UiKbd>
                </li>
              </ul>
            </section>
          </div>

          <!-- ABOUT -->
          <div
            v-else-if="editor.helpTab === 'about'"
            class="flex flex-col gap-6"
            data-help-section="about"
          >
            <section>
              <h3 class="text-sm font-semibold text-fg">{{ t("app.name") }}</h3>
              <p class="mt-1.5 max-w-[70ch] text-xs leading-[1.9] text-fg-soft">
                {{ t("help.about.intro") }}
              </p>
              <p class="mt-2 max-w-[70ch] text-xs leading-[1.9] text-muted">
                {{ t("help.about.file") }}
              </p>
            </section>
            <section v-for="g in FEATURE_GROUPS" :key="g.id">
              <h3 class="mb-2 text-xs font-semibold text-fg">
                {{ t(`help.about.group.${g.id}`) }}
              </h3>
              <ul class="grid gap-2 sm:grid-cols-2">
                <li
                  v-for="f in g.items"
                  :key="f"
                  class="rounded-control border border-line bg-canvas p-3"
                >
                  <div class="text-[11.5px] font-semibold text-fg">
                    {{ t(`help.f.${f}.title`) }}
                  </div>
                  <p class="mt-1 text-[11.5px] leading-[1.8] text-muted">
                    {{ t(`help.f.${f}.text`) }}
                  </p>
                </li>
              </ul>
            </section>
          </div>

          <!-- SHORTCUTS -->
          <div
            v-else
            class="grid gap-x-8 gap-y-6 md:grid-cols-2"
            data-help-section="shortcuts"
          >
            <section class="md:col-span-2" data-help-tips>
              <h3 class="mb-2 text-xs font-semibold text-fg">
                {{ t("help.tipsTitle") }}
              </h3>
              <ul class="flex max-w-[78ch] flex-col gap-1.5">
                <li
                  v-for="tip in TIPS"
                  :key="tip"
                  class="flex gap-2 text-[11.5px] leading-[1.8] text-fg-soft"
                >
                  <span
                    class="mt-[7px] size-1 shrink-0 rounded-full bg-accent"
                  />
                  <span>
                    <template
                      v-for="(p, i) in parts(t(`help.tip.${tip}`))"
                      :key="i"
                    >
                      <UiKbd
                        v-if="p.key"
                        class="mx-0.5 ring-1 ring-line-strong text-fg-soft"
                        >{{ p.key }}</UiKbd
                      >
                      <template v-else>{{ p.text }}</template>
                    </template>
                  </span>
                </li>
              </ul>
            </section>
            <section
              v-for="g in SHORTCUT_GROUPS"
              :key="g.id"
              :data-shortcut-group="g.id"
            >
              <h3 class="mb-2 text-xs font-semibold text-fg">
                {{ t(`help.group.${g.id}`) }}
              </h3>
              <ul class="flex flex-col">
                <li
                  v-for="it in g.items"
                  :key="`${it.id}${it.inEditor ? '-ed' : ''}`"
                  class="flex items-center gap-3 border-b border-line py-1.5 last:border-0"
                >
                  <span
                    class="min-w-0 flex-1 text-[11.5px] leading-[1.6] text-fg-soft"
                    >{{ t(`help.s.${it.id}`) }}</span
                  >
                  <span
                    class="flex shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1"
                    dir="ltr"
                    data-workspace
                  >
                    <template v-for="(chord, ci) in it.keys" :key="ci">
                      <span v-if="ci" class="text-[10px] text-faint">/</span>
                      <span class="inline-flex items-center gap-0.5">
                        <UiKbd
                          v-for="cap in chord"
                          :key="cap"
                          class="ring-1 ring-line-strong text-fg-soft"
                          >{{ cap }}</UiKbd
                        >
                      </span>
                    </template>
                  </span>
                </li>
              </ul>
            </section>
          </div>
        </div>

        <div
          class="flex items-center gap-2 border-t border-line px-4 py-2 text-[11px] text-muted"
        >
          <span class="flex-1">{{ t("help.footer") }}</span>
          <UiKbd>Esc</UiKbd>
        </div>
      </div>
    </div>
  </Teleport>
</template>
