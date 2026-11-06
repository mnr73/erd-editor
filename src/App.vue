<script setup>
import { onMounted, onUnmounted, shallowRef } from "vue";

import { useI18n } from "vue-i18n";

import UiIconButton from "@/components/ui/UiIconButton.vue";
import UiToastHost from "@/components/ui/UiToastHost.vue";

import { useTheme } from "@/composables/useTheme";
import ComponentsPage from "@/dev/ComponentsPage.vue";
import { setLocale } from "@/i18n";
import { IconLanguage, IconThemeDark, IconThemeLight } from "@/icons";
import { listenOpenFile, readInitialFile } from "@/tauri";

const { t, locale } = useI18n();
const { theme, toggleTheme } = useTheme();
const filePath = shallowRef(null);
let unlisten = null;

onMounted(async () => {
  filePath.value = await readInitialFile();
  unlisten = await listenOpenFile((path) => (filePath.value = path));
});
onUnmounted(() => unlisten?.());
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Temporary shell: replaced by the real title bar in stage 4 -->
    <header
      class="flex h-[var(--size-titlebar)] shrink-0 items-center gap-2 border-b border-line bg-panel px-3"
    >
      <span class="text-[13px] font-semibold">{{ t("app.name") }}</span>
      <span class="truncate font-mono text-[11px] text-muted" dir="ltr">{{
        filePath ?? t("app.noFile")
      }}</span>
      <span class="flex-1" />
      <UiIconButton
        :label="t('app.language')"
        @click="setLocale(locale === 'en' ? 'fa' : 'en')"
      >
        <IconLanguage class="size-4" />
      </UiIconButton>
      <UiIconButton :label="t('app.theme')" @click="toggleTheme">
        <component
          :is="theme === 'dark' ? IconThemeLight : IconThemeDark"
          class="size-4"
        />
      </UiIconButton>
    </header>
    <main class="min-h-0 flex-1"><ComponentsPage /></main>
    <UiToastHost />
  </div>
</template>
