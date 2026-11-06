<script setup>
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";

import { useI18n } from "vue-i18n";

import UiButton from "@/components/ui/UiButton.vue";
import UiSegmented from "@/components/ui/UiSegmented.vue";

import { IconClose, IconCopy, IconUpload } from "@/icons";
import { subsetDocument } from "@/model/export/subset";
import {
  EXPORT_FORMATS,
  SQL_DIALECTS,
  buildText,
  copyText,
  renderPng,
  saveExport,
} from "@/services/exports";
import { useDocumentStore } from "@/stores/document";
import { useEditorStore } from "@/stores/editor";

/**
 * Export dialog: pick a format, see exactly what will be written, then copy or save. SQL has a
 * dialect switch, images a theme (and PNG a scale), the agent file can leave out its guide.
 * What cannot be expressed in the chosen format is listed as notes below the preview.
 */
const { t } = useI18n();
const box = useTemplateRef("box");
const doc = useDocumentStore();
const editor = useEditorStore();

const format = ref("sql");
const dialect = ref("generic");
const theme = ref("dark");
const scale = ref("2");
const guide = ref(true);
const busy = ref(false);
const png = ref(null); // { url, width, height, bytes }
const pngError = ref("");

// What is exported: the whole board, or only the selected tables / sections / notes.
const scope = ref("all");
const subset = computed(() =>
  editor.exportOpen ? subsetDocument(doc.doc, editor.selected) : null,
);
const hasSelection = computed(
  () =>
    (subset.value?.counts.tables ?? 0) +
      (subset.value?.counts.notes ?? 0) +
      (subset.value?.counts.groups ?? 0) >
    0,
);
const source = computed(() =>
  scope.value === "selection" && hasSelection.value
    ? subset.value.doc
    : doc.doc,
);

const fmt = computed(() => EXPORT_FORMATS.find((f) => f.id === format.value));
const built = computed(() => {
  if (!editor.exportOpen || format.value === "png") return null;
  return buildText(source.value, format.value, {
    dialect: dialect.value,
    theme: theme.value,
    guide: guide.value,
  });
});
const text = computed(() => built.value?.text ?? "");
const warnings = computed(() => built.value?.warnings ?? []);
const svgUrl = computed(() =>
  format.value === "svg" && text.value
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text.value)}`
    : "",
);
const lineCount = computed(() =>
  text.value ? text.value.split("\n").length - 1 : 0,
);

watch(
  () => editor.exportOpen,
  async (v) => {
    if (!v) return;
    await nextTick();
    box.value?.focus();
    dialect.value = SQL_DIALECTS.includes(doc.doc.meta.dbType)
      ? doc.doc.meta.dbType
      : "generic";
    format.value = editor.exportScope === "selection" ? "svg" : "sql";
    scope.value =
      editor.exportScope === "selection" && hasSelection.value
        ? "selection"
        : "all";
  },
);

let renderToken = 0;
watch(
  () => [
    editor.exportOpen,
    format.value,
    theme.value,
    scale.value,
    source.value,
  ],
  async () => {
    if (!editor.exportOpen || format.value !== "png") return;
    const token = ++renderToken;
    busy.value = true;
    pngError.value = "";
    try {
      const r = await renderPng(source.value, {
        theme: theme.value,
        scale: Number(scale.value),
      });
      if (token !== renderToken) return;
      if (png.value?.url) URL.revokeObjectURL(png.value.url);
      png.value = {
        ...r,
        url: URL.createObjectURL(new Blob([r.bytes], { type: "image/png" })),
      };
    } catch (e) {
      if (token === renderToken) pngError.value = String(e?.message ?? e);
    } finally {
      if (token === renderToken) busy.value = false;
    }
  },
  { immediate: true },
);

const formats = computed(() =>
  EXPORT_FORMATS.map((f) => ({
    ...f,
    label: t(`export.format.${f.id}`),
    hint: t(`export.hint.${f.id}`),
  })),
);

function warnText(w) {
  return t(`export.warn.${w.code}`, {
    table: w.table ?? "",
    column: w.column ?? "",
    from: w.from ?? "",
    to: w.to ?? "",
  });
}

const canSave = computed(() =>
  format.value === "png" ? !!png.value && !busy.value : !!text.value,
);
async function save() {
  const payload = format.value === "png" ? png.value.bytes : text.value;
  const saved = await saveExport(format.value, payload);
  if (saved) editor.closeExport();
}
async function copy() {
  await copyText(text.value);
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="editor.exportOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @pointerdown.self="editor.closeExport()"
      @keydown.esc.stop="editor.closeExport()"
    >
      <div
        ref="box"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        :aria-label="t('export.title')"
        class="flex outline-none h-[min(640px,92vh)] w-[min(860px,96vw)] flex-col rounded-popover bg-popover shadow-popover"
        data-export-dialog
      >
        <div class="flex items-center gap-2 border-b border-line px-4 py-3">
          <h2 class="flex-1 text-sm font-semibold text-fg">
            {{ t("export.title") }}
          </h2>
          <button
            type="button"
            class="inline-flex size-6 items-center justify-center rounded-control text-muted hover:bg-hover hover:text-fg"
            :aria-label="t('common.close')"
            @click="editor.closeExport()"
          >
            <IconClose class="size-4" />
          </button>
        </div>

        <div class="flex min-h-0 flex-1">
          <nav
            class="flex w-[190px] shrink-0 flex-col gap-1 border-e border-line p-2"
            :aria-label="t('export.formats')"
          >
            <button
              v-for="f in formats"
              :key="f.id"
              type="button"
              :data-format="f.id"
              :aria-pressed="format === f.id"
              class="rounded-control px-2.5 py-2 text-start transition-colors"
              :class="format === f.id ? 'bg-accent-soft' : 'hover:bg-hover'"
              @click="format = f.id"
            >
              <span
                class="block text-xs font-medium"
                :class="format === f.id ? 'text-accent-text' : 'text-fg'"
                >{{ f.label }}</span
              >
              <span class="block text-[10.5px] leading-[1.5] text-muted">{{
                f.hint
              }}</span>
            </button>
          </nav>

          <div class="flex min-w-0 flex-1 flex-col gap-3 p-4">
            <div class="flex flex-wrap items-center gap-3" data-export-options>
              <label
                v-if="hasSelection"
                class="flex items-center gap-2 text-[11.5px] text-muted"
              >
                {{ t("export.scope") }}
                <UiSegmented
                  v-model="scope"
                  :label="t('export.scope')"
                  data-scope
                  :options="[
                    { value: 'all', label: t('export.scopeAll') },
                    {
                      value: 'selection',
                      label: t('export.scopeSelection', {
                        n:
                          subset.counts.tables +
                          subset.counts.notes +
                          subset.counts.groups,
                      }),
                    },
                  ]"
                />
              </label>
              <span
                v-if="scope === 'selection' && subset?.cut"
                class="text-[11px] text-warn"
                data-cut
              >
                {{ t("export.cut", { n: subset.cut }) }}
              </span>
              <label
                v-if="format === 'sql'"
                class="flex items-center gap-2 text-[11.5px] text-muted"
              >
                {{ t("export.dialect") }}
                <UiSegmented
                  v-model="dialect"
                  :label="t('export.dialect')"
                  :options="[
                    { value: 'generic', label: 'ANSI' },
                    { value: 'mysql', label: 'MySQL' },
                    { value: 'postgres', label: 'Postgres' },
                    { value: 'sqlite', label: 'SQLite' },
                    { value: 'mssql', label: 'SQL Server' },
                  ]"
                />
              </label>
              <label
                v-if="format === 'svg' || format === 'png'"
                class="flex items-center gap-2 text-[11.5px] text-muted"
              >
                {{ t("export.theme") }}
                <UiSegmented
                  v-model="theme"
                  :label="t('export.theme')"
                  :options="[
                    { value: 'dark', label: t('export.dark') },
                    { value: 'light', label: t('export.light') },
                  ]"
                />
              </label>
              <label
                v-if="format === 'png'"
                class="flex items-center gap-2 text-[11.5px] text-muted"
              >
                {{ t("export.scale") }}
                <UiSegmented
                  v-model="scale"
                  :label="t('export.scale')"
                  :options="[
                    { value: '1', label: '1×' },
                    { value: '2', label: '2×' },
                    { value: '3', label: '3×' },
                  ]"
                />
              </label>
              <label
                v-if="format === 'agent'"
                class="flex items-center gap-2 text-[11.5px] text-fg-soft"
              >
                <input
                  v-model="guide"
                  type="checkbox"
                  class="size-3.5 accent-[var(--c-accent)]"
                  data-guide
                />
                {{ t("export.guide") }}
              </label>
              <span
                v-if="text"
                class="ms-auto text-[11px] text-muted"
                data-workspace
              >
                {{ t("export.lines", { n: lineCount }) }}
              </span>
              <span
                v-else-if="png"
                class="ms-auto text-[11px] text-muted"
                data-workspace
              >
                {{ png.width }} × {{ png.height }} px
              </span>
            </div>

            <div
              class="min-h-0 flex-1 overflow-auto rounded-control border border-line bg-canvas"
              data-export-preview
            >
              <img
                v-if="format === 'svg' && svgUrl"
                :src="svgUrl"
                alt=""
                class="mx-auto block max-h-full max-w-full object-contain p-2"
              />
              <template v-else-if="format === 'png'">
                <p v-if="pngError" class="p-3 text-xs text-danger">
                  {{ pngError }}
                </p>
                <p v-else-if="busy && !png" class="p-3 text-xs text-muted">
                  {{ t("export.rendering") }}
                </p>
                <img
                  v-else-if="png"
                  :src="png.url"
                  alt=""
                  class="mx-auto block max-h-full max-w-full object-contain p-2"
                  :class="busy ? 'opacity-50' : ''"
                />
              </template>
              <pre
                v-else
                dir="ltr"
                class="m-0 min-h-full p-3 font-mono text-[11.5px] leading-[1.6] whitespace-pre text-fg-soft"
                data-workspace
                data-export-text
                >{{ text }}</pre>
            </div>

            <ul
              v-if="warnings.length"
              class="max-h-[84px] shrink-0 space-y-0.5 overflow-y-auto text-[11.5px] text-warn"
              data-export-warnings
            >
              <li v-for="(w, i) in warnings" :key="i">• {{ warnText(w) }}</li>
            </ul>
          </div>
        </div>

        <div
          class="flex items-center justify-end gap-2 border-t border-line px-4 py-3"
        >
          <UiButton variant="ghost" @click="editor.closeExport()">{{
            t("common.close")
          }}</UiButton>
          <UiButton
            v-if="format !== 'png' && format !== 'svg'"
            :disabled="!text"
            data-copy
            @click="copy"
          >
            <template #icon><IconCopy class="size-3.5" /></template>
            {{ t("export.copy") }}
          </UiButton>
          <UiButton
            variant="primary"
            :disabled="!canSave"
            data-save
            @click="save"
          >
            <template #icon><IconUpload class="size-3.5" /></template>
            {{ t("export.save", { ext: fmt.ext.toUpperCase() }) }}
          </UiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
