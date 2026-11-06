import { describe, expect, it } from "vitest";

import {
    createColumn,
    createDocument,
    createGroup,
    createRef,
    createTable,
} from "@/model/document";
import {
    columnAfterRemoval,
    docStats,
    inspectorTarget,
    relationsOfTable,
    sectionOfTable,
    tablesInSection,
} from "@/model/inspector";

const col = (id, name) => createColumn({ id, name, type: "int" });
const doc = createDocument();
doc.tables.push(
    createTable({
        id: "t_a",
        name: "a",
        x: 50,
        y: 50,
        columns: [col("a1", "id")],
    }),
    createTable({
        id: "t_b",
        name: "b",
        x: 600,
        y: 50,
        columns: [col("b1", "id"), col("b2", "a_id")],
    }),
    createTable({
        id: "t_c",
        name: "c",
        x: 2000,
        y: 2000,
        columns: [col("c1", "id")],
    }),
);
doc.groups.push(
    createGroup({ id: "g1", name: "S", x: 0, y: 0, w: 1000, h: 500 }),
);
doc.refs.push(
    createRef({
        id: "r1",
        label: "owns",
        from: { table: "t_b", columns: ["b2"], cardinality: "0..*" },
        to: { table: "t_a", columns: ["a1"], cardinality: "1" },
    }),
);

describe("inspectorTarget", () => {
    it("nothing selected", () => {
        expect(inspectorTarget(doc, {}).mode).toBe("none");
    });
    it("one table / one section / many", () => {
        expect(inspectorTarget(doc, { tableIds: ["t_a"] })).toMatchObject({
            mode: "table",
            table: { id: "t_a" },
        });
        expect(inspectorTarget(doc, { groupIds: ["g1"] })).toMatchObject({
            mode: "group",
            group: { id: "g1" },
        });
        const many = inspectorTarget(doc, {
            tableIds: ["t_a", "t_b"],
            groupIds: ["g1"],
        });
        expect(many.mode).toBe("multi");
        expect(many.tables).toHaveLength(2);
    });
    it("a selected line wins; a stale line id falls back to the selection", () => {
        expect(
            inspectorTarget(doc, { refId: "r1", tableIds: ["t_a"] }).mode,
        ).toBe("ref");
        expect(
            inspectorTarget(doc, { refId: "gone", tableIds: ["t_a"] }).mode,
        ).toBe("table");
        expect(inspectorTarget(doc, { tableIds: ["ghost"] }).mode).toBe("none");
    });
});

describe("sections and relations for the panel", () => {
    it("sectionOfTable follows geometry", () => {
        expect(sectionOfTable(doc, doc.tables[0])?.id).toBe("g1");
        expect(sectionOfTable(doc, doc.tables[2])).toBeNull();
        expect(tablesInSection(doc, "g1").map((t) => t.id)).toEqual([
            "t_a",
            "t_b",
        ]);
    });
    it("relationsOfTable describes both ends from this table's point of view", () => {
        const [fromB] = relationsOfTable(doc, "t_b");
        expect(fromB).toMatchObject({
            id: "r1",
            other: "a.id",
            mine: "b.a_id",
            kind: "N:1",
            label: "owns",
        });
        const [fromA] = relationsOfTable(doc, "t_a");
        expect(fromA).toMatchObject({ other: "b.a_id", mine: "a.id" });
        expect(relationsOfTable(doc, "t_c")).toEqual([]);
    });
    it("docStats", () => {
        expect(docStats(doc)).toEqual({
            tables: 3,
            refs: 1,
            groups: 1,
            notes: 0,
        });
    });
});

describe("columnAfterRemoval", () => {
    const cols = [{ id: "x" }, { id: "y" }, { id: "z" }];
    it("picks the neighbour that took the place, or the last", () => {
        expect(columnAfterRemoval(cols, 1)).toBe("y");
        expect(columnAfterRemoval(cols, 5)).toBe("z");
        expect(columnAfterRemoval([], 0)).toBeNull();
    });
});
