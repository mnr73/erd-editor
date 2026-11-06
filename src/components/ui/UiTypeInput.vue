<script setup>
import { computed, ref, watch } from "vue";

import { useI18n } from "vue-i18n";

import UiCombobox from "@/components/ui/UiCombobox.vue";

import {
  changeBase,
  formatType,
  parseEnumValues,
  parseType,
  setParam,
  supportsArray,
  supportsUnsigned,
  typeDef,
  typeGroups,
  typeSuggestions,
} from "@/model/types";

/**
 * Column type picker. The value is the plain type text ("decimal(12,2)"). When the text is a known
 * type it is shown as a type select + one field per parameter (precision, scale, length, ...) +
 * modifier toggles; anything else (a custom or unusual type) stays an editable text field, and a
 * "Custom" entry in the select switches to it. Nothing is ever rewritten unless the user changes it.
 */
const model = defineModel({ type: String, default: "" });
const props = defineProps({
  dbType: { type: String, default: "generic" },
  label: String,
  columnKey: { type: String, default: "" }, // identity of the edited column, resets "Custom" mode
});

const { t } = useI18n();

const forceFree = ref(false); // user picked "Custom"
const parsed = computed(() => parseType(model.value));
const structured = computed(() => !forceFree.value && !!parsed.value);
const def = computed(() => (parsed.value ? typeDef(parsed.value.base) : null));
const groups = computed(() => typeGroups(props.dbType, parsed.value?.base));

// "Custom" lasts for this column only: another column (a new `columnKey`) starts in the picker again
watch(
  () => props.columnKey,
  () => (forceFree.value = false),
);

const FREE = "__free__";
function onBase(e) {
  const v = e.target.value;
  if (v === FREE) {
    forceFree.value = true;
    return;
  }
  const base = parsed.value ?? {
    base: v,
    params: [],
    unsigned: false,
    array: false,
  };
  model.value = formatType(changeBase(base, v, props.dbType));
}
function onParam(i, e) {
  const next = setParam(parsed.value, i, e.target.value);
  model.value = formatType(next);
  // show the clamped value, not what was typed
  e.target.value = next.params[i] ?? "";
}
function toggle(key) {
  model.value = formatType({ ...parsed.value, [key]: !parsed.value[key] });
}
const enumText = computed(() => (parsed.value?.params ?? []).join(", "));
function onEnum(e) {
  model.value = formatType({
    ...parsed.value,
    params: parseEnumValues(e.target.value),
  });
}

const paramLabel = (spec) => t(`type.param.${spec.key}`);
const showUnsigned = computed(() => supportsUnsigned(def.value, props.dbType));
const showArray = computed(
  () => def.value && supportsArray(props.dbType) && !def.value.list,
);
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5" data-type-input dir="ltr">
    <!-- free text: custom types, or the user chose "Custom" -->
    <div v-if="!structured" class="flex min-w-0 items-center gap-1">
      <UiCombobox
        v-model="model"
        mono
        class="flex-1"
        :label="props.label"
        :suggest="(q) => typeSuggestions(q, props.dbType)"
        data-type-free
      />
      <button
        v-if="parseType(model) || !model"
        type="button"
        class="h-7 shrink-0 rounded-control border border-line-strong px-2 text-[11px] text-muted hover:text-fg"
        data-use-picker
        @click="forceFree = false"
      >
        {{ t("type.picker") }}
      </button>
    </div>

    <template v-else>
      <select
        :value="parsed.base"
        :aria-label="props.label"
        class="h-7 w-full rounded-control border border-line-strong bg-canvas px-2 font-mono text-[11.5px] text-fg"
        data-type-base
        @change="onBase"
      >
        <optgroup
          v-for="g in groups"
          :key="g.group"
          :label="t(`type.group.${g.group}`)"
        >
          <option v-for="d in g.types" :key="d.id" :value="d.id">
            {{ d.id }}
          </option>
        </optgroup>
        <option :value="FREE">{{ t("type.custom") }}…</option>
      </select>

      <div v-if="def.params?.length" class="mt-0.5 flex gap-1.5">
        <label
          v-for="(spec, i) in def.params"
          :key="spec.key"
          class="flex min-w-0 flex-1 flex-col gap-0.5"
        >
          <span class="font-sans text-[10.5px] text-fg-soft">{{
            paramLabel(spec)
          }}</span>
          <input
            :value="parsed.params[i] ?? ''"
            :placeholder="spec.optional ? t('type.none') : String(spec.def)"
            :min="spec.min"
            :max="spec.max"
            type="text"
            inputmode="numeric"
            :aria-label="paramLabel(spec)"
            :data-param="spec.key"
            spellcheck="false"
            class="h-7 w-full min-w-0 rounded-control border border-line-strong bg-canvas px-2 font-mono text-[11.5px] text-fg focus-visible:border-accent"
            @change="onParam(i, $event)"
            @keydown.enter.prevent="onParam(i, $event)"
          />
        </label>
      </div>

      <label v-if="def.list" class="flex flex-col gap-0.5">
        <span class="font-sans text-[10.5px] text-fg-soft">{{
          t("type.values")
        }}</span>
        <input
          :value="enumText"
          :aria-label="t('type.values')"
          :placeholder="t('type.valuesHint')"
          spellcheck="false"
          data-param="values"
          class="h-7 w-full min-w-0 rounded-control border border-line-strong bg-canvas px-2 font-mono text-[11.5px] text-fg focus-visible:border-accent"
          @change="onEnum"
        />
      </label>

      <div v-if="showUnsigned || showArray" class="flex gap-1">
        <button
          v-if="showUnsigned"
          type="button"
          :aria-pressed="parsed.unsigned"
          data-mod="unsigned"
          class="h-6 rounded-chip border px-2 font-mono text-[10.5px]"
          :class="
            parsed.unsigned
              ? 'border-accent bg-accent-soft text-accent-text'
              : 'border-line-strong text-muted hover:text-fg'
          "
          @click="toggle('unsigned')"
        >
          UNSIGNED
        </button>
        <button
          v-if="showArray"
          type="button"
          :aria-pressed="parsed.array"
          data-mod="array"
          class="h-6 rounded-chip border px-2 font-mono text-[10.5px]"
          :class="
            parsed.array
              ? 'border-accent bg-accent-soft text-accent-text'
              : 'border-line-strong text-muted hover:text-fg'
          "
          @click="toggle('array')"
        >
          ARRAY []
        </button>
      </div>
    </template>
  </div>
</template>
