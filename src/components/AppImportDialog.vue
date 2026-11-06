<script setup>
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";

import { useI18n } from "vue-i18n";

import UiButton from "@/components/ui/UiButton.vue";
import UiSegmented from "@/components/ui/UiSegmented.vue";

import { IconClose, IconDownload } from "@/icons";
import {
  detectDialect,
  importSql,
  openImported,
  pickSqlFile,
} from "@/services/imports";
import { useEditorStore } from "@/stores/editor";
import { isTauri } from "@/tauri";

/**
 * Import dialog: paste SQL (CREATE TABLE / ALTER TABLE / CREATE INDEX …) or pick a .sql file, see
 * what was understood, then open it as a new unsaved board. The current board is never touched.
 */
const { t } = useI18n();
const box = useTemplateRef("box");
const editor = useEditorStore();

const text = ref("");
const name = ref("");
const dialect = ref("generic");
const auto = ref(true); // follow the detected dialect until the user picks one

const result = computed(() => {
  if (!editor.importOpen || !text.value.trim()) return null;
  return importSql(text.value, { dbType: dialect.value, name: name.value });
});
const detected = computed(() =>
  text.value.trim() ? detectDialect(text.value) : "generic",
);
watch(detected, (d) => {
  if (auto.value) dialect.value = d;
});
function pickDialect(v) {
  auto.value = false;
  dialect.value = v;
}

watch(
  () => editor.importOpen,
  async (v) => {
    if (!v) return;
    await nextTick();
    box.value?.focus();
    text.value = "";
    name.value = "";
    dialect.value = "generic";
    auto.value = true;
  },
);

const canOpen = computed(() => !!result.value?.doc.tables.length);
const tables = computed(() =>
  (result.value?.doc.tables ?? []).map((tb) => ({
    id: tb.id,
    name: tb.schema ? `${tb.schema}.${tb.name}` : tb.name,
    columns: tb.columns.length,
  })),
);

function warnText(w) {
  return t(`import.warn.${w.code}`, {
    table: w.table ?? "",
    column: w.column ?? "",
    from: w.from ?? "",
    to: w.to ?? "",
    index: w.index ?? "",
    type: w.type ?? "",
    message: w.message ?? "",
  });
}

async function choose() {
  const f = await pickSqlFile();
  if (!f) return;
  text.value = f.text;
  if (f.name) name.value = f.name;
}

function open() {
  if (!canOpen.value) return;
  openImported(result.value.doc);
  editor.closeImport();
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="editor.importOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @pointerdown.self="editor.closeImport()"
      @keydown.esc.stop="editor.closeImport()"
    >
      <div
        ref="box"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        :aria-label="t('import.title')"
        class="flex outline-none h-[min(640px,92vh)] w-[min(820px,96vw)] flex-col rounded-popover bg-popover shadow-popover"
        data-import-dialog
      >
        <div class="flex items-center gap-2 border-b border-line px-4 py-3">
          <h2 class="flex-1 text-sm font-semibold text-fg">
            {{ t("import.title") }}
          </h2>
          <button
            type="button"
            class="inline-flex size-6 items-center justify-center rounded-control text-muted hover:bg-hover hover:text-fg"
            :aria-label="t('common.close')"
            @click="editor.closeImport()"
          >
            <IconClose class="size-4" />
          </button>
        </div>

        <div class="flex min-h-0 flex-1 flex-col gap-3 p-4">
          <p class="text-xs leading-[1.7] text-muted">{{ t("import.hint") }}</p>
          <div class="flex flex-wrap items-center gap-3">
            <UiButton v-if="isTauri()" data-pick-file @click="choose">
              <template #icon><IconDownload class="size-3.5" /></template>
              {{ t("import.chooseFile") }}
            </UiButton>
            <label class="flex items-center gap-2 text-[11.5px] text-muted">
              {{ t("import.dialect") }}
              <UiSegmented
                :model-value="dialect"
                :label="t('import.dialect')"
                :options="[
                  { value: 'generic', label: 'ANSI' },
                  { value: 'mysql', label: 'MySQL' },
                  { value: 'postgres', label: 'Postgres' },
                  { value: 'sqlite', label: 'SQLite' },
                  { value: 'mssql', label: 'SQL Server' },
                ]"
                @update:model-value="pickDialect"
              />
            </label>
            <span v-if="auto && text.trim()" class="text-[11px] text-muted">{{
              t("import.detected")
            }}</span>
          </div>

          <div class="grid min-h-0 flex-1 grid-cols-[1fr_240px] gap-3">
            <textarea
              v-model="text"
              dir="ltr"
              spellcheck="false"
              :placeholder="t('import.placeholder')"
              :aria-label="t('import.sql')"
              class="min-h-0 resize-none rounded-control border border-line-strong bg-canvas p-3 font-mono text-[11.5px] leading-[1.6] text-fg placeholder:text-muted focus-visible:border-accent"
              data-workspace
              data-import-text
            />
            <div
              class="flex min-h-0 flex-col gap-2 rounded-control border border-line bg-canvas p-3"
              data-import-result
            >
              <template v-if="result">
                <div class="text-xs font-medium text-fg">
                  {{
                    t("import.found", {
                      tables: result.stats.tables,
                      refs: result.stats.refs,
                    })
                  }}
                </div>
                <ul
                  class="min-h-0 flex-1 space-y-0.5 overflow-y-auto font-mono text-[11px] text-fg-soft"
                  dir="ltr"
                  data-workspace
                >
                  <li v-for="tb in tables" :key="tb.id" class="flex gap-2">
                    <span class="min-w-0 flex-1 truncate">{{ tb.name }}</span>
                    <span class="text-muted">{{ tb.columns }}</span>
                  </li>
                  <li v-if="!tables.length" class="font-sans text-muted">
                    {{ t("import.noTables") }}
                  </li>
                </ul>
                <div v-if="result.stats.skipped" class="text-[11px] text-muted">
                  {{ t("import.skipped", { n: result.stats.skipped }) }}
                </div>
                <ul
                  v-if="result.warnings.length"
                  class="max-h-[110px] space-y-0.5 overflow-y-auto text-[11px] text-warn"
                  data-import-warnings
                >
                  <li v-for="(w, i) in result.warnings" :key="i">
                    • {{ warnText(w) }}
                  </li>
                </ul>
              </template>
              <p v-else class="text-[11.5px] leading-[1.7] text-muted">
                {{ t("import.waiting") }}
              </p>
            </div>
          </div>
        </div>

        <div
          class="flex items-center justify-end gap-2 border-t border-line px-4 py-3"
        >
          <UiButton variant="ghost" @click="editor.closeImport()">{{
            t("common.cancel")
          }}</UiButton>
          <UiButton
            variant="primary"
            :disabled="!canOpen"
            data-open-imported
            @click="open"
          >
            {{ t("import.open") }}
          </UiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
