import { describe, expect, it } from "vitest";

import { fkColumnKeys } from "@/model/document";
import { toDbml } from "@/model/export/dbml";
import { toSql } from "@/model/export/sql";
import {
    groupMembership,
    noteRect,
    pinnedNotes,
    rectsIntersect,
    tableRect,
} from "@/model/geometry";
import { buildSampleDocument } from "@/model/sample";
import { serializeErd } from "@/model/serialize";
import { parseType } from "@/model/types";
import { parseErd } from "@/model/validate";

describe("sample board", () => {
    const doc = buildSampleDocument();

    it("is a valid file: saves and loads with no issues and nothing changes", () => {
        const text = serializeErd(doc);
        const { doc: back, issues } = parseErd(text);
        expect(issues).toEqual([]);
        expect(serializeErd(back)).toBe(text);
    });

    it("shows the features: sections, colors, keys, composite index, notes, a self reference", () => {
        expect(doc.tables.length).toBeGreaterThanOrEqual(5);
        expect(doc.groups.map((g) => g.name)).toEqual(["Accounts", "Content"]);
        expect(
            new Set(doc.tables.map((t) => t.color)).size,
        ).toBeGreaterThanOrEqual(3);
        expect(
            doc.tables.some((t) => t.indexes.some((i) => i.columns.length > 1)),
        ).toBe(true);
        expect(doc.tables.some((t) => t.note && t.noteVisible)).toBe(true);
        expect(doc.notes).toHaveLength(1);
        expect(doc.refs.some((r) => r.from.table === r.to.table)).toBe(true);
        const cards = new Set(
            doc.refs.flatMap((r) => [r.from.cardinality, r.to.cardinality]),
        );
        expect(cards.size).toBeGreaterThanOrEqual(3);
        expect(
            doc.tables.some((t) =>
                t.columns.some((c) => c.type.startsWith("enum")),
            ),
        ).toBe(true);
    });

    it("every column type is understood by the type picker, every ref points at real columns", () => {
        for (const t of doc.tables)
            for (const c of t.columns)
                expect(parseType(c.type), `${t.name}.${c.name}`).not.toBeNull();
        const ids = new Map(
            doc.tables.map((t) => [t.id, new Set(t.columns.map((c) => c.id))]),
        );
        for (const r of doc.refs)
            for (const end of [r.from, r.to])
                for (const c of end.columns)
                    expect(ids.get(end.table)?.has(c)).toBe(true);
        expect(fkColumnKeys(doc).size).toBe(doc.refs.length);
    });

    it("tables never overlap each other, a pinned note, or the free note", () => {
        const boxes = [
            ...doc.tables.map((t) => [t.name, tableRect(t)]),
            ...pinnedNotes(doc).map((n) => [
                `note:${n.id}`,
                { x: n.x, y: n.y, w: n.w, h: n.h },
            ]),
            ...doc.notes.map((n) => ["free note", noteRect(n)]),
        ];
        for (let i = 0; i < boxes.length; i++)
            for (let j = i + 1; j < boxes.length; j++)
                expect(
                    rectsIntersect(boxes[i][1], boxes[j][1]),
                    `${boxes[i][0]} x ${boxes[j][0]}`,
                ).toBe(false);
    });

    it("sections hold exactly their tables and the pinned note, and don't overlap", () => {
        const m = groupMembership(doc);
        const names = (gid) =>
            doc.tables
                .filter((t) => m.get(t.id) === gid)
                .map((t) => t.name)
                .sort();
        expect(names(doc.groups[0].id)).toEqual(["profiles", "users"]);
        expect(names(doc.groups[1].id)).toEqual([
            "categories",
            "comments",
            "posts",
        ]);
        // the pinned note is on `categories`, so it never covers the posts -> comments line
        const [pinned] = pinnedNotes(doc);
        const cat = doc.tables.find((t) => t.name === "categories");
        expect(pinned.id).toBe(cat.id);
        expect(rectsIntersect(doc.groups[0], doc.groups[1])).toBe(false);
        const note = pinnedNotes(doc)[0];
        const g = doc.groups[1];
        expect(note.y + note.h).toBeLessThanOrEqual(g.y + g.h);
        // the free note is outside both sections
        for (const grp of doc.groups)
            expect(rectsIntersect(grp, noteRect(doc.notes[0]))).toBe(false);
    });

    it("every call builds fresh ids, and the exporters accept it", () => {
        const other = buildSampleDocument();
        const ids = new Set(
            [...doc.tables, ...doc.groups, ...doc.refs].map((x) => x.id),
        );
        for (const x of [...other.tables, ...other.groups, ...other.refs])
            expect(ids.has(x.id)).toBe(false);
        expect(toSql(doc, "mysql").warnings).toEqual([]);
        expect(toDbml(doc).warnings).toEqual([]);
    });

    it("words follow the given language, identifiers do not", () => {
        const fa = buildSampleDocument({
            name: "بلاگ نمونه",
            sectionAccounts: "حساب‌ها",
            sectionContent: "محتوا",
        });
        expect(fa.meta.name).toBe("بلاگ نمونه");
        expect(fa.groups.map((g) => g.name)).toEqual(["حساب‌ها", "محتوا"]);
        expect(fa.tables.map((t) => t.name)).toEqual(
            doc.tables.map((t) => t.name),
        );
    });
});
