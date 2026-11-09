import { ref } from "vue";

import { addRecent, parseRecent, removeRecent } from "@/model/recent";

const KEY = "erd-editor.recent";

const recent = ref(parseRecent(localStorage.getItem(KEY)));

function store(next) {
    recent.value = next;
    localStorage.setItem(KEY, JSON.stringify(next));
}

/** Recently opened/saved files (desktop only: the browser has no paths). */
export function useRecent() {
    return {
        recent,
        remember: (path) => store(addRecent(recent.value, path)),
        forget: (path) => store(removeRecent(recent.value, path)),
    };
}
