import { describe, expect, it } from "vitest";

import { computePosition, pointRect, resolveSide } from "@/utils/position";

const viewport = { width: 1000, height: 700 };
const size = { w: 200, h: 100 };
const anchor = {
    left: 400,
    right: 500,
    top: 300,
    bottom: 330,
    width: 100,
    height: 30,
};
const base = { anchor, size, viewport, offset: 6, pad: 8 };

describe("resolveSide", () => {
    it("maps inline sides by direction", () => {
        expect(resolveSide("inline-start", "ltr")).toBe("left");
        expect(resolveSide("inline-start", "rtl")).toBe("right");
        expect(resolveSide("inline-end", "rtl")).toBe("left");
        expect(resolveSide("bottom", "rtl")).toBe("bottom");
    });
});

describe("computePosition", () => {
    it("bottom/start aligns to the leading edge of the anchor in LTR and RTL", () => {
        expect(computePosition({ ...base, dir: "ltr" })).toMatchObject({
            x: 400,
            y: 336,
            side: "bottom",
        });
        expect(computePosition({ ...base, dir: "rtl" })).toMatchObject({
            x: 300,
            y: 336,
        });
    });

    it("centers and ends", () => {
        expect(computePosition({ ...base, align: "center" }).x).toBe(350);
        expect(computePosition({ ...base, align: "end", dir: "ltr" }).x).toBe(
            300,
        );
    });

    it("flips to top when there is no room below", () => {
        const low = { ...anchor, top: 640, bottom: 670 };
        const r = computePosition({ ...base, anchor: low });
        expect(r.side).toBe("top");
        expect(r.y).toBe(640 - 6 - 100);
    });

    it("does not flip when the opposite side fits no better", () => {
        const tiny = { width: 1000, height: 120 };
        const a = { ...anchor, top: 40, bottom: 70 };
        expect(
            computePosition({ ...base, anchor: a, viewport: tiny }).side,
        ).toBe("bottom");
    });

    it("clamps into the viewport", () => {
        const edge = { ...anchor, left: 950, right: 990 };
        expect(computePosition({ ...base, anchor: edge }).x).toBe(
            1000 - 200 - 8,
        );
        const corner = pointRect(2, 2);
        const r = computePosition({
            ...base,
            anchor: corner,
            offset: 0,
            side: "top",
        });
        expect(r.y).toBeGreaterThanOrEqual(8);
    });

    it("inline-end opens to the left in RTL", () => {
        const r = computePosition({ ...base, side: "inline-end", dir: "rtl" });
        expect(r.side).toBe("left");
        expect(r.x).toBe(400 - 6 - 200);
    });

    it("point anchors work for context menus", () => {
        const r = computePosition({
            ...base,
            anchor: pointRect(100, 100),
            offset: 0,
        });
        expect(r).toMatchObject({ x: 100, y: 100 });
    });
});
