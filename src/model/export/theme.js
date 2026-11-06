/**
 * Colors of exported images. An exported SVG / PNG is a standalone file, so it cannot use the app's
 * CSS variables: these are the same values as the `--c-*` tokens in src/style.css, resolved for the
 * two themes. Keep them in sync when the style guide changes.
 */
export const EXPORT_THEMES = {
    dark: {
        canvas: "#0d1015",
        card: "#151920",
        line: "#1c2129",
        lineStrong: "#2a3446",
        fg: "#e6eaf2",
        fgSoft: "#c9d0dc",
        muted: "#8a93a3",
        faint: "#7d8696",
        rel: "#6b7689",
        pk: "#e8b54a",
        fk: "#7fb0ff",
        warn: "#e0a33a",
        headerMix: 14,
        noteMix: 15,
        sectionMix: 6,
    },
    light: {
        canvas: "#f6f7f9",
        card: "#ffffff",
        line: "#e2e5eb",
        lineStrong: "#cdd3de",
        fg: "#161a22",
        fgSoft: "#3a4352",
        muted: "#5b6474",
        faint: "#667086",
        rel: "#7d8aa0",
        pk: "#a86a00",
        fk: "#2f6fe0",
        warn: "#b26a00",
        headerMix: 12,
        noteMix: 15,
        sectionMix: 6,
    },
};

export const DEFAULT_TABLE_COLOR = "#8792A6";
export const DEFAULT_NOTE_COLOR_HEX = "#E0A33A";

/** `color` mixed `pct`% into `base` (both #rrggbb) → #rrggbb. Same result as CSS color-mix in sRGB. */
export function mixHex(color, base, pct) {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const a = p(color);
    const b = p(base);
    const t = pct / 100;
    return (
        "#" +
        a
            .map((v, i) =>
                Math.round(v * t + b[i] * (1 - t))
                    .toString(16)
                    .padStart(2, "0"),
            )
            .join("")
    );
}
