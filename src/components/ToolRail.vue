<script setup>
import { useI18n } from "vue-i18n";

import UiIconButton from "@/components/ui/UiIconButton.vue";

import { useCanvasCamera } from "@/canvas/useCanvasCamera";
import { useTheme } from "@/composables/useTheme";
import {
  IconFit,
  IconThemeDark,
  IconThemeLight,
  IconToolPan,
  IconToolSelect,
  IconToolTable,
  IconZoomIn,
  IconZoomOut,
} from "@/icons";
import { useEditorStore } from "@/stores/editor";

/** Vertical rail: tools on top, camera + theme at the bottom. More tools are added per stage. */
const { t } = useI18n();
const editor = useEditorStore();
const camera = useCanvasCamera();
const { theme, toggleTheme } = useTheme();
</script>

<template>
  <nav
    :aria-label="t('tools.label')"
    class="flex w-12 shrink-0 flex-col items-center gap-1 border-e border-line bg-panel py-2"
  >
    <UiIconButton
      size="lg"
      :label="t('tools.select')"
      shortcut="V"
      tooltip-side="inline-end"
      :active="editor.tool === 'select'"
      @click="editor.setTool('select')"
    >
      <IconToolSelect class="size-[18px]" />
    </UiIconButton>
    <UiIconButton
      size="lg"
      :label="t('tools.pan')"
      shortcut="H"
      tooltip-side="inline-end"
      :active="editor.tool === 'pan'"
      @click="editor.setTool('pan')"
    >
      <IconToolPan class="size-[18px]" />
    </UiIconButton>

    <UiIconButton
      size="lg"
      :label="t('tools.table')"
      shortcut="T"
      tooltip-side="inline-end"
      :active="editor.tool === 'table'"
      @click="editor.setTool('table')"
    >
      <IconToolTable class="size-[18px]" />
    </UiIconButton>

    <span class="flex-1" />

    <div
      class="flex w-9 flex-col items-center rounded-[9px] border border-line bg-app py-0.5"
    >
      <UiIconButton
        :label="t('canvas.zoomIn')"
        shortcut="Ctrl +"
        tooltip-side="inline-end"
        @click="camera.zoomStep(1)"
      >
        <IconZoomIn class="size-4" />
      </UiIconButton>
      <button
        type="button"
        class="py-0.5 text-[10.5px] text-fg hover:text-accent-text"
        :aria-label="t('canvas.zoomReset')"
        @click="camera.zoomTo(1)"
      >
        {{ Math.round(camera.view.value.zoom * 100) }}%
      </button>
      <UiIconButton
        :label="t('canvas.zoomOut')"
        shortcut="Ctrl −"
        tooltip-side="inline-end"
        @click="camera.zoomStep(-1)"
      >
        <IconZoomOut class="size-4" />
      </UiIconButton>
    </div>
    <UiIconButton
      size="lg"
      :label="t('canvas.fit')"
      shortcut="Shift 1"
      tooltip-side="inline-end"
      @click="camera.fitAll()"
    >
      <IconFit class="size-[18px]" />
    </UiIconButton>
    <UiIconButton
      size="lg"
      :label="t('app.theme')"
      tooltip-side="inline-end"
      @click="toggleTheme"
    >
      <component
        :is="theme === 'dark' ? IconThemeLight : IconThemeDark"
        class="size-[18px]"
      />
    </UiIconButton>
  </nav>
</template>
