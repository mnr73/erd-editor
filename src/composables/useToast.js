import { shallowRef } from "vue";

/** Module-level queue so any component/store can push a toast; <UiToastHost> renders it once. */
const toasts = shallowRef([]);
let seq = 0;

export const TOAST_KINDS = ["info", "success", "warn", "error"];

/**
 * push({ text, kind, timeout, action: { label, run } }) → id.
 * `timeout: 0` keeps it until dismissed (use for errors that need attention).
 */
function push({ text, kind = "info", timeout = 4000, action = null }) {
    const id = ++seq;
    toasts.value = [...toasts.value, { id, text, kind, action }];
    if (timeout > 0) setTimeout(() => dismiss(id), timeout);
    return id;
}

function dismiss(id) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
}

export function useToast() {
    return { toasts, push, dismiss };
}
