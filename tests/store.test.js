import { readFileSync } from "node:fs";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { useDocumentStore } from "@/stores/document";

const shop = readFileSync(
    new URL("./fixtures/shop.erd.json", import.meta.url),
    "utf8",
);
let s;
beforeEach(() => {
    setActivePinia(createPinia());
    s = useDocumentStore();
    s.load(shop, "/tmp/shop.erd.json");
});

describe("document store", () => {
    it("load: clean state, path set; fatal keeps previous doc", () => {
        expect(s.dirty).toBe(false);
        expect(s.path).toBe("/tmp/shop.erd.json");
        const issues = s.load("{bad");
        expect(issues[0].level).toBe("fatal");
        expect(s.doc.tables).toHaveLength(2);
    });

    it("commit marks dirty, undo returns to clean, redo reapplies", () => {
        s.updateTable("t_users", { name: "customers" });
        expect(s.dirty).toBe(true);
        s.undo();
        expect(s.doc.tables[0].name).toBe("users");
        expect(s.dirty).toBe(false);
        s.redo();
        expect(s.doc.tables[0].name).toBe("customers");
    });

    it("markSaved clears dirty", () => {
        s.addTable({ name: "x" });
        expect(s.dirty).toBe(true);
        s.markSaved();
        expect(s.dirty).toBe(false);
    });

    it("removeTable also removes its refs", () => {
        s.removeTable("t_users");
        expect(s.doc.refs).toHaveLength(0);
    });

    it("removeColumn cleans refs and indexes", () => {
        s.removeColumn("t_users", "c_users_email");
        expect(s.doc.tables[0].indexes).toHaveLength(0);
        s.removeColumn("t_orders", "c_orders_user");
        expect(s.doc.refs).toHaveLength(0);
    });

    it("moveGroup moves member tables by the same delta, one undo step", () => {
        s.moveGroup("g_sales", 10, -5);
        s.moveGroup("g_sales", 10, -5);
        const [users, orders] = s.doc.tables;
        expect([users.x, users.y, orders.x, orders.y]).toEqual([
            100, 70, 440, 70,
        ]);
        expect(s.doc.groups[0].x).toBe(60);
        s.undo();
        expect(s.doc.tables[0].x).toBe(80);
    });

    it("removeGroup detaches members", () => {
        s.removeGroup("g_sales");
        expect(s.doc.tables.every((t) => t.groupId === null)).toBe(true);
    });

    it("moveColumn reorders", () => {
        s.moveColumn("t_orders", 0, 2);
        expect(s.doc.tables[1].columns.map((c) => c.name)).toEqual([
            "user_id",
            "status",
            "id",
        ]);
    });

    it("palette is lowercase and deduplicated", () => {
        s.addPaletteColor("#AABBCC");
        s.addPaletteColor("#aabbcc");
        expect(s.doc.palette).toEqual(["#14b8a6", "#aabbcc"]);
        s.removePaletteColor("#AABBCC");
        expect(s.doc.palette).toEqual(["#14b8a6"]);
    });

    it("undo keeps the camera; setView is not dirty", () => {
        s.setView({ x: 50, zoom: 2 });
        expect(s.dirty).toBe(false);
        s.addTable({ name: "z" });
        s.setView({ x: 70 });
        s.undo();
        expect(s.doc.view.x).toBe(70);
    });
});

describe("moveItems", () => {
    it("moves a mixed selection once, groups carry members, one undo step", () => {
        // t_users is selected AND inside selected g_sales: must move exactly once
        s.moveItems(["g_sales", "t_users"], 10, 20);
        const [users, orders] = s.doc.tables;
        expect([users.x, users.y]).toEqual([90, 100]);
        expect([orders.x, orders.y]).toEqual([430, 100]);
        expect([s.doc.groups[0].x, s.doc.groups[0].y]).toEqual([50, 40]);
        s.undo();
        expect([
            s.doc.tables[0].x,
            s.doc.tables[1].x,
            s.doc.groups[0].x,
        ]).toEqual([80, 420, 40]);
    });

    it("moving a single table leaves its group and siblings alone", () => {
        s.moveItems(["t_orders"], -5, 0);
        expect(s.doc.tables[1].x).toBe(415);
        expect(s.doc.tables[0].x).toBe(80);
        expect(s.doc.groups[0].x).toBe(40);
    });

    it("zero delta records nothing", () => {
        s.moveItems(["t_orders"], 0, 0);
        expect(s.dirty).toBe(false);
    });
});
