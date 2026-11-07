import { describe, expect, it } from "vitest";

import {
    createColumn,
    createDocument,
    createRef,
    createTable,
} from "@/model/document";
import { ROW_H, tableRect } from "@/model/geometry";
import {
    anchorY,
    bendFor,
    columnKeysOf,
    focusedRefIds,
    layoutRefs,
    markerPath,
    refsOf,
    routeRef,
    sides,
} from "@/model/relations";

const tbl = (id, x, y, cols = ["id", "other_id"]) =>
    createTable({
        id,
        name: id,
        x,
        y,
        columns: cols.map((n) =>
            createColumn({ id: `${id}.${n}`, name: n, type: "int" }),
        ),
    });
const ref = (from, fc, to, tc, extra = {}) =>
    createRef({
        id: `r_${from}_${to}_${fc}`,
        from: { table: from, columns: [`${from}.${fc}`], cardinality: "0..*" },
        to: { table: to, columns: [`${to}.${tc}`], cardinality: "1" },
        ...extra,
    });

describe("anchors", () => {
    it("row anchors are one ROW_H apart; collapsed tables use the header", () => {
        const t = tbl("a", 0, 0);
        expect(anchorY(t, "a.other_id") - anchorY(t, "a.id")).toBe(ROW_H);
        const c = { ...t, collapsed: true };
        expect(anchorY(c, "a.id")).toBe(anchorY(c, "a.other_id"));
        expect(anchorY(t, "nope")).toBeLessThan(anchorY(t, "a.id"));
    });
});

describe("sides", () => {
    it("faces each other horizontally", () => {
        expect(sides(tbl("a", 0, 0), tbl("b", 600, 0))).toEqual([1, -1]);
        expect(sides(tbl("a", 600, 0), tbl("b", 0, 0))).toEqual([-1, 1]);
    });
    it("a narrow table under a wide one still overlaps it: loop, never run backwards", () => {
        // centres are 75 apart but x ranges overlap (the sample board's posts / comments)
        const wide = tbl("a", 550, 70, ["a_long_column_name_here", "id"]);
        const narrow = tbl("b", 550, 334);
        const rw = tableRect(wide);
        const rn = tableRect(narrow);
        expect(Math.abs(rw.x + rw.w / 2 - (rn.x + rn.w / 2))).toBeGreaterThan(
            0,
        );
        expect(sides(wide, narrow)).toEqual([1, 1]);
        expect(sides(narrow, wide)).toEqual([1, 1]);
    });
    it("tables with a small gap loop, with enough room they face each other", () => {
        const a = tbl("a", 0, 0);
        const w = tableRect(a).w;
        expect(sides(a, tbl("b", w + 10, 0))).toEqual([1, 1]);
        expect(sides(a, tbl("b", w + 40, 0))).toEqual([1, -1]);
        expect(sides(tbl("b", w + 40, 0), a)).toEqual([-1, 1]);
    });
    it("stacked tables and self references loop on the same side", () => {
        expect(sides(tbl("a", 0, 0), tbl("b", 20, 400))).toEqual([1, 1]);
        const a = tbl("a", 0, 0);
        expect(sides(a, a)).toEqual([1, 1]);
    });
});

describe("routeRef", () => {
    const a = tbl("a", 0, 0);
    const b = tbl("b", 600, 120);
    const r = ref("a", "id", "b", "other_id");
    it("starts at the right edge of a and ends at the left edge of b, on the right rows", () => {
        const g = routeRef(r, a, b);
        expect(g.p.x).toBe(tableRect(a).w);
        expect(g.q.x).toBe(600);
        expect(g.p.y).toBe(anchorY(a, "a.id"));
        expect(g.q.y).toBe(anchorY(b, "b.other_id"));
        expect(g.d.startsWith(`M${g.p.x} ${g.p.y}`)).toBe(true);
        expect(g.d.endsWith(`H${g.q.x}`)).toBe(true);
        expect(g.lx).toBeGreaterThan(g.p.x);
        expect(g.lx).toBeLessThan(g.q.x);
    });
    it("a straight line (same row height) has no zero-size corner radius", () => {
        const flat = routeRef(r, a, tbl("b", 600, 0, ["id", "other_id"]));
        expect(flat.d).not.toContain("NaN");
    });
    it("same-side loop sticks out beyond both tables", () => {
        const stacked = routeRef(r, a, tbl("b", 20, 500));
        const maxX = Math.max(stacked.p.x, stacked.q.x);
        expect(stacked.lx).toBeGreaterThan(maxX);
        expect(stacked.d).toContain("C");
    });
    it("self reference is a loop on the right edge", () => {
        const g = routeRef(ref("a", "other_id", "a", "id"), a, a);
        expect(g.sa).toBe(1);
        expect(g.sb).toBe(1);
        expect(g.q.y).toBeLessThan(g.p.y);
    });
    it("bend shifts the vertical segment", () => {
        expect(routeRef(r, a, b, 14).lx - routeRef(r, a, b, 0).lx).toBe(14);
    });
});

describe("markerPath", () => {
    const pt = { x: 100, y: 50, o: 1 };
    it("draws the four Crow's Foot ends", () => {
        const one = markerPath(pt, "1");
        expect(one.m.match(/V/g)).toHaveLength(2);
        expect(one.c).toBe("");
        const zeroOne = markerPath(pt, "0..1");
        expect(zeroOne.m.match(/V/g)).toHaveLength(1);
        expect(zeroOne.c).not.toBe("");
        const oneMany = markerPath(pt, "1..*");
        expect(oneMany.m).toContain("L");
        expect(oneMany.m).toContain("V");
        expect(oneMany.c).toBe("");
        const zeroMany = markerPath(pt, "0..*");
        expect(zeroMany.m).toContain("L");
        expect(zeroMany.c).not.toBe("");
    });
    it("mirrors with the outward direction", () => {
        const right = markerPath({ x: 100, y: 50, o: 1 }, "0..*");
        const left = markerPath({ x: 100, y: 50, o: -1 }, "0..*");
        expect(right.m).toContain("M111 50");
        expect(left.m).toContain("M89 50");
    });
});

describe("layoutRefs", () => {
    it("lays out every valid ref and skips broken ones without throwing", () => {
        const doc = createDocument();
        doc.tables.push(tbl("a", 0, 0), tbl("b", 600, 0));
        doc.refs.push(
            ref("a", "id", "b", "id"),
            ref("a", "id", "ghost", "id"),
            createRef({
                id: "r_empty",
                from: { table: "a", columns: [], cardinality: "1" },
                to: { table: "b", columns: [], cardinality: "1" },
            }),
        );
        const out = layoutRefs(doc);
        expect([...out.keys()]).toEqual(["r_a_b_id"]);
    });
    it("parallel refs between the same two tables are separated", () => {
        const doc = createDocument();
        doc.tables.push(tbl("a", 0, 0), tbl("b", 600, 0));
        doc.refs.push(
            ref("a", "id", "b", "id"),
            ref("a", "other_id", "b", "other_id"),
        );
        const [x, y] = [...layoutRefs(doc).values()];
        expect(x.lx).not.toBe(y.lx);
        expect(bendFor(0, 1)).toBe(0);
        expect(bendFor(0, 2) + bendFor(1, 2)).toBe(0);
    });
});

describe("focus helpers", () => {
    const doc = createDocument();
    doc.tables.push(tbl("a", 0, 0), tbl("b", 600, 0), tbl("c", 1200, 0));
    doc.refs.push(ref("a", "id", "b", "id"), ref("b", "other_id", "c", "id"));
    const [r1, r2] = doc.refs;

    it("refsOf by table and by column", () => {
        expect(refsOf(doc, "b").map((r) => r.id)).toEqual([r1.id, r2.id]);
        expect(refsOf(doc, "b", "b.id").map((r) => r.id)).toEqual([r1.id]);
        expect(refsOf(doc, "zzz")).toEqual([]);
    });
    it("columnKeysOf lists both ends", () => {
        expect([...columnKeysOf([r1])].sort()).toEqual(["a.a.id", "b.b.id"]);
    });
    it("focus: ref beats column beats table; nothing selected = empty", () => {
        expect([...focusedRefIds(doc, { refId: r2.id })]).toEqual([r2.id]);
        expect([...focusedRefIds(doc, { hoverRefId: r1.id })]).toEqual([r1.id]);
        expect([
            ...focusedRefIds(doc, {
                columnSel: { tableId: "b", ids: new Set(["b.id"]) },
            }),
        ]).toEqual([r1.id]);
        expect(focusedRefIds(doc, { tableIds: ["b"] }).size).toBe(2);
        expect(focusedRefIds(doc, {}).size).toBe(0);
        expect(focusedRefIds(doc, { refId: "gone" }).size).toBe(0);
    });
});

describe("legend contract", () => {
    it("every cardinality has a distinct marker, so the legend rows differ", () => {
        const pt = { x: 6, y: 8, o: 1 };
        const shapes = ["1", "0..1", "1..*", "0..*"].map((c) => {
            const m = markerPath(pt, c);
            return m.m + "|" + m.c;
        });
        expect(new Set(shapes).size).toBe(4);
    });
});
