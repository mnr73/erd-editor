/** Interface text size (Settings). A multiplier on the interface fonts; the board's own text is not affected. */
export const UI_SCALES = [0.9, 1, 1.1, 1.25, 1.4];
export const DEFAULT_UI_SCALE = 1;
export const MIN_UI_SCALE = UI_SCALES[0];
export const MAX_UI_SCALE = UI_SCALES.at(-1);

/** Accepts a number or a string from storage; anything unusable becomes the default. */
export function normalizeUiScale(v) {
    const n = typeof v === "string" ? Number.parseFloat(v) : v;
    if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_UI_SCALE;
    // snap to the nearest allowed step, so a hand-edited value cannot break the layout
    return UI_SCALES.reduce((best, s) =>
        Math.abs(s - n) < Math.abs(best - n) ? s : best,
    );
}

/** One step bigger / smaller; stays put at the ends. */
export function stepUiScale(current, dir) {
    const i = UI_SCALES.indexOf(normalizeUiScale(current));
    return UI_SCALES[Math.min(UI_SCALES.length - 1, Math.max(0, i + dir))];
}

/** "110%" for the UI. */
export const uiScaleLabel = (v) => `${Math.round(normalizeUiScale(v) * 100)}%`;
