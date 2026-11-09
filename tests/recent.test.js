import { describe, expect, it } from "vitest";

import {
    MAX_RECENT,
    addRecent,
    parseRecent,
    removeRecent,
} from "@/model/recent";

describe("recent files", () => {
    it("newest first, no duplicates, capped at 5", () => {
        let l = [];
        for (const p of ["/a", "/b", "/c", "/d", "/e", "/f"])
            l = addRecent(l, p);
        expect(l).toEqual(["/f", "/e", "/d", "/c", "/b"]);
        expect(l).toHaveLength(MAX_RECENT);
        expect(addRecent(l, "/d")).toEqual(["/d", "/f", "/e", "/c", "/b"]);
    });

    it("ignores empty or non-string paths and does not mutate", () => {
        const l = ["/a"];
        for (const bad of [null, undefined, "", 5, {}])
            expect(addRecent(l, bad)).toBe(l);
        addRecent(l, "/b");
        expect(l).toEqual(["/a"]);
    });

    it("removes one path", () => {
        expect(removeRecent(["/a", "/b"], "/a")).toEqual(["/b"]);
        expect(removeRecent(["/a"], "/zzz")).toEqual(["/a"]);
    });

    it("parse survives garbage from storage", () => {
        for (const bad of [null, "", "{", "5", '{"a":1}', "null"])
            expect(parseRecent(bad), String(bad)).toEqual([]);
        expect(parseRecent('["/a", 3, "/a", "", "/b"]')).toEqual(["/a", "/b"]);
        expect(
            parseRecent(JSON.stringify(["/1", "/2", "/3", "/4", "/5", "/6"])),
        ).toHaveLength(5);
    });
});
