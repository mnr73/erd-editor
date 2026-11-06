<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

import { computePosition, pointRect } from "@/utils/position";

/**
 * Floating surface anchored to an element, a DOMRect-like object, or a point `{ x, y }`.
 * Teleported to <body>, flips/clamps inside the viewport, follows document direction (RTL-aware
 * `side="inline-start|inline-end"` and `align`). Closes on Esc / outside pointerdown / scroll-less blur
 * when `dismissable`. Content is a slot, so menus, color pickers and forms all share this.
 */
const open = defineModel("open", { type: Boolean, default: false });
const props = defineProps({
  anchor: { type: [Object, null], default: null }, // Element | { x, y } | rect
  side: { type: String, default: "bottom" },
  align: { type: String, default: "start" },
  offset: { type: Number, default: 6 },
  dismissable: { type: Boolean, default: true },
  trap: { type: Boolean, default: true }, // move focus inside on open, restore on close
  surface: { type: String, default: "popover" }, // popover | tooltip | plain
  popoverId: String,
  role: { type: String, default: "dialog" },
  label: String,
});
const emit = defineEmits(["close"]);

const el = ref(null);
const pos = ref({ x: 0, y: 0, side: props.side });
let returnFocus = null;

const surfaceClass = computed(
  () =>
    ({
      popover: "rounded-popover bg-popover text-fg shadow-popover",
      tooltip:
        "rounded-chip bg-popover px-2 py-1 text-[11.5px] text-fg shadow-popover pointer-events-none",
      plain: "",
    })[props.surface],
);

function anchorRect() {
  const a = props.anchor;
  if (!a) return pointRect(0, 0);
  if (typeof a.getBoundingClientRect === "function")
    return a.getBoundingClientRect();
  if ("x" in a && "y" in a && !("width" in a)) return pointRect(a.x, a.y);
  return a;
}

function place() {
  if (!el.value) return;
  const dir = getComputedStyle(document.documentElement).direction;
  pos.value = computePosition({
    anchor: anchorRect(),
    size: { w: el.value.offsetWidth, h: el.value.offsetHeight },
    side: props.side,
    align: props.align,
    dir,
    offset: props.offset,
    viewport: { width: window.innerWidth, height: window.innerHeight },
  });
}

function close() {
  open.value = false;
  emit("close");
}

function onKey(e) {
  if (e.key === "Escape" && props.dismissable) {
    e.stopPropagation();
    close();
  }
}
function onPointerDown(e) {
  if (!props.dismissable || !el.value) return;
  const a = props.anchor;
  if (el.value.contains(e.target) || (a?.contains && a.contains(e.target)))
    return;
  close();
}

function listen(on) {
  const m = on ? "addEventListener" : "removeEventListener";
  document[m]("keydown", onKey, true);
  document[m]("pointerdown", onPointerDown, true);
  window[m]("resize", place);
  window[m]("scroll", place, true);
}

watch(
  open,
  async (isOpen) => {
    listen(isOpen);
    if (!isOpen) {
      if (props.trap) returnFocus?.focus?.();
      returnFocus = null;
      return;
    }
    returnFocus = document.activeElement;
    await nextTick();
    place();
    if (props.trap) {
      // Focus an input / the menu itself, never the first swatch or button: a focus ring on an
      // arbitrary first control reads as a selection.
      const first = el.value?.querySelector("[autofocus],input,[role='menu']");
      (first ?? el.value)?.focus?.({ preventScroll: true });
    }
  },
  { immediate: true },
);
watch(
  () => props.anchor,
  () => open.value && nextTick(place),
);
onBeforeUnmount(() => listen(false));

defineExpose({ place, el });
</script>

<template>
  <Teleport to="body">
    <Transition name="pop">
      <div
        v-if="open"
        :id="props.popoverId"
        ref="el"
        :role="props.role"
        :aria-label="props.label"
        tabindex="-1"
        class="fixed z-50 outline-none"
        :class="surfaceClass"
        :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
      >
        <slot :close="close" :side="pos.side" />
      </div>
    </Transition>
  </Teleport>
</template>
