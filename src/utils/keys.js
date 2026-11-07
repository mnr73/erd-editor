const CODE_SYMBOLS = {
    Equal: "=",
    Minus: "-",
    Backslash: "\\",
    Slash: "/",
    Comma: ",",
    Period: ".",
};

/**
 * The key of a shortcut as a lower-case Latin letter / digit / symbol, whatever the keyboard layout.
 * On a Persian layout `e.key` is "ض" for the physical Z key, so Ctrl+Z would never match; when the
 * key is not ASCII we fall back to the physical key (`e.code`). Plain ASCII keys are used as they are,
 * so Dvorak and other Latin layouts keep working by the letter printed on the key.
 */
export function shortcutKey(e) {
    const key = e.key ?? "";
    if (key.length === 1 && key.charCodeAt(0) < 128) return key.toLowerCase();
    const code = e.code ?? "";
    if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (CODE_SYMBOLS[code]) return CODE_SYMBOLS[code];
    return key.toLowerCase();
}
