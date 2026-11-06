<script setup>
import { ref, useTemplateRef } from "vue";

import { useI18n } from "vue-i18n";

import UiButton from "@/components/ui/UiButton.vue";
import UiColorPalette from "@/components/ui/UiColorPalette.vue";
import UiContextMenu from "@/components/ui/UiContextMenu.vue";
import UiIconButton from "@/components/ui/UiIconButton.vue";
import UiInput from "@/components/ui/UiInput.vue";
import UiKbd from "@/components/ui/UiKbd.vue";
import UiMenu from "@/components/ui/UiMenu.vue";
import UiPopover from "@/components/ui/UiPopover.vue";
import UiSwitch from "@/components/ui/UiSwitch.vue";

import { useToast } from "@/composables/useToast";
import {
  IconAdd,
  IconColComment,
  IconColIncrement,
  IconColPrimaryKey,
  IconColUnique,
  IconDelete,
  IconExport,
  IconMore,
  IconOpenFile,
  IconRedo,
  IconSave,
  IconToolSelect,
  IconToolTable,
  IconUndo,
} from "@/icons";

/** Dev-only gallery of the base components (stage 3). Replaced by the real editor in stage 4+. */
const { t } = useI18n();
const { push } = useToast();

const sw = ref(true);
const text = ref("numeric(12,2)");
const color = ref("#8b7cf6");
const custom = ref(["#14b8a6"]);

const palOpen = ref(false);
const palBtn = useTemplateRef("palBtn");
const popOpen = ref(false);
const popBtn = useTemplateRef("popBtn");
const menuOpen = ref(false);
const menuBtn = useTemplateRef("menuBtn");
const ctx = useTemplateRef("ctx");

const items = [
  {
    id: "open",
    label: t("dev.fileMenu.open"),
    icon: IconOpenFile,
    shortcut: "Ctrl O",
  },
  {
    id: "save",
    label: t("dev.fileMenu.save"),
    icon: IconSave,
    shortcut: "Ctrl S",
  },
  {
    id: "export",
    label: t("dev.fileMenu.export"),
    icon: IconExport,
    disabled: true,
  },
  { separator: true },
  {
    id: "delete",
    label: t("dev.fileMenu.delete"),
    icon: IconDelete,
    danger: true,
  },
];
function onSelect(item) {
  menuOpen.value = false;
  push({ text: `${item.label}`, kind: "info" });
}
</script>

<template>
  <div class="h-full overflow-auto bg-app p-8">
    <div class="mx-auto flex max-w-3xl flex-col gap-8">
      <h1 class="text-lg font-semibold">{{ t("dev.title") }}</h1>

      <section class="flex flex-col gap-3">
        <h2 class="text-sm font-semibold">{{ t("dev.buttons") }}</h2>
        <div class="flex flex-wrap items-center gap-2">
          <UiButton variant="primary"
            ><template #icon><IconAdd class="size-3.5" /></template
            >{{ t("common.add") }}</UiButton
          >
          <UiButton>{{ t("common.duplicate") }}</UiButton>
          <UiButton variant="danger">{{ t("common.delete") }}</UiButton>
          <UiButton variant="ghost">{{ t("common.cancel") }}</UiButton>
          <UiButton disabled>{{ t("common.save") }}</UiButton>
        </div>
        <div class="flex items-center gap-1">
          <UiIconButton :label="t('common.undo')" shortcut="Ctrl Z"
            ><IconUndo class="size-4"
          /></UiIconButton>
          <UiIconButton :label="t('common.redo')" shortcut="Ctrl Shift Z"
            ><IconRedo class="size-4"
          /></UiIconButton>
          <UiIconButton :label="t('dev.tooltip')" size="lg" active shortcut="V"
            ><IconToolSelect class="size-[18px]"
          /></UiIconButton>
          <UiIconButton :label="t('dev.tooltip')" size="lg" shortcut="T"
            ><IconToolTable class="size-[18px]"
          /></UiIconButton>
          <UiKbd>Ctrl K</UiKbd>
        </div>
        <div class="flex items-center gap-3 text-muted">
          <IconColPrimaryKey class="size-3.5 text-key-pk" />
          <IconColUnique class="size-3.5" />
          <IconColIncrement class="size-3.5" />
          <IconColComment class="size-3.5" />
        </div>
      </section>

      <section class="flex flex-col gap-3">
        <h2 class="text-sm font-semibold">{{ t("dev.switches") }}</h2>
        <div class="flex items-center gap-3">
          <UiSwitch v-model="sw" label="switch" />
          <div class="w-56"><UiInput v-model="text" mono label="type" /></div>
        </div>
      </section>

      <section class="flex flex-wrap items-center gap-3">
        <h2 class="w-full text-sm font-semibold">
          {{ t("dev.popover") }} / {{ t("dev.palette") }}
        </h2>
        <UiButton ref="popBtn" @click="popOpen = !popOpen">{{
          t("dev.popover")
        }}</UiButton>
        <UiPopover
          v-model:open="popOpen"
          :anchor="popBtn?.$el"
          side="inline-end"
          align="start"
        >
          <div class="p-4 text-xs">{{ t("dev.sample") }}</div>
        </UiPopover>

        <UiButton ref="palBtn" @click="palOpen = !palOpen">
          <span class="size-3 rounded-sm" :style="{ background: color }" />
          {{ t("dev.colorsOpen") }}
        </UiButton>
        <UiPopover
          v-model:open="palOpen"
          :anchor="palBtn?.$el"
          side="bottom"
          align="start"
        >
          <UiColorPalette
            v-model="color"
            :custom="custom"
            @add="(c) => custom.push(c)"
            @remove="(c) => (custom = custom.filter((x) => x !== c))"
          />
        </UiPopover>
      </section>

      <section class="flex flex-wrap items-center gap-3">
        <h2 class="w-full text-sm font-semibold">{{ t("dev.menu") }}</h2>
        <UiButton ref="menuBtn" @click="menuOpen = !menuOpen">
          <template #icon><IconMore class="size-4" /></template
          >{{ t("dev.menuOpen") }}
        </UiButton>
        <UiPopover
          v-model:open="menuOpen"
          :anchor="menuBtn?.$el"
          side="bottom"
          align="start"
          role="presentation"
        >
          <UiMenu :items="items" @select="onSelect" />
        </UiPopover>

        <div
          class="flex h-24 flex-1 items-center justify-center rounded-popover border border-dashed border-line-strong text-xs text-muted canvas-grid"
          @contextmenu="ctx.show($event, items)"
        >
          {{ t("dev.rightClick") }}
        </div>
        <UiContextMenu ref="ctx" @select="onSelect" />
      </section>

      <section class="flex flex-col gap-3">
        <h2 class="text-sm font-semibold">{{ t("dev.toast") }}</h2>
        <div class="flex gap-2">
          <UiButton @click="push({ text: t('dev.toastInfo') })">info</UiButton>
          <UiButton
            @click="
              push({ text: t('dev.toastError'), kind: 'error', timeout: 0 })
            "
            >error</UiButton
          >
          <UiButton
            @click="
              push({
                text: t('dev.toastUndo'),
                kind: 'success',
                action: {
                  label: t('common.undo'),
                  run: () => push({ text: t('dev.undone') }),
                },
              })
            "
          >
            action
          </UiButton>
        </div>
      </section>
    </div>
  </div>
</template>
