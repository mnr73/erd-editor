<script setup>
import { useToast } from "@/composables/useToast";
import {
  IconClose,
  IconError,
  IconInfo,
  IconSuccess,
  IconWarning,
} from "@/icons";

import UiButton from "./UiButton.vue";

const { toasts, dismiss } = useToast();

const kinds = {
  info: { icon: IconInfo, color: "text-accent-text" },
  success: { icon: IconSuccess, color: "text-success" },
  warn: { icon: IconWarning, color: "text-warn" },
  error: { icon: IconError, color: "text-danger" },
};
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 bottom-10 z-[60] flex flex-col items-center gap-2"
      role="region"
      aria-live="polite"
    >
      <TransitionGroup name="pop">
        <div
          v-for="t in toasts"
          :key="t.id"
          :role="t.kind === 'error' ? 'alert' : 'status'"
          class="pointer-events-auto flex max-w-md items-center gap-2.5 rounded-popover bg-popover py-2 ps-3 pe-2 text-xs text-fg shadow-popover"
        >
          <component
            :is="kinds[t.kind].icon"
            class="size-4 shrink-0"
            :class="kinds[t.kind].color"
          />
          <span class="flex-1">{{ t.text }}</span>
          <UiButton
            v-if="t.action"
            variant="ghost"
            size="sm"
            @click="(t.action.run(), dismiss(t.id))"
          >
            {{ t.action.label }}
          </UiButton>
          <button
            type="button"
            class="inline-flex size-6 items-center justify-center rounded-chip text-muted hover:bg-hover"
            @click="dismiss(t.id)"
          >
            <IconClose class="size-3.5" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
