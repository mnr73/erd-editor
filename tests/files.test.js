import { describe, expect, it } from "vitest";

import { ensureExt } from "@/tauri";

describe("ensureExt", () => {
    it("forces the .erd.json extension", () => {
        expect(ensureExt("/a/shop")).toBe("/a/shop.erd.json");
        expect(ensureExt("/a/shop.json")).toBe("/a/shop.erd.json");
        expect(ensureExt("/a/shop.erd")).toBe("/a/shop.erd.json");
        expect(ensureExt("/a/shop.erd.json")).toBe("/a/shop.erd.json");
        expect(ensureExt("/a/Shop.ERD.JSON")).toBe("/a/Shop.ERD.JSON");
    });
});
