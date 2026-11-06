<script setup>
import { computed } from "vue";

import { useI18n } from "vue-i18n";

import { markerPath } from "@/model/relations";

/**
 * Legend for the Crow's Foot notation: the four line ends drawn with the SAME function the canvas
 * uses, so the explanation can never drift from what is on the board.
 */
const { t } = useI18n();

const ITEMS = [
  { card: "1", key: "one" },
  { card: "0..1", key: "zeroOne" },
  { card: "1..*", key: "oneMany" },
  { card: "0..*", key: "zeroMany" },
];

const rows = computed(() =>
  ITEMS.map((it) => ({
    ...it,
    // the end sits at the left of a 56px sample line
    marker: markerPath({ x: 6, y: 8, o: 1 }, it.card),
    label: t(`legend.${it.key}`),
  })),
);
const examples = ["1:1", "1:N", "N:1", "N:M"];
</script>

<template>
  <section
    data-legend
    class="w-[250px] rounded-popover bg-popover p-3 shadow-popover"
    :aria-label="t('legend.title')"
  >
    <h3 class="font-sans text-xs font-semibold text-fg">
      {{ t("legend.title") }}
    </h3>
    <ul class="mt-2.5 flex flex-col gap-2">
      <li v-for="r in rows" :key="r.card" class="flex items-center gap-2.5">
        <svg
          width="56"
          height="16"
          viewBox="0 0 56 16"
          fill="none"
          stroke="var(--c-line-hi)"
          stroke-width="1.4"
          stroke-linecap="round"
          aria-hidden="true"
          class="shrink-0"
        >
          <path d="M6 8H56" />
          <path :d="r.marker.m" />
          <path v-if="r.marker.c" :d="r.marker.c" fill="var(--c-popover)" />
        </svg>
        <span class="flex-1 text-[11.5px] text-fg-soft">{{ r.label }}</span>
        <kbd
          dir="ltr"
          class="rounded-kbd bg-kbd px-1.5 font-mono text-[10px] text-kbd-fg"
          >{{ r.card }}</kbd
        >
      </li>
    </ul>
    <p class="mt-3 text-[11px] leading-[1.6] text-muted">
      {{ t("legend.read") }}
    </p>
    <p class="mt-1.5 flex flex-wrap items-center gap-1" dir="ltr">
      <kbd
        v-for="e in examples"
        :key="e"
        class="rounded-kbd bg-kbd px-1.5 font-mono text-[10px] text-kbd-fg"
        >{{ e }}</kbd
      >
    </p>
    <p class="mt-2 text-[11px] leading-[1.6] text-muted">
      {{ t("legend.how") }}
    </p>
  </section>
</template>
