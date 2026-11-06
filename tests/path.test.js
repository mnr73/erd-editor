import { describe, expect, it } from "vitest";

import { baseName, shortenHome, splitPath } from "@/utils/path";

describe("path helpers", () => {
    it("splitPath handles POSIX and Windows separators", () => {
        expect(splitPath("/home/a/shop.erd.json")).toEqual({
            dir: "/home/a/",
            name: "shop.erd.json",
        });
        expect(splitPath("C:\\x\\y.erd.json").name).toBe("y.erd.json");
        expect(splitPath(null)).toEqual({ dir: "", name: "" });
    });
    it("baseName strips the .erd.json suffix", () => {
        expect(baseName("/a/shop.erd.json")).toBe("shop");
        expect(baseName("/a/SHOP.ERD.JSON")).toBe("SHOP");
        expect(baseName("/a/plain.json")).toBe("plain");
    });
    it("shortenHome", () => {
        expect(shortenHome("/home/a/x/", "/home/a")).toBe("~/x/");
    });
});
