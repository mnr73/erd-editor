<script setup>
import { computed } from "vue";

/**
 * All relationship lines in one SVG (world coordinates, under the tables). Crow's Foot ends, optional
 * label chips, hover / selection highlight. Only the thin hit-path of each line takes the pointer,
 * so the canvas underneath stays clickable.
 *
 * Geometry comes from model/relations.js; this component only draws it. While a table is being
 * dragged the parent passes the live-moved geometry in `layout`.
 */
const props = defineProps({
  refs: { type: Array, required: true },
  layout: { type: Map, required: true }, // refId → { d, a, b, lx, ly }
  focus: { type: Set, required: true }, // ref ids drawn highlighted; empty = no focus
  selectedId: { type: String, default: null },
  hoverId: { type: String, default: null },
});
const emit = defineEmits(["pick", "hover", "menu"]);

const hasFocus = computed(() => props.focus.size > 0);

const items = computed(() =>
  props.refs
    .filter((r) => props.layout.has(r.id))
    .map((r) => {
      const g = props.layout.get(r.id);
      const on = props.focus.has(r.id);
      return {
        id: r.id,
        label: r.label,
        g,
        on,
        selected: props.selectedId === r.id,
        dim: hasFocus.value && !on,
      };
    }),
);
</script>

<template>
  <svg
    class="pointer-events-none absolute top-0 left-0 overflow-visible"
    width="1"
    height="1"
    aria-hidden="true"
  >
    <g
      v-for="it in items"
      :key="it.id"
      :data-ref-id="it.id"
      :style="{ opacity: it.dim ? 0.22 : 1 }"
    >
      <!-- fat invisible path = easy to hit -->
      <path
        :d="it.g.d"
        fill="none"
        stroke="transparent"
        stroke-width="12"
        class="pointer-events-stroke cursor-pointer"
        @pointerdown.stop="emit('pick', it.id, $event)"
        @dblclick.stop
        @pointerenter="emit('hover', it.id)"
        @pointerleave="emit('hover', null)"
        @contextmenu.stop.prevent="emit('menu', it.id, $event)"
      />
      <g
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
        :stroke="it.on || it.selected ? 'var(--c-line-hi)' : 'var(--c-rel)'"
        :stroke-width="it.on || it.selected ? 1.7 : 1.3"
      >
        <path :d="it.g.d" />
        <path :d="it.g.a.m" />
        <path :d="it.g.b.m" />
        <path v-if="it.g.a.c" :d="it.g.a.c" fill="var(--c-canvas)" />
        <path v-if="it.g.b.c" :d="it.g.b.c" fill="var(--c-canvas)" />
      </g>
    </g>

    <g v-for="it in items.filter((x) => x.label)" :key="`l-${it.id}`">
      <foreignObject
        :x="it.g.lx - 60"
        :y="it.g.ly - 10"
        width="120"
        height="20"
        class="overflow-visible"
        :style="{ opacity: it.dim ? 0.3 : 1 }"
      >
        <div class="flex h-5 items-center justify-center" data-workspace>
          <span
            class="pointer-events-none max-w-full truncate rounded-chip border px-1.5 text-[10.5px] leading-[18px]"
            :class="
              it.on || it.selected
                ? 'border-accent bg-accent text-accent-fg'
                : 'border-line-strong bg-card text-muted'
            "
          >
            {{ it.label }}
          </span>
        </div>
      </foreignObject>
    </g>
  </svg>
</template>

<style scoped>
.pointer-events-stroke {
  pointer-events: stroke;
}
</style>
