import { describe, expect, it } from "vitest";

import { ACTION, DISK, decide, diskState, sameStamp } from "@/model/external";

const a = { mtime: 1000, size: 10 };

describe("diskState", () => {
    it("same stamp = same; different mtime or size = changed; missing = gone", () => {
        expect(diskState(a, { ...a })).toBe(DISK.SAME);
        expect(diskState(a, { mtime: 2000, size: 10 })).toBe(DISK.CHANGED);
        expect(diskState(a, { mtime: 1000, size: 11 })).toBe(DISK.CHANGED);
        expect(diskState(a, null)).toBe(DISK.GONE);
    });

    it("a tab that never touched the disk has nothing to compare", () => {
        expect(diskState(null, null)).toBe(DISK.SAME);
        expect(diskState(null, a)).toBe(DISK.SAME);
        expect(diskState(undefined, a)).toBe(DISK.SAME);
    });

    it("sameStamp tolerates missing stamps", () => {
        expect(sameStamp(null, a)).toBe(false);
        expect(sameStamp(a, undefined)).toBe(false);
    });
});

describe("decide", () => {
    const b = { mtime: 2000, size: 12 };
    it("nothing to do when the file is as we left it", () => {
        expect(decide({ state: DISK.SAME, dirty: true, now: a })).toBe(
            ACTION.NONE,
        );
    });

    it("clean tab + changed file: silent reload", () => {
        expect(decide({ state: DISK.CHANGED, dirty: false, now: b })).toBe(
            ACTION.RELOAD,
        );
    });

    it("tab with unsaved work + changed file: only ask, never reload", () => {
        expect(decide({ state: DISK.CHANGED, dirty: true, now: b })).toBe(
            ACTION.ASK,
        );
    });

    it("keeping my version silences that disk state, but a newer change asks again", () => {
        expect(
            decide({ state: DISK.CHANGED, dirty: true, now: b, dismissed: b }),
        ).toBe(ACTION.NONE);
        const c = { mtime: 3000, size: 13 };
        expect(
            decide({ state: DISK.CHANGED, dirty: true, now: c, dismissed: b }),
        ).toBe(ACTION.ASK);
    });

    it("a deleted file is announced once", () => {
        expect(decide({ state: DISK.GONE, dirty: false })).toBe(ACTION.GONE);
        expect(decide({ state: DISK.GONE, dirty: true })).toBe(ACTION.GONE);
        expect(
            decide({ state: DISK.GONE, dirty: true, dismissed: "gone" }),
        ).toBe(ACTION.NONE);
    });
});
