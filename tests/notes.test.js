import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import {
    createDocument,
    createGroup,
    createNote,
    createTable,
} from "@/model/document";
import { contentBounds, movedWith, noteRect } from "@/model/geometry";
import { searchDocument } from "@/model/search";
import { serializeErd } from "@/model/serialize";
import { parseErd } from "@/model/validate";
import { useDocumentStore } from "@/stores/document";

const roundTrip = (doc) => parseErd(serializeErd(doc));

describe("free notes in the file", () => {
    it("are optional: a file without `notes` loads with an empty list and is written without it", () => {
        const doc = createDocument("x");
        expect(doc.notes).toEqual([]);
        expect(serializeErd(doc)).not.toContain('"notes"');
        const { doc: back } = parseErd(
            JSON.stringify({ format: "erd-editor", version: 1 }),
        );
        expect(back.notes).toEqual([]);
    });

    it("round-trip with fixed key order and defaults omitted", () => {
        const doc = createDocument("x");
        doc.notes.push(
            createNote({
                id: "n_a",
                text: "hello",
                color: "#4C8DFF",
                x: 10,
                y: 20,
                w: 200,
                h: 100,
            }),
            createNote({ id: "n_b", x: 1, y: 2 }),
        );
        const text = serializeErd(doc);
        const obj = JSON.parse(text);
        expect(Object.keys(obj.notes[0])).toEqual([
            "id",
            "text",
            "color",
            "x",
            "y",
            "w",
            "h",
        ]);
        expect(Object.keys(obj.notes[1])).toEqual(["id", "x", "y", "w", "h"]);
        const { doc: back, issues } = parseErd(text);
        expect(issues).toEqual([]);
        expect(back.notes).toEqual(doc.notes);
        expect(serializeErd(back)).toBe(text);
    });

    it("`notes` comes right after `groups`", () => {
        const doc = createDocument("x");
        doc.tables.push(createTable({ id: "t1", name: "a" }));
        doc.groups.push(createGroup({ id: "g1", name: "g" }));
        doc.notes.push(createNote({ id: "n1" }));
        const keys = Object.keys(JSON.parse(serializeErd(doc)));
        expect(keys.indexOf("notes")).toBe(keys.indexOf("groups") + 1);
    });

    it("bad input is repaired with warnings, never rejected", () => {
        const { doc, issues } = parseErd(
            JSON.stringify({
                format: "erd-editor",
                version: 1,
                notes: [
                    {
                        id: "n1",
                        text: 5,
                        color: "red",
                        x: "a",
                        w: 3,
                        h: 9999,
                        extra: 1,
                    },
                    { text: "no id" },
                    "junk",
                ],
            }),
        );
        expect(doc.notes).toHaveLength(2);
        const [a, b] = doc.notes;
        expect(a).toMatchObject({
            id: "n1",
            text: "5",
            color: null,
            x: 0,
            w: 80,
            h: 9999,
            extra: 1,
        });
        expect(b.id).toMatch(/^n_/);
        expect(issues.map((i) => i.code)).toEqual(
            expect.arrayContaining(["bad-color", "id-missing"]),
        );
    });

    it("a wrong container type is fatal like for the other lists, duplicate ids too", () => {
        expect(
            parseErd(
                JSON.stringify({ format: "erd-editor", version: 1, notes: {} }),
            ).doc,
        ).toBeNull();
        expect(
            parseErd(
                JSON.stringify({
                    format: "erd-editor",
                    version: 1,
                    notes: [{ id: "n" }, { id: "n" }],
                }),
            ).doc,
        ).toBeNull();
    });
});

describe("free notes and geometry", () => {
    const doc = createDocument();
    doc.groups.push(createGroup({ id: "g1", x: 0, y: 0, w: 400, h: 300 }));
    doc.notes.push(
        createNote({ id: "in", x: 20, y: 20, w: 100, h: 80 }),
        createNote({ id: "half", x: 350, y: 20, w: 100, h: 80 }),
        createNote({ id: "out", x: 900, y: 900, w: 100, h: 80 }),
    );

    it("a moved section carries the notes completely inside it, and only those", () => {
        const r = movedWith(doc, ["g1"]);
        expect([...r.notes]).toEqual(["in"]);
    });

    it("a selected note moves alone; without notes in the doc nothing breaks", () => {
        expect([...movedWith(doc, ["out"]).notes]).toEqual(["out"]);
        const old = { tables: [], groups: [] };
        expect(movedWith(old, []).notes.size).toBe(0);
    });

    it("content bounds include notes", () => {
        const b = contentBounds(doc);
        expect(b.x + b.w).toBe(1000);
        expect(noteRect(doc.notes[0])).toEqual({ x: 20, y: 20, w: 100, h: 80 });
    });
});

describe("free notes in the store", () => {
    let s;
    beforeEach(() => {
        setActivePinia(createPinia());
        s = useDocumentStore();
        s.newTab();
    });

    it("add / edit / move / delete, each one undo step; typing coalesces", () => {
        const id = s.addNote({ x: 5, y: 6 });
        expect(s.doc.notes).toHaveLength(1);
        s.updateNote(id, { text: "a" }, "text");
        s.updateNote(id, { text: "ab" }, "text");
        s.updateNote(id, { text: "abc" }, "text");
        expect(s.doc.notes[0].text).toBe("abc");
        s.undo();
        expect(s.doc.notes[0].text).toBe("");
        s.setNoteRect(id, { x: 50, y: 60, w: 300, h: 200 });
        expect(s.doc.notes[0]).toMatchObject({ x: 50, y: 60, w: 300, h: 200 });
        s.undo();
        expect(s.doc.notes[0]).toMatchObject({ x: 5, y: 6 });
        s.removeNotes([id]);
        expect(s.doc.notes).toHaveLength(0);
        s.undo();
        expect(s.doc.notes).toHaveLength(1);
    });

    it("moveItems moves selected notes, and notes inside a moved section, once", () => {
        const g = s.addGroup({ x: 0, y: 0, w: 400, h: 300 });
        const inside = s.addNote({ x: 10, y: 10, w: 100, h: 80 });
        const free = s.addNote({ x: 700, y: 10, w: 100, h: 80 });
        s.moveItems([g, inside], 5, 7);
        const by = (id) => s.doc.notes.find((n) => n.id === id);
        expect(by(inside)).toMatchObject({ x: 15, y: 17 });
        expect(by(free)).toMatchObject({ x: 700, y: 10 });
        s.moveItems([free], -100, 0);
        expect(by(free).x).toBe(600);
    });

    it("duplicate gives a fresh id, an offset and the same text / color", () => {
        const id = s.addNote({ x: 0, y: 0, text: "hi", color: "#4C8DFF" });
        const [copy] = s.duplicateNotes([id]);
        expect(copy).not.toBe(id);
        const c = s.doc.notes.find((n) => n.id === copy);
        expect(c).toMatchObject({ x: 32, y: 32, text: "hi", color: "#4C8DFF" });
    });

    it("notes survive a save / load of the tab", () => {
        s.addNote({ x: 1, y: 2, text: "keep" });
        const back = roundTrip(s.doc).doc;
        expect(back.notes[0]).toMatchObject({ text: "keep", x: 1, y: 2 });
    });
});

describe("free notes are searchable", () => {
    it("by text, shown with the first line", () => {
        const doc = createDocument();
        doc.notes.push(
            createNote({ id: "n1", text: "TODO: split orders\nlater" }),
        );
        const r = searchDocument(doc, "split");
        expect(r[0]).toMatchObject({ kind: "note", id: "n1" });
        expect(r[0].name).toBe("TODO: split orders");
    });
});
