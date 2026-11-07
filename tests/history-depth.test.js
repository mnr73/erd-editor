import { describe, expect, it } from "vitest";

import { History } from "@/model/history";
import { buildSampleDocument } from "@/model/sample";
import { serializeErd, snapshotErd } from "@/model/serialize";
import { shortcutKey } from "@/utils/keys";

describe("History depth", () => {
    it("keeps 500 undo steps by default", () => {
        const h = new History("s0");
        for (let i = 1; i <= 600; i++) h.record(`s${i}`);
        expect(h.undoSteps).toBe(500);
        let n = 0;
        while (h.undo() !== null) n++;
        expect(n).toBe(500);
        expect(h.present).toBe("s100");
        expect(h.redoSteps).toBe(500);
    });

    it("a memory budget trims the oldest steps, but minKeep always stays", () => {
        const big = "x".repeat(1000);
        const h = new History(big, { maxChars: 10_000, minKeep: 5 });
        for (let i = 0; i < 40; i++) h.record(big + i);
        expect(h.states.length).toBeLessThanOrEqual(11);
        expect(h.states.length).toBeGreaterThanOrEqual(5);
        const tiny = new History(big, { maxChars: 100, minKeep: 5 });
        for (let i = 0; i < 40; i++) tiny.record(big + i);
        expect(tiny.states.length).toBe(5);
        expect(tiny.present).toBe(big + 39);
    });

    it("trimming keeps undo/redo consistent", () => {
        const h = new History("a", { limit: 3 });
        for (const s of ["b", "c", "d", "e"]) h.record(s);
        expect(h.undo()).toBe("d");
        expect(h.undo()).toBe("c");
        expect(h.undo()).toBeNull();
        expect(h.redo()).toBe("d");
        h.record("z");
        expect(h.redoSteps).toBe(0);
        expect(h.present).toBe("z");
    });

    it("is cheap: 500 snapshots of a realistic board", () => {
        const doc = buildSampleDocument();
        const size = serializeErd(doc).length;
        const t0 = performance.now();
        const h = new History(snapshotErd(doc));
        for (let i = 0; i < 500; i++) {
            doc.tables[0].x += 1;
            h.record(snapshotErd(doc));
        }
        const ms = performance.now() - t0;
        // one step costs one serialization; far below a frame even with a generous margin
        expect(ms / 500).toBeLessThan(5);
        expect(h.states.length * size).toBeLessThan(h.maxChars);
    });
});

describe("shortcutKey", () => {
    it("uses the printed Latin key, whatever the case", () => {
        expect(shortcutKey({ key: "Z", code: "KeyZ" })).toBe("z");
        expect(shortcutKey({ key: "y", code: "KeyY" })).toBe("y");
    });
    it("falls back to the physical key on a non-Latin layout (Persian)", () => {
        expect(shortcutKey({ key: "ض", code: "KeyQ" })).toBe("q");
        expect(shortcutKey({ key: "ظ", code: "KeyZ" })).toBe("z");
        expect(shortcutKey({ key: "۱", code: "Digit1" })).toBe("1");
        expect(shortcutKey({ key: "،", code: "Comma" })).toBe(",");
    });
    it("leaves named keys alone", () => {
        expect(shortcutKey({ key: "Escape", code: "Escape" })).toBe("escape");
        expect(shortcutKey({ key: "Tab", code: "Tab" })).toBe("tab");
    });
});
