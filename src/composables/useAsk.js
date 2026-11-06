import { shallowRef } from "vue";

/** Module-level state for <AppAskDialog>; any code can `await askChoice(...)`. */
const current = shallowRef(null);

/**
 * Show a modal with custom buttons and resolve with the id of the chosen one (null on Esc / backdrop).
 * choices: [{ id, label, variant?: "primary"|"secondary"|"danger"|"ghost" }]
 */
export function askChoice({ title, message, choices }) {
    return new Promise((resolve) => {
        current.value = { title, message, choices, resolve };
    });
}

export function answerAsk(id) {
    const c = current.value;
    current.value = null;
    c?.resolve(id);
}

export const useAskState = () => current;
