<script setup>
import { computed } from "vue";

import { useI18n } from "vue-i18n";

import {
  IconChevronDown,
  IconColComment,
  IconColDefault,
  IconColIncrement,
  IconColIndex,
  IconColUnique,
  IconNote,
} from "@/icons";

import { tableHeight, tableWidth } from "./geometry";

/**
 * One table card. Size comes from geometry.js (same numbers the minimap / fit use), position is the
 * document position plus the live drag offset. Columns show only name + type; attribute icons appear
 * only when the attribute has a value (PK / FK use a text key, "?" marks nullable).
 */
const props = defineProps({
  table: { type: Object, required: true },
  selected: Boolean,
  dragging: Boolean,
  dx: { type: Number, default: 0 },
  dy: { type: Number, default: 0 },
  fkKeys: { type: Set, required: true }, // `${tableId}.${columnId}` that are foreign keys
  indexKeys: { type: Set, required: true }, // `${tableId}.${columnId}` that are in some index
});
const emit = defineEmits(["pointerdown", "toggle-collapse"]);

const { t } = useI18n();

const width = computed(() => tableWidth(props.table));
const height = computed(() => tableHeight(props.table));
const accent = computed(() => props.table.color ?? "var(--c-faint)");
const headerBg = computed(() =>
  props.table.color
    ? `color-mix(in srgb, ${props.table.color} var(--mix-header), var(--c-card))`
    : "transparent",
);

const rows = computed(() =>
  props.table.columns.map((c) => {
    const key = `${props.table.id}.${c.id}`;
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      key: c.pk ? "PK" : props.fkKeys.has(key) ? "FK" : "",
      nullable: !c.notNull && !c.pk,
      pk: c.pk,
      unique: c.unique,
      increment: c.increment,
      def: c.default,
      note: c.note,
      indexed: props.indexKeys.has(key),
    };
  }),
);
</script>

<template>
  <div
    class="absolute overflow-hidden rounded-table border bg-card font-mono transition-shadow"
    :class="[
      props.selected
        ? 'border-accent'
        : 'border-line-strong hover:border-faint',
      props.dragging
        ? 'shadow-table-drag'
        : 'shadow-table hover:shadow-table-hover',
    ]"
    :style="{
      left: `${props.table.x}px`,
      top: `${props.table.y}px`,
      width: `${width}px`,
      height: `${height}px`,
      transform:
        props.dx || props.dy
          ? `translate(${props.dx}px, ${props.dy}px)`
          : undefined,
      zIndex: props.dragging ? 20 : props.selected ? 10 : 1,
      boxShadow:
        props.selected && !props.dragging
          ? '0 0 0 2px var(--c-accent)'
          : undefined,
    }"
    :data-table-id="props.table.id"
    @pointerdown="emit('pointerdown', $event)"
  >
    <header
      class="flex h-[var(--size-table-header)] items-center gap-[7px] px-2"
      :class="props.table.collapsed ? '' : 'border-b border-line'"
      :style="{ background: headerBg }"
    >
      <span
        class="size-2 shrink-0 rounded-[2px]"
        :style="{ background: accent }"
      />
      <span class="flex-1 truncate text-xs font-semibold text-fg">{{
        props.table.name
      }}</span>
      <span
        v-if="props.table.collapsed"
        class="shrink-0 font-sans text-[10.5px] text-muted"
      >
        {{ t("canvas.columnsCount", { n: props.table.columns.length }) }}
      </span>
      <IconNote v-if="props.table.note" class="size-3.5 shrink-0 text-muted" />
      <button
        type="button"
        :aria-label="
          props.table.collapsed ? t('canvas.expand') : t('canvas.collapse')
        "
        :aria-expanded="!props.table.collapsed"
        class="inline-flex size-4 shrink-0 items-center justify-center rounded-kbd text-muted hover:bg-hover hover:text-fg"
        @pointerdown.stop
        @click.stop="emit('toggle-collapse')"
      >
        <IconChevronDown
          class="size-3.5 transition-transform"
          :class="props.table.collapsed ? '-rotate-90' : ''"
        />
      </button>
    </header>

    <div v-if="!props.table.collapsed && rows.length" class="py-[3px]">
      <div
        v-for="r in rows"
        :key="r.id"
        class="flex h-[var(--size-row)] items-center gap-[5px] px-2 hover:bg-hover"
      >
        <span
          class="w-[18px] shrink-0 text-[9.5px] font-semibold"
          :class="r.pk ? 'text-key-pk' : 'text-key-fk'"
          >{{ r.key }}</span
        >
        <span
          class="truncate text-[11.5px] text-fg-soft"
          :class="r.pk ? 'font-semibold text-fg' : ''"
          >{{ r.name }}</span
        >
        <span class="flex flex-1 items-center gap-[3px] ps-0.5 text-faint">
          <IconColUnique v-if="r.unique" class="size-3" title="UNIQUE" />
          <IconColIncrement
            v-if="r.increment"
            class="size-3"
            title="AUTO INCREMENT"
          />
          <IconColDefault
            v-if="r.def"
            class="size-3"
            :title="`DEFAULT ${r.def}`"
          />
          <IconColIndex v-if="r.indexed" class="size-3" title="INDEX" />
          <IconColComment v-if="r.note" class="size-3" :title="r.note" />
        </span>
        <span class="shrink-0 text-[10.5px] text-faint"
          >{{ r.type }}<span v-if="r.nullable" class="text-warn">?</span></span
        >
      </div>
    </div>

    <div
      v-else-if="!props.table.collapsed"
      class="flex h-[var(--size-empty-body)] items-center justify-center font-sans text-[11.5px] text-muted"
    >
      {{ t("canvas.noColumns") }}
    </div>
  </div>
</template>
