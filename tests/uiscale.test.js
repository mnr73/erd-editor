import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
    DEFAULT_UI_SCALE,
    UI_SCALES,
    normalizeUiScale,
    stepUiScale,
    uiScaleLabel,
} from "@/model/uiscale";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("ui scale", () => {
    it("100% is the default and is one of the steps", () => {
        expect(DEFAULT_UI_SCALE).toBe(1);
        expect(UI_SCALES).toContain(1);
        expect([...UI_SCALES].sort((a, b) => a - b)).toEqual(UI_SCALES);
    });

    it("normalize: bad storage values become the default, others snap to a step", () => {
        for (const bad of [null, undefined, "", "abc", NaN, Infinity, {}, []])
            expect(normalizeUiScale(bad), String(bad)).toBe(1);
        expect(normalizeUiScale("1.25")).toBe(1.25);
        expect(normalizeUiScale(1.26)).toBe(1.25);
        expect(normalizeUiScale(99)).toBe(UI_SCALES.at(-1));
        expect(normalizeUiScale(-5)).toBe(UI_SCALES[0]);
        expect(normalizeUiScale("0")).toBe(UI_SCALES[0]);
    });

    it("step moves one notch and stops at both ends", () => {
        expect(stepUiScale(1, 1)).toBe(1.1);
        expect(stepUiScale(1, -1)).toBe(0.9);
        expect(stepUiScale(UI_SCALES.at(-1), 1)).toBe(UI_SCALES.at(-1));
        expect(stepUiScale(UI_SCALES[0], -1)).toBe(UI_SCALES[0]);
        let v = UI_SCALES[0];
        for (let i = 0; i < 20; i++) v = stepUiScale(v, 1);
        expect(v).toBe(UI_SCALES.at(-1));
    });

    it("labels are percentages", () => {
        expect(UI_SCALES.map(uiScaleLabel)).toEqual([
            "90%",
            "100%",
            "110%",
            "125%",
            "140%",
        ]);
    });
});

describe("the board keeps its own size", () => {
    // The scale is applied through CSS variables. Anything drawn on the board must not use them,
    // or table widths (computed from fixed pixel font sizes in geometry.js) would no longer match.
    const board = [
        "CanvasTable",
        "CanvasGroup",
        "CanvasNote",
        "CanvasFreeNote",
        "CanvasRelations",
        "CanvasMinimap",
    ];
    it.each(board)("%s uses only fixed pixel font sizes", (name) => {
        const src = read(`../src/canvas/${name}.vue`);
        expect(src, name).not.toMatch(/text-ui-\d+/);
        expect(src, name).not.toMatch(/\btext-(sm|base|lg|xl)\b/);
        expect(src, name).not.toMatch(/\btext-xs\b/);
        expect(src, name).not.toContain("--ui-scale");
    });

    it("the interface text sizes follow the scale", () => {
        const css = read("../src/style.css");
        expect(css).toMatch(/--ui-scale: 1;/);
        expect(css).toMatch(
            /--text-ui-115: calc\(11\.5px \* var\(--ui-scale\)\)/,
        );
        expect(css).toMatch(/--text-xs: calc\(0\.75rem \* var\(--ui-scale\)\)/);
        expect(css).toMatch(/font-size: calc\(13px \* var\(--ui-scale\)\)/);
    });
});
