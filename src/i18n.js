import { createI18n } from "vue-i18n";

import en from "@/locales/en.json";
import fa from "@/locales/fa.json";

export const LOCALES = { en: { dir: "ltr" }, fa: { dir: "rtl" } };
const STORAGE_KEY = "erd-editor.locale";

const saved = localStorage.getItem(STORAGE_KEY);
const initial = saved in LOCALES ? saved : "en";

export const i18n = createI18n({
    legacy: false,
    locale: initial,
    fallbackLocale: "en",
    messages: { en, fa },
});

/** Switch UI language and flip document direction. */
export function setLocale(locale) {
    if (!(locale in LOCALES)) return;
    i18n.global.locale.value = locale;
    localStorage.setItem(STORAGE_KEY, locale);
    applyDocumentLocale(locale);
}

export function applyDocumentLocale(locale = i18n.global.locale.value) {
    document.documentElement.lang = locale;
    document.documentElement.dir = LOCALES[locale].dir;
}

applyDocumentLocale(initial);
