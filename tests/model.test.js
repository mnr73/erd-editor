import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { relationKind } from "@/model/document";
import { History } from "@/model/history";
import { migrate } from "@/model/migrate";
import { serializeErd } from "@/model/serialize";
import { parseErd } from "@/model/validate";

const shop = () =>
    readFileSync(new URL("./fixtures/shop.erd.json", import.meta.url), "utf8");
const codes = (r) => r.issues.map((i) => i.code);

describe("validate", () => {
    it("opens a valid file with no issues and fills defaults", () => {
        const r = parseErd(shop());
        expect(r.issues).toEqual([]);
        const t = r.doc.tables[1];
        expect(t.collapsed).toBe(false);
        expect(t.color).toBeNull();
        expect(t.columns[0].default).toBe("");
        expect(r.doc.view.zoom).toBe(1);
    });

    it.each([
        ["not json", "{nope", "invalid-json"],
        ["array", "[]", "not-object"],
        ["wrong format", '{"format":"x","version":1}', "wrong-format"],
        ["no version", '{"format":"erd-editor"}', "bad-version"],
        [
            "newer version",
            '{"format":"erd-editor","version":99}',
            "newer-version",
        ],
        [
            "tables not array",
            '{"format":"erd-editor","version":1,"tables":{}}',
            "bad-container",
        ],
        [
            "duplicate ids",
            '{"format":"erd-editor","version":1,"tables":[{"id":"a","name":"x"},{"id":"a","name":"y"}]}',
            "duplicate-id",
        ],
    ])("fatal: %s", (_n, text, code) => {
        const r = parseErd(text);
        expect(r.doc).toBeNull();
        expect(codes(r)).toEqual([code]);
    });

    it("keeps the doc and warns on dangling references", () => {
        const d = JSON.parse(shop());
        d.refs[0].to.columns = ["c_gone"];
        d.tables[1].color = "red";
        d.refs[0].from.cardinality = "many";
        d.refs[0].onDelete = "explode";
        const r = parseErd(JSON.stringify(d));
        expect(r.doc).not.toBeNull();
        expect(codes(r)).toEqual(
            expect.arrayContaining([
                "ref-column-missing",
                "bad-color",
                "bad-cardinality",
                "bad-ref-action",
            ]),
        );
        expect(r.doc.tables[0]).not.toHaveProperty("groupId");
        expect(r.doc.refs[0].from.cardinality).toBe("0..*");
    });

    it("warns on duplicate names and generates missing ids", () => {
        const text = JSON.stringify({
            format: "erd-editor",
            version: 1,
            tables: [
                { name: "a", columns: [{ name: "x" }, { name: "X" }] },
                { name: "a" },
            ],
        });
        const r = parseErd(text);
        expect(codes(r)).toEqual(
            expect.arrayContaining([
                "id-missing",
                "duplicate-column-name",
                "duplicate-table-name",
            ]),
        );
        expect(r.doc.tables[0].id).toMatch(/^t_/);
    });

    it("preserves unknown keys at every level", () => {
        const d = JSON.parse(shop());
        d.tables[0].futureThing = 5;
        d.tables[0].columns[0].futureCol = "z";
        const r = parseErd(JSON.stringify(d));
        expect(r.doc.unknownTopLevel).toEqual({ kept: true });
        expect(r.doc.tables[0].futureThing).toBe(5);
        const out = JSON.parse(serializeErd(r.doc));
        expect(out.unknownTopLevel).toEqual({ kept: true });
        expect(out.tables[0].futureThing).toBe(5);
        expect(out.tables[0].columns[0].futureCol).toBe("z");
    });
});

describe("serialize", () => {
    it("is stable: parse → serialize → parse → serialize gives identical text", () => {
        const a = serializeErd(parseErd(shop()).doc);
        const b = serializeErd(parseErd(a).doc);
        expect(b).toBe(a);
    });

    it("omits defaults and writes keys in the documented order", () => {
        const out = serializeErd(parseErd(shop()).doc);
        expect(out).not.toContain('"collapsed"');
        expect(out).not.toContain('"noteVisible"');
        expect(out).not.toContain('"increment": false');
        const obj = JSON.parse(out);
        expect(Object.keys(obj)).toEqual([
            "format",
            "version",
            "meta",
            "palette",
            "tables",
            "refs",
            "groups",
            "view",
            "unknownTopLevel",
        ]);
        expect(Object.keys(obj.tables[0]).slice(0, 3)).toEqual([
            "id",
            "name",
            "color",
        ]);
        expect(out.endsWith("}\n")).toBe(true);
    });
});

describe("migrate", () => {
    it("rejects bad and newer versions, returns a copy otherwise", () => {
        expect(() => migrate({ version: 0 })).toThrow("bad-version");
        expect(() => migrate({ version: 2 })).toThrow("newer-version");
        const src = { version: 1, format: "erd-editor" };
        const out = migrate(src);
        expect(out).toEqual(src);
        expect(out).not.toBe(src);
    });
});

describe("relationKind", () => {
    const end = (cardinality) => ({ cardinality });
    it.each([
        ["0..*", "1", "N:1"],
        ["1", "0..*", "1:N"],
        ["0..1", "1", "1:1"],
        ["1..*", "0..*", "N:M"],
    ])("%s → %s = %s", (from, to, kind) => {
        expect(relationKind({ from: end(from), to: end(to) })).toBe(kind);
    });
});

describe("History", () => {
    it("undo / redo and truncates redo branch on new record", () => {
        const h = new History("a");
        h.record("b");
        h.record("c");
        expect(h.undo()).toBe("b");
        expect(h.undo()).toBe("a");
        expect(h.undo()).toBeNull();
        expect(h.redo()).toBe("b");
        h.record("x");
        expect(h.canRedo).toBe(false);
        expect(h.present).toBe("x");
    });

    it("coalesces same-key records inside the window only", () => {
        const h = new History("a", { coalesceMs: 500 });
        h.record("b", { key: "drag", now: 1000 });
        h.record("c", { key: "drag", now: 1200 });
        h.record("d", { key: "drag", now: 2000 });
        expect(h.undo()).toBe("c");
        expect(h.undo()).toBe("a");
    });

    it("ignores identical state and respects the limit", () => {
        const h = new History("a", { limit: 3 });
        expect(h.record("a")).toBe(false);
        ["b", "c", "d", "e"].forEach((s) => h.record(s));
        expect(h.states.length).toBe(3);
        expect(h.present).toBe("e");
        expect(h.undo()).toBe("d");
    });
});
