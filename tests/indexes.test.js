import { readFileSync } from "node:fs";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import {
    findSameIndex,
    inTableOrder,
    indexName,
    indexesOfColumn,
    moveItem,
} from "@/model/indexes";
import { serializeErd } from "@/model/serialize";
import { parseErd } from "@/model/validate";
import { useDocumentStore } from "@/stores/document";

const shop = readFileSync(
    new URL("./fixtures/shop.erd.json", import.meta.url),
    "utf8",
);

describe("index helpers", () => {
    const table = {
        name: "orders",
        columns: [
            { id: "a", name: "id" },
            { id: "b", name: "user_id" },
            { id: "c", name: "status" },
        ],
        indexes: [
            { id: "i1", name: "", columns: ["b", "c"], unique: false },
            { id: "i2", name: "uq_x", columns: ["a"], unique: true },
        ],
    };

    it("generates a readable default name, keeps an explicit one", () => {
        expect(indexName(table, table.indexes[0])).toBe(
            "orders_user_id_status_idx",
        );
        expect(indexName(table, { ...table.indexes[0], unique: true })).toBe(
            "orders_user_id_status_uq",
        );
        expect(indexName(table, table.indexes[1])).toBe("uq_x");
    });

    it("finds indexes of a column and identical indexes (order matters)", () => {
        expect(indexesOfColumn(table, "b").map((i) => i.id)).toEqual(["i1"]);
        expect(findSameIndex(table, ["b", "c"])?.id).toBe("i1");
        expect(findSameIndex(table, ["c", "b"])).toBeUndefined();
        expect(findSameIndex(table, ["b", "c"], "i1")).toBeUndefined();
    });

    it("inTableOrder sorts a selection by table order", () => {
        expect(inTableOrder(table, new Set(["c", "a"]))).toEqual(["a", "c"]);
    });

    it("moveItem clamps and reports no-ops as null", () => {
        expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
        expect(moveItem([1, 2, 3], 2, 99)).toBeNull();
        expect(moveItem([1, 2, 3], 0, -5)).toBeNull();
    });
});

describe("index store actions", () => {
    let s;
    beforeEach(() => {
        setActivePinia(createPinia());
        s = useDocumentStore();
        s.load(shop, "/tmp/shop.erd.json");
    });
    const cols = () => s.tableById.get("t_orders").columns.map((c) => c.id);

    it("addIndex keeps the given column order and is one undo step", () => {
        const [id, user, status] = cols();
        const ixId = s.addIndex("t_orders", {
            columns: [status, user],
            unique: true,
        });
        const ix = s.tableById
            .get("t_orders")
            .indexes.find((i) => i.id === ixId);
        expect(ix.columns).toEqual([status, user]);
        expect(ix.unique).toBe(true);
        s.undo();
        expect(
            s.tableById.get("t_orders").indexes.some((i) => i.id === ixId),
        ).toBe(false);
        expect(id).toBeTruthy();
    });

    it("refuses empty / foreign columns and does not duplicate an identical index", () => {
        const before = s.tableById.get("t_orders").indexes.length;
        expect(s.addIndex("t_orders", { columns: [] })).toBeNull();
        expect(s.addIndex("t_orders", { columns: ["nope"] })).toBeNull();
        const [, user, status] = cols();
        const a = s.addIndex("t_orders", { columns: [user, status] });
        const b = s.addIndex("t_orders", { columns: [user, status] });
        expect(b).toBe(a);
        expect(s.tableById.get("t_orders").indexes).toHaveLength(before + 1);
    });

    it("createIndexFromColumns orders an unordered selection by the table's columns", () => {
        const [id, user, status] = cols();
        const ixId = s.createIndexFromColumns(
            "t_orders",
            new Set([status, id]),
        );
        const ix = s.tableById
            .get("t_orders")
            .indexes.find((i) => i.id === ixId);
        expect(ix.columns).toEqual([id, status]);
        expect(user).toBeTruthy();
    });

    it("updateIndex coalesces typing the name; removeIndex deletes", () => {
        const [, user, status] = cols();
        const ixId = s.addIndex("t_orders", { columns: [user, status] });
        s.updateIndex("t_orders", ixId, { name: "a" }, "ixname");
        s.updateIndex("t_orders", ixId, { name: "ab" }, "ixname");
        s.undo();
        expect(
            s.tableById.get("t_orders").indexes.find((i) => i.id === ixId).name,
        ).toBe("");
        s.removeIndex("t_orders", ixId);
        expect(
            s.tableById.get("t_orders").indexes.some((i) => i.id === ixId),
        ).toBe(false);
    });

    it("deleting one column of a composite index shrinks it, deleting all removes it", () => {
        const [id, user, status] = cols();
        const ixId = s.addIndex("t_orders", { columns: [user, status] });
        s.removeColumn("t_orders", status);
        expect(
            s.tableById.get("t_orders").indexes.find((i) => i.id === ixId)
                .columns,
        ).toEqual([user]);
        s.removeColumns("t_orders", [user, id]);
        expect(
            s.tableById.get("t_orders").indexes.some((i) => i.id === ixId),
        ).toBe(false);
    });

    it("composite indexes survive save / load with column order intact", () => {
        const [, user, status] = cols();
        const ixId = s.addIndex("t_orders", {
            columns: [status, user],
            type: "hash",
        });
        const back = parseErd(serializeErd(s.doc));
        expect(back.issues).toEqual([]);
        const ix = back.doc.tables
            .find((t) => t.id === "t_orders")
            .indexes.find((i) => i.id === ixId);
        expect(ix.columns).toEqual([status, user]);
        expect(ix.type).toBe("hash");
    });

    it("validation flags empty indexes and repeated columns", () => {
        const doc = JSON.parse(shop);
        const t = doc.tables.find((x) => x.id === "t_orders");
        t.indexes = [
            { id: "i_a", columns: [] },
            { id: "i_b", columns: [t.columns[0].id, t.columns[0].id] },
        ];
        const codes = parseErd(JSON.stringify(doc)).issues.map((i) => i.code);
        expect(codes).toContain("index-empty");
        expect(codes).toContain("index-duplicate-column");
    });
});
