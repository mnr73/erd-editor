import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useToast } from "@/composables/useToast";
import { openDropped } from "@/services/files";
import { useDocumentStore } from "@/stores/document";
import { isErdName } from "@/utils/path";

vi.mock("@/i18n", () => ({
    i18n: { global: { t: (key) => key, te: (key) => key.startsWith("file.") } },
}));
vi.hoisted(() => {
    const memory = new Map();
    globalThis.localStorage = {
        getItem: (k) => (memory.has(k) ? memory.get(k) : null),
        setItem: (k, v) => memory.set(k, String(v)),
    };
});

const file = (name, text) => ({ name, file: { text: async () => text } });
const good = JSON.stringify({ format: "erd-editor", version: 1, tables: [] });

describe("isErdName", () => {
    it("accepts only .erd.json, any case", () => {
        expect(isErdName("a.erd.json")).toBe(true);
        expect(isErdName("A.ERD.JSON")).toBe(true);
        expect(isErdName("a.json")).toBe(false);
        expect(isErdName("a.erd.json.txt")).toBe(false);
        expect(isErdName("erd.json")).toBe(false);
        expect(isErdName(undefined)).toBe(false);
    });
});

describe("openDropped", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        useToast().toasts.value = [];
    });
    const toasts = () => useToast().toasts.value;

    it("opens a valid file in a tab", async () => {
        const doc = useDocumentStore();
        await openDropped([file("shop.erd.json", good)]);
        expect(toasts()).toEqual([]);
        expect(doc.isFresh).toBe(false);
    });

    it("rejects a wrong extension without reading the file", async () => {
        const doc = useDocumentStore();
        await openDropped([file("notes.txt", good)]);
        expect(toasts()).toHaveLength(1);
        expect(toasts()[0].kind).toBe("error");
        expect(doc.isFresh).toBe(true);
    });

    it("reports a broken structure and opens nothing", async () => {
        const doc = useDocumentStore();
        for (const text of [
            "not json",
            "[]",
            JSON.stringify({ format: "other", version: 1 }),
            JSON.stringify({ format: "erd-editor", version: "x" }),
            JSON.stringify({ format: "erd-editor", version: 99 }),
            JSON.stringify({ format: "erd-editor", version: 1, tables: 5 }),
        ]) {
            useToast().toasts.value = [];
            await openDropped([file("bad.erd.json", text)]);
            expect(toasts(), text).toHaveLength(1);
            expect(toasts()[0].kind).toBe("error");
            expect(toasts()[0].text).toBe("file.openFailed");
        }
        expect(doc.isFresh).toBe(true);
    });

    it("handles several files: bad ones fail, good ones open", async () => {
        const doc = useDocumentStore();
        await openDropped([
            file("a.txt", good),
            file("b.erd.json", good),
            file("c.erd.json", "{"),
        ]);
        expect(toasts()).toHaveLength(2);
        expect(doc.isFresh).toBe(false);
    });
});
