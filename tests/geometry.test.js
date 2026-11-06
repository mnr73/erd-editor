import { describe, expect, it } from "vitest";

import { moveSelection, rangeIds, stepColumn } from "@/model/columns";
import {
    createColumn,
    createDocument,
    createGroup,
    createTable,
} from "@/model/document";
import {
    groupAt,
    groupMembership,
    movedWith,
    resizeRect,
    tableRect,
    tableWidth,
    textWidth,
} from "@/model/geometry";

const table = (name, x, y, cols = [["id", "int"]]) =>
    createTable({
        id: `t_${name}`,
        name,
        x,
        y,
        columns: cols.map(([n, t]) => createColumn({ name: n, type: t })),
    });

describe("table width follows content", () => {
    it("a long table name widens the card", () => {
        const short = tableWidth(table("a", 0, 0));
        const long = tableWidth(
            table("a_very_long_table_name_for_an_invoice_line_item", 0, 0),
        );
        expect(short).toBe(200);
        expect(long).toBeGreaterThan(300);
    });

    it("a long column name or type widens the card, up to 800", () => {
        const w = tableWidth(
            table("t", 0, 0, [
                [
                    "a_really_long_column_name_that_keeps_going_on",
                    "varchar(255)",
                ],
            ]),
        );
        expect(w).toBeGreaterThan(300);
        expect(tableWidth(table("t", 0, 0, [["x".repeat(400), "int"]]))).toBe(
            800,
        );
    });

    it("icons and the nullable marker take room", () => {
        const plain = table("t", 0, 0, [
            ["column_name_12345678", "varchar(255)"],
        ]);
        const busy = structuredClone(plain);
        busy.columns[0].unique = busy.columns[0].increment = true;
        busy.columns[0].default = "x";
        busy.columns[0].note = "n";
        expect(tableWidth(busy)).toBeGreaterThanOrEqual(tableWidth(plain));
    });

    it("measures non-latin text wider than latin", () => {
        expect(textWidth("جدول", 12)).toBeGreaterThan(textWidth("abcd", 12));
    });
});

describe("group membership is derived from geometry", () => {
    const doc = createDocument();
    doc.groups.push(
        createGroup({ id: "g_big", x: 0, y: 0, w: 1000, h: 800 }),
        createGroup({ id: "g_small", x: 20, y: 20, w: 400, h: 300 }),
    );
    const inSmall = table("a", 40, 60);
    const inBigOnly = table("b", 500, 400);
    const straddles = table("c", 380, 60); // sticks out of the small frame, still inside the big one
    const outside = table("d", 1200, 60);
    doc.tables.push(inSmall, inBigOnly, straddles, outside);

    it("a table belongs to the innermost group that contains it completely", () => {
        expect(groupAt(doc, tableRect(inSmall))).toBe("g_small");
        expect(groupAt(doc, tableRect(inBigOnly))).toBe("g_big");
        expect(groupAt(doc, tableRect(straddles))).toBe("g_big");
        expect(groupAt(doc, tableRect(outside))).toBeNull();
    });

    it("half inside is NOT a member", () => {
        const half = table("e", 380, 20);
        expect(groupAt(doc, tableRect(half))).toBe("g_big");
        const poke = table("f", 960, 20); // pokes out of the big frame too
        expect(groupAt(doc, tableRect(poke))).toBeNull();
    });

    it("groupMembership lists only contained tables", () => {
        const m = groupMembership(doc);
        expect(m.get("t_a")).toBe("g_small");
        expect(m.has("t_d")).toBe(false);
    });

    it("dragging a table out of a frame removes it from the move set", () => {
        expect(movedWith(doc, ["g_small"]).tables.has("t_a")).toBe(true);
        const moved = structuredClone(doc);
        moved.tables.find((t) => t.id === "t_a").x = 900; // now outside g_small
        expect(movedWith(moved, ["g_small"]).tables.has("t_a")).toBe(false);
    });
});

describe("movedWith", () => {
    const doc = createDocument();
    doc.groups.push(
        createGroup({ id: "g_outer", x: 0, y: 0, w: 1000, h: 800 }),
        createGroup({ id: "g_inner", x: 50, y: 50, w: 300, h: 300 }),
        createGroup({ id: "g_other", x: 1100, y: 0, w: 300, h: 300 }),
    );
    doc.tables.push(
        table("a", 60, 100),
        table("b", 600, 500),
        table("c", 1120, 40),
    );

    it("a moved group carries nested groups and contained tables, not neighbours", () => {
        const r = movedWith(doc, ["g_outer"]);
        expect([...r.groups].sort()).toEqual(["g_inner", "g_outer"]);
        expect([...r.tables].sort()).toEqual(["t_a", "t_b"]);
    });

    it("a selected table inside a moved group appears once", () => {
        const r = movedWith(doc, ["g_inner", "t_a"]);
        expect([...r.tables]).toEqual(["t_a"]);
    });

    it("a plain table moves alone", () => {
        const r = movedWith(doc, ["t_c"]);
        expect([...r.tables]).toEqual(["t_c"]);
        expect(r.groups.size).toBe(0);
    });
});

describe("resizeRect", () => {
    const r = { x: 100, y: 100, w: 400, h: 300 };
    it("east / south grow from the far edge", () => {
        expect(resizeRect(r, "e", 50, 0)).toEqual({
            x: 100,
            y: 100,
            w: 450,
            h: 300,
        });
        expect(resizeRect(r, "s", 0, -50)).toEqual({
            x: 100,
            y: 100,
            w: 400,
            h: 250,
        });
    });
    it("west / north keep the opposite edge fixed", () => {
        const w = resizeRect(r, "w", -60, 0);
        expect(w).toEqual({ x: 40, y: 100, w: 460, h: 300 });
        expect(w.x + w.w).toBe(500);
        const n = resizeRect(r, "n", 0, 40);
        expect(n.y + n.h).toBe(400);
    });
    it("corners combine both axes", () => {
        expect(resizeRect(r, "se", 10, 20)).toEqual({
            x: 100,
            y: 100,
            w: 410,
            h: 320,
        });
        const nw = resizeRect(r, "nw", 10, 20);
        expect([nw.x + nw.w, nw.y + nw.h]).toEqual([500, 400]);
    });
    it("never shrinks below the minimum and keeps the far edge", () => {
        const s = resizeRect(r, "w", 9999, 0, 120);
        expect(s.w).toBe(120);
        expect(s.x + s.w).toBe(500);
        expect(resizeRect(r, "e", -9999, 0, 120).w).toBe(120);
    });
});

describe("column selection helpers", () => {
    const cols = ["a", "b", "c", "d", "e"].map((n) => ({ id: n }));
    const ids = (a) => a.map((c) => c.id).join("");

    it("rangeIds works in both directions", () => {
        expect(rangeIds(cols, "b", "d")).toEqual(["b", "c", "d"]);
        expect(rangeIds(cols, "d", "b")).toEqual(["b", "c", "d"]);
        expect(rangeIds(cols, "b", "zzz")).toEqual([]);
    });

    it("moveSelection moves a block up / down keeping order", () => {
        expect(ids(moveSelection(cols, new Set(["c", "d"]), -1))).toBe("acdbe");
        expect(ids(moveSelection(cols, new Set(["c", "d"]), 1))).toBe("abecd");
    });

    it("handles non-contiguous selections and the edges", () => {
        expect(ids(moveSelection(cols, new Set(["b", "d"]), -1))).toBe("badce");
        expect(ids(moveSelection(cols, new Set(["a", "c"]), -1))).toBe("acbde");
        expect(moveSelection(cols, new Set(["a", "b"]), -1)).toBeNull();
        expect(moveSelection(cols, new Set(["d", "e"]), 1)).toBeNull();
        expect(moveSelection(cols, new Set(), 1)).toBeNull();
    });

    it("a blocked block does not move at all at the edge even with a free neighbour selected", () => {
        expect(ids(moveSelection(cols, new Set(["a", "c"]), -1))).toBe("acbde");
    });

    it("stepColumn clamps to the table", () => {
        expect(stepColumn(cols, "a", -1)).toBe("a");
        expect(stepColumn(cols, "b", 1)).toBe("c");
        expect(stepColumn(cols, "e", 1)).toBe("e");
        expect(stepColumn([], "a", 1)).toBeNull();
    });
});
