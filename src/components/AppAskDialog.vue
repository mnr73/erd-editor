<script setup>
import { nextTick, ref, watch } from "vue";

import UiButton from "@/components/ui/UiButton.vue";

import { answerAsk, useAskState } from "@/composables/useAsk";

/** Modal with custom choices (save / don't save / cancel). Esc and the backdrop answer `null`. */
const state = useAskState();
const box = ref(null);

watch(state, async (v) => {
  if (!v) return;
  await nextTick();
  box.value?.querySelector("[data-autofocus]")?.focus();
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @pointerdown.self="answerAsk(null)"
      @keydown.esc.stop="answerAsk(null)"
    >
      <div
        ref="box"
        role="alertdialog"
        aria-modal="true"
        :aria-label="state.title"
        class="w-[380px] max-w-full rounded-popover bg-popover p-4 shadow-popover"
      >
        <h2 class="text-sm font-semibold text-fg">{{ state.title }}</h2>
        <p class="mt-1.5 text-xs leading-[1.6] text-fg-soft">
          {{ state.message }}
        </p>
        <div class="mt-4 flex flex-wrap justify-end gap-2">
          <UiButton
            v-for="(c, i) in state.choices"
            :key="c.id"
            :variant="c.variant ?? 'secondary'"
            :data-autofocus="i === state.choices.length - 1 ? '' : undefined"
            @click="answerAsk(c.id)"
          >
            {{ c.label }}
          </UiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>
