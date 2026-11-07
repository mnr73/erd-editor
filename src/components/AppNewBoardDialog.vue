<script setup>
import { nextTick, useTemplateRef, watch } from "vue";

import { useI18n } from "vue-i18n";

import NewBoardChoices from "@/components/NewBoardChoices.vue";

import { IconClose } from "@/icons";
import { useEditorStore } from "@/stores/editor";

/** What the "new board" button and Ctrl+N open: the same three choices as the start page. */
const { t } = useI18n();
const editor = useEditorStore();
const box = useTemplateRef("box");

watch(
  () => editor.newOpen,
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
      v-if="editor.newOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @pointerdown.self="editor.closeNew()"
      @keydown.esc.stop="editor.closeNew()"
    >
      <div
        ref="box"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        :aria-label="t('start.new')"
        class="w-[min(440px,96vw)] rounded-popover bg-popover shadow-popover outline-none"
        data-new-dialog
      >
        <div class="flex items-center gap-2 border-b border-line px-4 py-3">
          <h2 class="flex-1 text-sm font-semibold text-fg">
            {{ t("start.new") }}
          </h2>
          <button
            type="button"
            class="inline-flex size-6 items-center justify-center rounded-control text-muted hover:bg-hover hover:text-fg"
            :aria-label="t('common.close')"
            @click="editor.closeNew()"
          >
            <IconClose class="size-4" />
          </button>
        </div>
        <div class="p-4">
          <NewBoardChoices @done="editor.closeNew()" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
