<script setup>
import { computed, nextTick, useTemplateRef, watch } from "vue";

import { useI18n } from "vue-i18n";

import { useUiScale } from "@/composables/useUiScale";
import { IconClose } from "@/icons";
import {
  DEFAULT_UI_SCALE,
  MAX_UI_SCALE,
  MIN_UI_SCALE,
  UI_SCALES,
  uiScaleLabel,
} from "@/model/uiscale";
import { useEditorStore } from "@/stores/editor";

/** App settings. Today: the size of the interface text (not the board's text). */
const { t } = useI18n();
const editor = useEditorStore();
const { scale, setScale, bigger, smaller } = useUiScale();
const box = useTemplateRef("box");

const atMin = computed(() => scale.value <= MIN_UI_SCALE);
const atMax = computed(() => scale.value >= MAX_UI_SCALE);

watch(
  () => editor.settingsOpen,
  async (v) => {
    if (!v) return;
    await nextTick();
    box.value?.focus();
  },
);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="editor.settingsOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @pointerdown.self="editor.closeSettings()"
      @keydown.esc.stop="editor.closeSettings()"
    >
      <div
        ref="box"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        :aria-label="t('settings.title')"
        class="w-[min(460px,96vw)] rounded-popover bg-popover shadow-popover outline-none"
        data-settings-dialog
      >
        <div class="flex items-center gap-2 border-b border-line px-4 py-3">
          <h2 class="flex-1 text-sm font-semibold text-fg">
            {{ t("settings.title") }}
          </h2>
          <button
            type="button"
            class="inline-flex size-6 items-center justify-center rounded-control text-muted hover:bg-hover hover:text-fg"
            :aria-label="t('common.close')"
            @click="editor.closeSettings()"
          >
            <IconClose class="size-4" />
          </button>
        </div>

        <div class="flex flex-col gap-4 p-4">
          <section class="flex flex-col gap-2">
            <h3 class="text-xs font-semibold text-fg">
              {{ t("settings.fontSize") }}
            </h3>
            <p class="text-ui-115 leading-[1.8] text-muted">
              {{ t("settings.fontSizeHint") }}
            </p>

            <div class="flex items-center gap-2" dir="ltr">
              <button
                type="button"
                data-font-smaller
                :disabled="atMin"
                :aria-label="t('settings.smaller')"
                class="inline-flex h-8 min-w-8 items-center justify-center rounded-control border border-line-strong px-2 text-fg hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent"
                @click="smaller()"
              >
                <span class="text-[11px] font-semibold">A</span>
              </button>
              <div
                role="group"
                :aria-label="t('settings.fontSize')"
                class="flex flex-1 rounded-control border border-line-strong bg-canvas p-0.5"
              >
                <button
                  v-for="s in UI_SCALES"
                  :key="s"
                  type="button"
                  :data-font-scale="s"
                  :aria-pressed="scale === s"
                  class="h-7 flex-1 rounded-[5px] text-ui-115 transition-colors"
                  :class="
                    scale === s
                      ? 'bg-accent-soft font-semibold text-accent-text'
                      : 'text-muted hover:text-fg'
                  "
                  @click="setScale(s)"
                >
                  {{ uiScaleLabel(s) }}
                </button>
              </div>
              <button
                type="button"
                data-font-bigger
                :disabled="atMax"
                :aria-label="t('settings.bigger')"
                class="inline-flex h-8 min-w-8 items-center justify-center rounded-control border border-line-strong px-2 text-fg hover:bg-hover disabled:opacity-40 disabled:hover:bg-transparent"
                @click="bigger()"
              >
                <span class="text-base font-semibold">A</span>
              </button>
            </div>

            <div
              class="rounded-control border border-line bg-canvas p-3"
              data-font-preview
            >
              <div class="text-sm font-semibold text-fg">
                {{ t("settings.previewTitle") }}
              </div>
              <p class="mt-1 text-xs leading-[1.8] text-fg-soft">
                {{ t("settings.previewText") }}
              </p>
            </div>

            <button
              v-if="scale !== DEFAULT_UI_SCALE"
              type="button"
              data-font-reset
              class="self-start rounded-control px-2 py-1 text-ui-115 text-accent-text hover:bg-hover"
              @click="setScale(DEFAULT_UI_SCALE)"
            >
              {{ t("settings.reset") }}
            </button>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>
