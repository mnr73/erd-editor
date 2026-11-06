<script setup>
import { computed } from "vue";

/**
 * Section frame behind the tables. The frame itself ignores the pointer (so box-selection and
 * clicks reach what is under it); only the title chip is interactive, like FigJam sections.
 */
const props = defineProps({
  group: { type: Object, required: true },
  memberCount: { type: Number, default: 0 },
  selected: Boolean,
  dragging: Boolean,
  dx: { type: Number, default: 0 },
  dy: { type: Number, default: 0 },
  uiDir: { type: String, default: "ltr" }, // the chip sits at the start edge of the UI language
});
const emit = defineEmits(["pointerdown"]);

const color = computed(() => props.group.color ?? "#8792A6");
const mix = (pct, base = "transparent") =>
  `color-mix(in srgb, ${color.value} ${pct}%, ${base})`;
</script>

<template>
  <div
    class="pointer-events-none absolute"
    :style="{
      left: `${props.group.x}px`,
      top: `${props.group.y}px`,
      width: `${props.group.w}px`,
      height: `${props.group.h}px`,
      transform:
        props.dx || props.dy
          ? `translate(${props.dx}px, ${props.dy}px)`
          : undefined,
      zIndex: 0,
    }"
    :data-group-id="props.group.id"
  >
    <div
      class="absolute inset-0 rounded-[10px]"
      :class="props.selected ? 'border-2 border-accent' : 'border'"
      :style="{
        background: mix(props.selected ? 10 : 6),
        borderColor: props.selected ? undefined : mix(30),
        boxShadow: props.selected
          ? '0 0 0 4px var(--c-accent-soft)'
          : undefined,
      }"
    />
    <div class="absolute inset-x-0 -top-[11px] flex px-4" :dir="props.uiDir">
      <span
        class="pointer-events-auto flex h-[22px] cursor-grab items-center gap-1.5 rounded-chip border px-2.5 text-[11.5px] font-semibold active:cursor-grabbing"
        :style="{
          background: props.selected
            ? 'var(--c-accent)'
            : mix(18, 'var(--c-card)'),
          borderColor: props.selected ? 'var(--c-accent)' : mix(45),
          color: props.selected ? 'var(--c-accent-fg)' : mix(60, 'var(--c-fg)'),
        }"
        @pointerdown="emit('pointerdown', $event)"
      >
        {{ props.group.name }}
        <span class="font-normal opacity-75">{{ props.memberCount }}</span>
      </span>
    </div>
  </div>
</template>
