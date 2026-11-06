import { describe, expect, it } from "vitest";

import {
    contentBounds,
    rectContains,
    rectFromPoints,
    rectsIntersect,
    tableHeight,
    tableWidth,
    unionRects,
} from "@/canvas/geometry";
import {
    ZOOM_MAX,
    ZOOM_MIN,
    centerOn,
    fitRect,
    minimapTransform,
    panBy,
    screenToWorld,
    stepZoom,
    visibleWorldRect,
    worldToScreen,
    zoomAt,
} from "@/canvas/viewport";
import {
    createColumn,
    createDocument,
    createGroup,
    createTable,
} from "@/model/document";

const view = { x: 100, y: 50, zoom: 2 };

describe("viewport math", () => {
    it("world <-> screen round-trips", () => {
        const p = { x: 37, y: -12 };
        expect(screenToWorld(view, worldToScreen(view, p))).toEqual(p);
        expect(worldToScreen(view, { x: 0, y: 0 })).toEqual({ x: 100, y: 50 });
    });

    it("zoomAt keeps the point under the cursor fixed", () => {
        const anchor = { x: 400, y: 300 };
        const before = screenToWorld(view, anchor);
        const next = zoomAt(view, 0.5, anchor);
        const after = screenToWorld(next, anchor);
        expect(after.x).toBeCloseTo(before.x);
        expect(after.y).toBeCloseTo(before.y);
        expect(next.zoom).toBe(0.5);
    });

    it("zoom is clamped", () => {
        expect(zoomAt(view, 99, { x: 0, y: 0 }).zoom).toBe(ZOOM_MAX);
        expect(zoomAt(view, 0.001, { x: 0, y: 0 }).zoom).toBe(ZOOM_MIN);
    });

    it("stepZoom walks the presets and stops at the ends", () => {
        expect(stepZoom(1, 1)).toBe(1.25);
        expect(stepZoom(1, -1)).toBe(0.75);
        expect(stepZoom(0.8, 1)).toBe(1);
        expect(stepZoom(ZOOM_MAX, 1)).toBe(ZOOM_MAX);
        expect(stepZoom(ZOOM_MIN, -1)).toBe(ZOOM_MIN);
    });

    it("panBy moves the origin", () => {
        expect(panBy(view, 5, -5)).toEqual({ x: 105, y: 45, zoom: 2 });
    });

    it("visibleWorldRect covers the viewport", () => {
        expect(visibleWorldRect(view, { w: 800, h: 600 })).toEqual({
            x: -50,
            y: -25,
            w: 400,
            h: 300,
        });
    });

    it("fitRect centers content, respects padding / maxZoom / insets", () => {
        const size = { w: 1000, h: 600 };
        const rect = { x: 100, y: 100, w: 400, h: 200 };
        const v = fitRect(rect, size, { padding: 50, maxZoom: 1 });
        expect(v.zoom).toBe(1); // 900/400 and 500/200 both exceed maxZoom
        const c = worldToScreen(v, { x: 300, y: 200 });
        expect(c.x).toBeCloseTo(500);
        expect(c.y).toBeCloseTo(300);

        const big = fitRect({ x: 0, y: 0, w: 2000, h: 1000 }, size, {
            padding: 0,
        });
        expect(big.zoom).toBeCloseTo(0.5);
        expect(2000 * big.zoom).toBeLessThanOrEqual(1000);

        const withInset = fitRect({ x: 0, y: 0, w: 2000, h: 1000 }, size, {
            padding: 0,
            inset: { bottom: 100 },
        });
        expect(withInset.zoom).toBeCloseTo(0.5);
        expect(1000 * withInset.zoom + withInset.y).toBeLessThanOrEqual(
            500 + 1e-6,
        );
    });

    it("centerOn puts a world point at the viewport center", () => {
        const v = centerOn(
            { x: 0, y: 0, zoom: 2 },
            { x: 10, y: 20 },
            { w: 800, h: 600 },
        );
        expect(worldToScreen(v, { x: 10, y: 20 })).toEqual({ x: 400, y: 300 });
    });

    it("minimapTransform fits the bounds inside the box", () => {
        const tf = minimapTransform(
            { x: 0, y: 0, w: 1000, h: 500 },
            { w: 180, h: 110 },
            8,
        );
        expect(tf.scale).toBeCloseTo(164 / 1000);
        expect(1000 * tf.scale + tf.ox).toBeLessThanOrEqual(180 - 8 + 1e-6);
        expect(tf.ox).toBeGreaterThanOrEqual(8 - 1e-6);
    });
});

describe("geometry", () => {
    const table = (name, cols, extra = {}) =>
        createTable({
            name,
            columns: cols.map(([n, t]) => createColumn({ name: n, type: t })),
            ...extra,
        });

    it("table height follows column count, collapse and empty state", () => {
        const four = table("t", [
            ["a", "int"],
            ["b", "int"],
            ["c", "int"],
            ["d", "int"],
        ]);
        expect(tableHeight(four)).toBe(30 + 4 * 22 + 6 + 2);
        expect(tableHeight({ ...four, collapsed: true })).toBe(32);
        expect(tableHeight(table("empty", []))).toBe(30 + 64 + 2);
    });

    it("table width grows with long names / types but stays within bounds", () => {
        const small = table("a", [["id", "int"]]);
        const wide = table("a", [
            ["a_really_long_column_name_here", "numeric(12,2)"],
        ]);
        expect(tableWidth(small)).toBe(200);
        expect(tableWidth(wide)).toBeGreaterThan(200);
        expect(tableWidth(table("x".repeat(200), []))).toBe(360);
    });

    it("rect helpers", () => {
        const a = { x: 0, y: 0, w: 10, h: 10 };
        expect(rectsIntersect(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
        expect(rectsIntersect(a, { x: 10, y: 0, w: 5, h: 5 })).toBe(false);
        expect(
            rectContains(
                { x: 0, y: 0, w: 100, h: 100 },
                { x: 10, y: 10, w: 20, h: 20 },
            ),
        ).toBe(true);
        expect(rectContains(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(false);
        expect(unionRects([a, { x: 20, y: 30, w: 5, h: 5 }])).toEqual({
            x: 0,
            y: 0,
            w: 25,
            h: 35,
        });
        expect(unionRects([])).toBeNull();
        expect(rectFromPoints({ x: 10, y: 2 }, { x: 4, y: 8 })).toEqual({
            x: 4,
            y: 2,
            w: 6,
            h: 6,
        });
    });

    it("contentBounds covers tables and groups; null when empty", () => {
        const doc = createDocument();
        expect(contentBounds(doc)).toBeNull();
        doc.groups.push(createGroup({ x: -50, y: -50, w: 200, h: 200 }));
        doc.tables.push(table("t", [["id", "int"]], { x: 500, y: 20 }));
        const b = contentBounds(doc);
        expect(b.x).toBe(-50);
        expect(b.x + b.w).toBeGreaterThanOrEqual(700);
    });
});
