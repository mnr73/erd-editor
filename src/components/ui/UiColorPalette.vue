<script setup>
import { computed, ref } from "vue";

import { useI18n } from "vue-i18n";

import { IconAdd, IconClose } from "@/icons";
import { DEFAULT_PALETTE, normalizeHex } from "@/model/palette";

import UiButton from "./UiButton.vue";
import UiColorSwatch from "./UiColorSwatch.vue";
import UiInput from "./UiInput.vue";

/**
 * Color chooser used for table headers and groups. Pure UI: the parent owns the color
 * (v-model, `null` = no color) and the custom list (`custom` + `add` / `remove` events).
 */
const model = defineModel({ type: [String, null], default: null });
const props = defineProps({
  custom: { type: Array, default: () => [] }, // user colors, #rrggbb
  allowNone: { type: Boolean, default: true },
});
const emit = defineEmits(["add", "remove"]);

const { t } = useI18n();
const adding = ref(false);
const draft = ref("#4c8dff");
const parsed = computed(() => normalizeHex(draft.value));

const same = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();

function confirmAdd() {
  if (!parsed.value) return;
  emit("add", parsed.value);
  model.value = parsed.value;
  adding.value = false;
}
</script>

<template>
  <div class="flex w-[236px] flex-col gap-3 p-3">
    <section class="flex flex-col gap-2">
      <h3 class="text-[11px] font-medium text-muted">
        {{ t("palette.title") }}
      </h3>
      <div class="grid grid-cols-6 justify-items-center gap-2">
        <UiColorSwatch
          v-if="props.allowNone"
          :color="null"
          :label="t('palette.none')"
          :selected="model === null"
          @click="model = null"
        />
        <UiColorSwatch
          v-for="c in DEFAULT_PALETTE"
          :key="c.id"
          :color="c.hex"
          :label="t(`palette.names.${c.id}`)"
          :selected="same(model, c.hex)"
          @click="model = c.hex"
        />
      </div>
    </section>

    <section class="flex flex-col gap-2">
      <h3 class="text-[11px] font-medium text-muted">
        {{ t("palette.mine") }}
      </h3>
      <div class="grid grid-cols-6 justify-items-center gap-2">
        <div v-for="c in props.custom" :key="c" class="group relative">
          <UiColorSwatch
            :color="c"
            :label="c"
            :selected="same(model, c)"
            @click="model = c"
          />
          <button
            type="button"
            :aria-label="t('palette.remove', { color: c })"
            class="absolute -top-1.5 -inset-e-1.5 hidden size-3.5 items-center justify-center rounded-full bg-popover text-muted shadow-popover group-hover:inline-flex hover:text-danger"
            @click="emit('remove', c)"
          >
            <IconClose class="size-2.5" />
          </button>
        </div>
        <button
          type="button"
          :aria-label="t('palette.add')"
          class="inline-flex size-[22px] items-center justify-center rounded-chip border border-dashed border-line-strong text-muted hover:text-fg"
          @click="adding = !adding"
        >
          <IconAdd class="size-3.5" />
        </button>
      </div>

      <div v-if="adding" class="flex items-center gap-2">
        <input
          v-model="draft"
          type="color"
          :aria-label="t('palette.pick')"
          class="size-[30px] shrink-0 cursor-pointer rounded-control border border-line-strong bg-transparent p-0.5"
        />
        <UiInput
          v-model="draft"
          mono
          :invalid="!parsed"
          label="hex"
          placeholder="#4c8dff"
          @keydown.enter="confirmAdd"
        />
        <UiButton variant="primary" :disabled="!parsed" @click="confirmAdd">{{
          t("common.add")
        }}</UiButton>
      </div>
    </section>
  </div>
</template>
