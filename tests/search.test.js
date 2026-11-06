import { describe, expect, it } from "vitest";

import {
    createColumn,
    createDocument,
    createGroup,
    createRef,
    createTable,
} from "@/model/document";
import { searchDocument } from "@/model/search";

const col = (id, name, type = "int", extra = {}) =>
    createColumn({ id, name, type, ...extra });
const doc = createDocument();
doc.tables.push(
    createTable({
        id: "t_users",
        name: "users",
        note: "people who log in",
        columns: [
            col("u1", "id", "bigint"),
            col("u2", "email", "varchar(255)"),
        ],
    }),
    createTable({
        id: "t_orders",
        name: "orders",
        columns: [
            col("o1", "id", "bigint"),
            col("o2", "user_id", "bigint"),
            col("o3", "status", "varchar(20)", { note: "draft | paid" }),
        ],
    }),
    createTable({ id: "t_user_roles", name: "user_roles", columns: [] }),
);
doc.groups.push(createGroup({ id: "g1", name: "Sales" }));
doc.refs.push(
    createRef({
        id: "r1",
        label: "places",
        from: { table: "t_orders", columns: ["o2"], cardinality: "0..*" },
        to: { table: "t_users", columns: ["u1"], cardinality: "1" },
    }),
);

describe("searchDocument", () => {
    it("empty / blank query finds nothing", () => {
        expect(searchDocument(doc, "")).toEqual([]);
        expect(searchDocument(doc, "   ")).toEqual([]);
        expect(searchDocument(doc, null)).toEqual([]);
    });

    it("is case-insensitive and finds every kind", () => {
        expect(searchDocument(doc, "USERS")[0]).toMatchObject({
            kind: "table",
            id: "t_users",
        });
        expect(searchDocument(doc, "email")[0]).toMatchObject({
            kind: "column",
            id: "u2",
            tableId: "t_users",
        });
        expect(searchDocument(doc, "sales")[0]).toMatchObject({
            kind: "group",
            id: "g1",
        });
        expect(searchDocument(doc, "places")[0]).toMatchObject({
            kind: "ref",
            id: "r1",
        });
    });

    it("exact name beats prefix beats substring; tables beat columns on a tie", () => {
        const r = searchDocument(doc, "user");
        const names = r.map((x) => `${x.kind}:${x.name}`);
        // table 'users' / 'user_roles' (prefix) and column 'user_id' (prefix) come before substring-only hits
        expect(names.slice(0, 3)).toEqual([
            "table:user_roles",
            "table:users",
            "column:user_id",
        ]);
        const exact = searchDocument(doc, "id");
        expect(exact[0].name).toBe("id");
        expect(exact.filter((x) => x.name === "id")).toHaveLength(2);
    });

    it("also matches types, column notes and table notes, after name matches", () => {
        const byType = searchDocument(doc, "varchar");
        expect(byType.map((x) => x.id).sort()).toEqual(["o3", "u2"]);
        expect(searchDocument(doc, "paid")[0]).toMatchObject({
            kind: "column",
            id: "o3",
        });
        expect(searchDocument(doc, "log in")[0]).toMatchObject({
            kind: "table",
            id: "t_users",
        });
    });

    it("column results say which table they belong to", () => {
        const r = searchDocument(doc, "status")[0];
        expect(r.detail).toContain("orders");
    });

    it("respects the limit and tolerates broken refs", () => {
        expect(searchDocument(doc, "i", 2)).toHaveLength(2);
        const broken = {
            ...doc,
            refs: [
                {
                    id: "x",
                    label: "",
                    note: "zzz",
                    from: { table: "nope" },
                    to: { table: "nope" },
                },
            ],
        };
        expect(searchDocument(broken, "zzz")[0].detail).toBe("? → ?");
    });

    it("no match", () => {
        expect(searchDocument(doc, "qqqq")).toEqual([]);
    });
});
