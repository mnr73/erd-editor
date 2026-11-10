import { readFileSync } from "node:fs";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { useDocumentStore } from "@/stores/document";

const shop = readFileSync(
    new URL("./fixtures/shop.erd.json", import.meta.url),
    "utf8",
);
const PATH = "/tmp/shop.erd.json";
const STAMP = { mtime: 1, size: 1 };
const NEXT = { mtime: 2, size: 2 };

let s;
beforeEach(() => {
    setActivePinia(createPinia());
    s = useDocumentStore();
    s.openText(shop, PATH, STAMP);
});

const withTable = (name) => {
    const d = JSON.parse(shop);
    d.tables[0].name = name;
    return JSON.stringify(d);
};

describe("replaceFromDisk", () => {
    it("takes the disk content, leaves the tab clean, remembers the new stamp", () => {
        expect(s.activeStamp).toEqual(STAMP);
        expect(
            s.replaceFromDisk(s.activeId, withTable("from_disk"), NEXT),
        ).toBe(true);
        expect(s.doc.tables[0].name).toBe("from_disk");
        expect(s.dirty).toBe(false);
        expect(s.activeStamp).toEqual(NEXT);
    });

    it("is one undo step: Ctrl+Z brings back what was in the app, redo the disk version", () => {
        const before = s.doc.tables[0].name;
        s.replaceFromDisk(s.activeId, withTable("from_disk"), NEXT);
        expect(s.undoSteps).toBe(1);
        s.undo();
        expect(s.doc.tables[0].name).toBe(before);
        s.redo();
        expect(s.doc.tables[0].name).toBe("from_disk");
    });

    it("keeps unsaved history: edits made before the reload can still be undone", () => {
        s.commit((d) => (d.tables[0].name = "mine"));
        s.replaceFromDisk(s.activeId, withTable("from_disk"), NEXT);
        s.undo();
        expect(s.doc.tables[0].name).toBe("mine");
    });

    it("keeps the camera where it was", () => {
        s.setView({ x: 123, y: -45, zoom: 1.5 });
        s.replaceFromDisk(s.activeId, withTable("from_disk"), NEXT);
        expect(s.doc.view).toMatchObject({ x: 123, y: -45, zoom: 1.5 });
    });

    it("an invalid text changes nothing and reports false", () => {
        expect(s.replaceFromDisk(s.activeId, "{ nope", NEXT)).toBe(false);
        expect(s.doc.tables[0].name).toBe(JSON.parse(shop).tables[0].name);
        expect(s.activeStamp).toEqual(STAMP);
    });

    it("an unknown tab id is ignored", () => {
        expect(s.replaceFromDisk("tab_nope", shop, NEXT)).toBe(false);
    });
});

describe("saving and dismissing", () => {
    it("markSaved stores the new stamp and forgets an earlier 'keep mine'", () => {
        s.dismissDisk(s.activeId, NEXT);
        expect(s.tabById(s.activeId).dismissed).toEqual(NEXT);
        s.markSaved(PATH, { mtime: 9, size: 9 });
        expect(s.activeStamp).toEqual({ mtime: 9, size: 9 });
        expect(s.tabById(s.activeId).dismissed).toBeNull();
    });

    it("a tab opened without a stamp (browser, new board) is never compared", () => {
        s.newTab();
        expect(s.activeStamp).toBeNull();
    });
});
