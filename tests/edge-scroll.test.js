import { describe, expect, it } from "vitest";

import { EDGE_MAX_SPEED, EDGE_ZONE, edgeScroll } from "@/canvas/viewport";

const size = { w: 1000, h: 600 };

describe("edgeScroll", () => {
    it("does nothing away from the edges", () => {
        expect(edgeScroll({ x: 500, y: 300 }, size)).toEqual({ dx: 0, dy: 0 });
        expect(edgeScroll({ x: EDGE_ZONE, y: 300 }, size)).toEqual({
            dx: 0,
            dy: 0,
        });
    });

    it("moves the view away from the pointer: left edge pans right, right edge pans left", () => {
        expect(edgeScroll({ x: 0, y: 300 }, size).dx).toBe(EDGE_MAX_SPEED);
        expect(edgeScroll({ x: 1000, y: 300 }, size).dx).toBe(-EDGE_MAX_SPEED);
        expect(edgeScroll({ x: 500, y: 0 }, size).dy).toBe(EDGE_MAX_SPEED);
        expect(edgeScroll({ x: 500, y: 600 }, size).dy).toBe(-EDGE_MAX_SPEED);
    });

    it("speeds up closer to the edge and caps outside it", () => {
        const slow = edgeScroll({ x: 40, y: 300 }, size).dx;
        const fast = edgeScroll({ x: 10, y: 300 }, size).dx;
        expect(slow).toBeGreaterThan(0);
        expect(fast).toBeGreaterThan(slow);
        expect(edgeScroll({ x: -400, y: 300 }, size).dx).toBe(EDGE_MAX_SPEED);
        expect(edgeScroll({ x: 5000, y: 300 }, size).dx).toBe(-EDGE_MAX_SPEED);
    });

    it("works on both axes at a corner", () => {
        expect(edgeScroll({ x: 0, y: 0 }, size)).toEqual({
            dx: EDGE_MAX_SPEED,
            dy: EDGE_MAX_SPEED,
        });
    });

    it("a tiny canvas still has a dead centre", () => {
        expect(edgeScroll({ x: 30, y: 30 }, { w: 60, h: 60 })).toEqual({
            dx: 0,
            dy: 0,
        });
    });
});
