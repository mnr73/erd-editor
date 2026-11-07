import { ref } from "vue";

import { normalizeUiScale, stepUiScale } from "@/model/uiscale";

const KEY = "erd-editor.uiScale";

const scale = ref(normalizeUiScale(localStorage.getItem(KEY)));

function apply() {
    document.documentElement.style.setProperty(
        "--ui-scale",
        String(scale.value),
    );
}
apply();

export function useUiScale() {
    function setScale(next) {
        scale.value = normalizeUiScale(next);
        localStorage.setItem(KEY, String(scale.value));
        apply();
    }
    const bigger = () => setScale(stepUiScale(scale.value, 1));
    const smaller = () => setScale(stepUiScale(scale.value, -1));
    return { scale, setScale, bigger, smaller };
}
