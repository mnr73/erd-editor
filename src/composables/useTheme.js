import { ref } from "vue";

const KEY = "erd-editor.theme";
export const THEMES = ["dark", "light"];

const saved = localStorage.getItem(KEY);
const theme = ref(THEMES.includes(saved) ? saved : "dark");

function apply() {
    document.documentElement.dataset.theme = theme.value;
}
apply();

export function useTheme() {
    function setTheme(next) {
        if (!THEMES.includes(next)) return;
        theme.value = next;
        localStorage.setItem(KEY, next);
        apply();
    }
    const toggleTheme = () =>
        setTheme(theme.value === "dark" ? "light" : "dark");
    return { theme, setTheme, toggleTheme };
}
